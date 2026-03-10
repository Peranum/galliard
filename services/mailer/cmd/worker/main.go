package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type queuedMessage struct {
	ID         string
	CampaignID string
	LeadID     string
	Email      string
	LeadName   string
	Subject    string
	Body       string
}

func main() {
	databaseURL := getenv("DATABASE_URL", "postgres://postgres:postgres@postgres:5432/galliard?sslmode=disable")
	interval := time.Duration(parseInt(getenv("WORKER_POLL_SECONDS", "10"), 10)) * time.Second

	smtpHost := getenv("SMTP_HOST", "mail")
	smtpPort := getenv("SMTP_PORT", "587")
	smtpUser := getenv("SMTP_USER", "")
	smtpPass := getenv("SMTP_PASS", "")
	smtpFrom := getenv("SMTP_FROM", "noreply@galliard.by")

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("pgxpool: %v", err)
	}
	defer pool.Close()

	log.Printf("mailer started, poll=%s", interval)
	for {
		if err := processBatch(ctx, pool, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom); err != nil {
			log.Printf("process batch error: %v", err)
		}
		time.Sleep(interval)
	}
}

func processBatch(ctx context.Context, pool *pgxpool.Pool, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom string) error {
	rows, err := pool.Query(ctx, `
		SELECT cm.id, cm.campaign_id, cm.lead_id, COALESCE(l.email,''), l.name, COALESCE(cm.subject,''), COALESCE(cm.body,'')
		FROM campaign_messages cm
		JOIN leads l ON l.id = cm.lead_id
		WHERE cm.status = 'queued'
		ORDER BY cm.updated_at ASC
		LIMIT 50
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	messages := []queuedMessage{}
	for rows.Next() {
		var m queuedMessage
		if err := rows.Scan(&m.ID, &m.CampaignID, &m.LeadID, &m.Email, &m.LeadName, &m.Subject, &m.Body); err == nil {
			messages = append(messages, m)
		}
	}

	for _, message := range messages {
		if strings.TrimSpace(message.Email) == "" {
			if err := setStatus(ctx, pool, message.ID, "bounced", "", map[string]any{"reason": "missing email"}); err != nil {
				log.Printf("mark bounced missing email: %v", err)
			}
			continue
		}

		messageID := fmt.Sprintf("<%s@galliard.local>", uuid.NewString())
		err := sendSMTP(smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, message.Email, message.Subject, message.Body, messageID)
		if err != nil {
			log.Printf("smtp send failed campaignMessage=%s lead=%s email=%s: %v", message.ID, message.LeadID, message.Email, err)
			if updateErr := setStatus(ctx, pool, message.ID, "bounced", messageID, map[string]any{"reason": err.Error()}); updateErr != nil {
				log.Printf("mark bounced failed: %v", updateErr)
			}
			continue
		}

		if err := setStatus(ctx, pool, message.ID, "sent", messageID, map[string]any{"transport": "smtp"}); err != nil {
			log.Printf("set sent failed: %v", err)
			continue
		}
		if err := setStatus(ctx, pool, message.ID, "delivered", messageID, map[string]any{"transport": "smtp", "delivery": "accepted"}); err != nil {
			log.Printf("set delivered failed: %v", err)
		}
	}

	return nil
}

func sendSMTP(host, port, user, pass, from, to, subject, body, messageID string) error {
	addr := net.JoinHostPort(host, port)
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return err
	}
	_ = conn.SetDeadline(time.Now().Add(20 * time.Second))
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return err
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: host}); err != nil {
			return err
		}
	}
	if user != "" && pass != "" {
		if ok, _ := client.Extension("AUTH"); ok {
			auth := smtp.PlainAuth("", user, pass, host)
			if err := client.Auth(auth); err != nil {
				return err
			}
		}
	}

	if err := client.Mail(from); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	dataWriter, err := client.Data()
	if err != nil {
		return err
	}
	headers := []string{
		"From: " + from,
		"To: " + to,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Message-ID: " + messageID,
		"Date: " + time.Now().Format(time.RFC1123Z),
	}
	msg := strings.Join(headers, "\r\n") + "\r\n\r\n" + body
	if _, err := dataWriter.Write([]byte(msg)); err != nil {
		_ = dataWriter.Close()
		return err
	}
	if err := dataWriter.Close(); err != nil {
		return err
	}

	return client.Quit()
}

func setStatus(ctx context.Context, pool *pgxpool.Pool, campaignMessageID, status, messageID string, raw map[string]any) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		UPDATE campaign_messages
		SET status = $2,
			message_id = CASE WHEN $3 = '' THEN message_id ELSE $3 END,
			sent_at = CASE WHEN $2 IN ('sent', 'delivered', 'replied', 'bounced') THEN NOW() ELSE sent_at END,
			updated_at = NOW()
		WHERE id = $1
	`, campaignMessageID, status, messageID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO email_events (id, message_id, event_type, ts, raw)
		VALUES ($1, COALESCE(NULLIF($2,''), $3), $4, NOW(), $5)
	`, uuid.NewString(), messageID, campaignMessageID, strings.ToUpper(status), toJSON(raw))
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func toJSON(v map[string]any) []byte {
	if len(v) == 0 {
		return []byte("{}")
	}
	pairs := make([]string, 0, len(v))
	for k, value := range v {
		pairs = append(pairs, fmt.Sprintf(`"%s":"%v"`, escape(k), escape(fmt.Sprint(value))))
	}
	return []byte("{" + strings.Join(pairs, ",") + "}")
}

func escape(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, `"`, `\\"`)
	return s
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func parseInt(raw string, fallback int) int {
	v, err := strconv.Atoi(raw)
	if err != nil || v <= 0 {
		return fallback
	}
	return v
}
