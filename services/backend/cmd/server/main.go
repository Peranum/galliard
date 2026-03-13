package main

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

var orderedStages = []string{"NEW", "CONTACTED", "REPLIED", "QUALIFIED", "SOURCING", "PROPOSAL", "NEGOTIATION", "WON", "LOST"}
var taskStatusSet = map[string]struct{}{
	"PLANNED":     {},
	"READY":       {},
	"IN_PROGRESS": {},
	"REVIEW":      {},
	"DONE":        {},
}
var taskReferenceTypes = map[string]struct{}{
	"WORK":   {},
	"LEAD":   {},
	"CLIENT": {},
}
var taskPrioritySet = map[string]struct{}{
	"BLOCKER":  {},
	"CRITICAL": {},
	"HIGH":     {},
	"MEDIUM":   {},
	"LOW":      {},
	"SOMEDAY":  {},
}
var allowedCompanyCategories = map[string]struct{}{
	"CHEMICALS":              {},
	"TEXTILE":                {},
	"FOOD_BEVERAGE":          {},
	"WOOD_FURNITURE":         {},
	"METALWORKING":           {},
	"CONSTRUCTION_MATERIALS": {},
	"MACHINERY_EQUIPMENT":    {},
	"ELECTRONICS_ELECTRICAL": {},
	"PACKAGING":              {},
	"LOGISTICS_ECOM":         {},
	"OTHER":                  {},
}

func stageOrder(stage string) int {
	for i, s := range orderedStages {
		if s == stage {
			return i
		}
	}
	return -1
}

type app struct {
	db         *pgxpool.Pool
	adminToken string
	botToken   string
	chatID     string
}

type lead struct {
	ID                 string     `json:"id"`
	Name               string     `json:"name"`
	Company            string     `json:"company"`
	CompanyCategory    string     `json:"companyCategory"`
	CompanySubcategory string     `json:"companySubcategory,omitempty"`
	Phone              string     `json:"phone"`
	Email              string     `json:"email,omitempty"`
	Source             string     `json:"source"`
	Stage              string     `json:"stage"`
	Priority           string     `json:"priority"`
	Owner              string     `json:"owner"`
	PotentialValue     float64    `json:"potentialValue"`
	StageEnteredAt     *time.Time `json:"stageEnteredAt,omitempty"`
	LastActivityAt     *time.Time `json:"lastActivityAt,omitempty"`
	NextActionAt       *time.Time `json:"nextActionAt,omitempty"`
	CreatedAt          time.Time  `json:"createdAt"`
}

type leadContact struct {
	ID         string `json:"id"`
	Department string `json:"department"`
	FullName   string `json:"fullName"`
	Role       string `json:"role"`
	Phone      string `json:"phone"`
	Email      string `json:"email"`
	Notes      string `json:"notes"`
}

type leadStageHistoryItem struct {
	FromStage *string   `json:"fromStage,omitempty"`
	ToStage   string    `json:"toStage"`
	ChangedBy string    `json:"changedBy"`
	ChangedAt time.Time `json:"changedAt"`
}

type task struct {
	ID            string     `json:"id"`
	ReferenceType string     `json:"referenceType"`
	ReferenceID   *string    `json:"referenceId,omitempty"`
	Title         string     `json:"title"`
	Description   string     `json:"description,omitempty"`
	Type          string     `json:"type"`
	Status        string     `json:"status"`
	Priority      string     `json:"priority"`
	DueAt         *time.Time `json:"dueAt,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
}

type taskComment struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"taskId"`
	Author    string    `json:"author"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
}

type campaign struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	Subject   string    `json:"subject,omitempty"`
	Body      string    `json:"body,omitempty"`
	CreatedBy string    `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
}

type campaignMessage struct {
	ID         string     `json:"id"`
	CampaignID string     `json:"campaignId"`
	LeadID     string     `json:"leadId"`
	LeadName   string     `json:"leadName"`
	LeadEmail  string     `json:"leadEmail"`
	Status     string     `json:"status"`
	Step       int        `json:"step"`
	MessageID  string     `json:"messageId,omitempty"`
	SentAt     *time.Time `json:"sentAt,omitempty"`
}

func main() {
	databaseURL := getenv("DATABASE_URL", "postgres://postgres:postgres@postgres:5432/galliard?sslmode=disable")
	adminToken := getenv("ADMIN_API_TOKEN", "dev-admin-token")

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("pgxpool: %v", err)
	}
	defer pool.Close()

	if err := runMigrations(ctx, pool); err != nil {
		log.Fatalf("migrations: %v", err)
	}

	a := &app{
		db:         pool,
		adminToken: adminToken,
		botToken:   os.Getenv("TELEGRAM_BOT_TOKEN"),
		chatID:     os.Getenv("TELEGRAM_CHAT_ID"),
	}

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:3001", "https://galliard.by", "https://www.galliard.by"},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Admin-Token"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Post("/api/leads", a.handlePublicCreateLead)
	r.Post("/api/email-events", a.handleIngestEmailEvent)

	r.Group(func(ar chi.Router) {
		ar.Use(a.requireAdminToken)

		ar.Get("/api/dashboard", a.handleDashboard)
		ar.Get("/api/leads", a.handleListLeads)
		ar.Get("/api/leads/{id}", a.handleGetLeadDetails)
		ar.Patch("/api/leads/{id}", a.handlePatchLead)
		ar.Delete("/api/leads/{id}", a.handleDeleteLead)
		ar.Patch("/api/leads/{id}/details", a.handlePatchLeadDetails)
		ar.Patch("/api/leads/{id}/stage", a.handlePatchStage)
		ar.Get("/api/pipeline", a.handlePipeline)
		ar.Get("/api/clients", a.handleClients)

		ar.Get("/api/tasks", a.handleListTasks)
		ar.Post("/api/tasks", a.handleCreateTask)
		ar.Patch("/api/tasks/{id}", a.handlePatchTask)
		ar.Delete("/api/tasks/{id}", a.handleDeleteTask)
		ar.Get("/api/tasks/{id}/comments", a.handleListTaskComments)
		ar.Post("/api/tasks/{id}/comments", a.handleCreateTaskComment)

		ar.Get("/api/campaigns", a.handleListCampaigns)
		ar.Post("/api/campaigns", a.handleCreateCampaign)
		ar.Post("/api/campaigns/{id}/start", a.handleStartCampaign)
		ar.Get("/api/campaigns/{id}/stats", a.handleCampaignStats)
		ar.Get("/api/campaigns/{id}/messages", a.handleCampaignMessages)
		ar.Patch("/api/campaign-messages/{id}/status", a.handlePatchCampaignMessageStatus)
	})

	addr := getenv("ADDR", ":8080")
	server := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	stopSignals := make(chan os.Signal, 1)
	signal.Notify(stopSignals, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(stopSignals)

	go func() {
		<-stopSignals
		log.Printf("shutdown signal received, stopping backend")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("graceful shutdown failed: %v", err)
		}
	}()

	log.Printf("backend listening on %s", addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server: %v", err)
	}
}

func (a *app) requireAdminToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("X-Admin-Token")
		if token == "" || token != a.adminToken {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func runMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	entries, err := fs.ReadDir(migrationFiles, "migrations")
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		path := "migrations/" + entry.Name()
		b, readErr := migrationFiles.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		if _, execErr := pool.Exec(ctx, string(b)); execErr != nil {
			return fmt.Errorf("migration %s failed: %w", entry.Name(), execErr)
		}
	}
	return nil
}

func (a *app) handlePublicCreateLead(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	type req struct {
		Name               string `json:"name"`
		Company            string `json:"company"`
		CompanyCategory    string `json:"companyCategory"`
		CompanySubcategory string `json:"companySubcategory"`
		Phone              string `json:"phone"`
		Email              string `json:"email"`
		Message            string `json:"message"`
		ContactType        string `json:"contactType"`
		Source             string `json:"source"`
	}
	var body req
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if strings.TrimSpace(body.Name) == "" || strings.TrimSpace(body.Phone) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and phone are required"})
		return
	}
	if body.Source == "" {
		body.Source = "landing"
	}

	leadID := uuid.NewString()
	taskID := uuid.NewString()
	now := time.Now().UTC()
	due := now.Add(24 * time.Hour)

	tx, err := a.db.Begin(ctx)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "begin tx"})
		return
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO leads (
			id, name, company, company_category, company_subcategory, phone, email, source, stage, priority, owner_name, message, next_action_at, last_activity_at, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'NEW','MEDIUM','unassigned',$9,$10,$11,$12,$12)
	`, leadID, strings.TrimSpace(body.Name), strings.TrimSpace(body.Company), normalizeCompanyCategory(body.CompanyCategory), nullIfEmpty(strings.TrimSpace(body.CompanySubcategory)), strings.TrimSpace(body.Phone), nullIfEmpty(body.Email), body.Source, nullIfEmpty(body.Message), due, now, now)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "insert lead"})
		return
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO tasks (id, lead_id, reference_type, reference_id, title, description, type, status, priority, assignee, due_at, created_at, updated_at)
		VALUES ($1,$2,'LEAD',$2,$3,$4,'FOLLOW_UP','READY','HIGH','owner',$5,$6,$6)
	`, taskID, leadID, "Связаться с новым лидом", "Первичный контакт с новым лидом из формы сайта.", due, now)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "insert task"})
		return
	}

	payload, _ := json.Marshal(map[string]any{"source": body.Source})
	_, _ = tx.Exec(ctx, `
		INSERT INTO activity_log (id, entity_type, entity_id, action, payload, created_at)
		VALUES ($1,'lead',$2,'created',$3,$4)
	`, uuid.NewString(), leadID, payload, now)

	if err := tx.Commit(ctx); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "commit tx"})
		return
	}

	go a.notifyTelegram(body)

	writeJSON(w, http.StatusCreated, map[string]string{"id": leadID})
}

func (a *app) notifyTelegram(body any) {
	if a.botToken == "" || a.chatID == "" {
		return
	}
	b, _ := json.Marshal(body)
	payload := map[string]any{
		"chat_id": a.chatID,
		"text":    fmt.Sprintf("Новый лид в CRM: %s", string(b)),
	}
	buf, _ := json.Marshal(payload)
	_, _ = http.Post("https://api.telegram.org/bot"+a.botToken+"/sendMessage", "application/json", strings.NewReader(string(buf)))
}

func (a *app) handleListLeads(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query().Get("q")
	stage := strings.ToUpper(r.URL.Query().Get("stage"))
	owner := r.URL.Query().Get("owner")
	page := parseInt(r.URL.Query().Get("page"), 1)
	pageSize := parseInt(r.URL.Query().Get("pageSize"), 25)
	sortBy := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("sortBy")))
	sortDir := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("sortDir")))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 25
	}
	if pageSize > 200 {
		pageSize = 200
	}

	sortColumns := map[string]string{
		"createdat":    "created_at",
		"lastactivity": "last_activity_at",
		"name":         "name",
		"company":      "company",
		"stage":        "stage",
	}
	orderColumn, ok := sortColumns[sortBy]
	if !ok {
		orderColumn = "created_at"
	}
	if sortDir != "asc" {
		sortDir = "desc"
	}

	args := []any{}
	where := []string{"1=1"}
	if q != "" {
		args = append(args, "%"+q+"%")
		where = append(where, fmt.Sprintf("(name ILIKE $%d OR company ILIKE $%d OR phone ILIKE $%d)", len(args), len(args), len(args)))
	}
	if stage != "" {
		args = append(args, stage)
		where = append(where, fmt.Sprintf("stage = $%d", len(args)))
	}
	if owner != "" {
		args = append(args, owner)
		where = append(where, fmt.Sprintf("owner_name = $%d", len(args)))
	}

	totalQuery := fmt.Sprintf(`SELECT COUNT(*) FROM leads WHERE %s`, strings.Join(where, " AND "))
	var total int
	if err := a.db.QueryRow(ctx, totalQuery, args...).Scan(&total); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "count leads"})
		return
	}

	offset := (page - 1) * pageSize
	args = append(args, pageSize, offset)

	sqlText := fmt.Sprintf(`
		SELECT l.id, l.name, COALESCE(l.company, ''), COALESCE(l.company_category, 'OTHER'), COALESCE(l.company_subcategory, ''), l.phone, COALESCE(l.email, ''), l.source, l.stage, l.priority, l.owner_name,
		COALESCE(l.potential_value, 0),
		COALESCE(
		  (
		    SELECT h.changed_at
		    FROM lead_stage_history h
		    WHERE h.lead_id = l.id AND h.to_stage = l.stage
		    ORDER BY h.changed_at DESC
		    LIMIT 1
		  ),
		  l.created_at
		) AS stage_entered_at,
		l.last_activity_at, l.next_action_at, l.created_at
		FROM leads l
		WHERE %s
		ORDER BY %s %s
		LIMIT $%d OFFSET $%d
	`, strings.Join(where, " AND "), orderColumn, strings.ToUpper(sortDir), len(args)-1, len(args))

	rows, err := a.db.Query(ctx, sqlText, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query leads"})
		return
	}
	defer rows.Close()

	items := []lead{}
	for rows.Next() {
		var l lead
		var email string
		if err := rows.Scan(&l.ID, &l.Name, &l.Company, &l.CompanyCategory, &l.CompanySubcategory, &l.Phone, &email, &l.Source, &l.Stage, &l.Priority, &l.Owner, &l.PotentialValue, &l.StageEnteredAt, &l.LastActivityAt, &l.NextActionAt, &l.CreatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "scan lead"})
			return
		}
		if email != "" {
			l.Email = email
		}
		items = append(items, l)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items":    items,
		"page":     page,
		"pageSize": pageSize,
		"total":    total,
	})
}

func (a *app) handlePatchLead(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	type req struct {
		Owner          *string    `json:"owner"`
		Priority       *string    `json:"priority"`
		PotentialValue *float64   `json:"potentialValue"`
		NextActionAt   *time.Time `json:"nextActionAt"`
	}
	var body req
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}

	_, err := a.db.Exec(ctx, `
		UPDATE leads
		SET owner_name = COALESCE($2, owner_name),
			priority = COALESCE($3, priority),
			potential_value = COALESCE($4, potential_value),
			next_action_at = COALESCE($5, next_action_at),
			updated_at = NOW()
		WHERE id = $1
	`, id, body.Owner, body.Priority, body.PotentialValue, body.NextActionAt)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "update lead"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *app) handleDeleteLead(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	tx, err := a.db.Begin(ctx)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "begin tx"})
		return
	}
	defer tx.Rollback(ctx)

	result, err := tx.Exec(ctx, `DELETE FROM leads WHERE id = $1`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "delete lead"})
		return
	}
	if result.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "lead not found"})
		return
	}

	payload, _ := json.Marshal(map[string]string{"id": id})
	_, _ = tx.Exec(ctx, `
		INSERT INTO activity_log (id, entity_type, entity_id, action, payload, created_at)
		VALUES ($1,'lead',$2,'deleted',$3,NOW())
	`, uuid.NewString(), id, payload)

	if err := tx.Commit(ctx); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "commit"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *app) handleGetLeadDetails(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	var l lead
	var email string
	var notes sql.NullString
	err := a.db.QueryRow(ctx, `
		SELECT l.id, l.name, COALESCE(l.company, ''), COALESCE(l.company_category, 'OTHER'), COALESCE(l.company_subcategory, ''), l.phone, COALESCE(l.email, ''), l.source, l.stage, l.priority, l.owner_name,
		       COALESCE(l.potential_value, 0), COALESCE(l.message, ''),
		       COALESCE(
		         (
		           SELECT h.changed_at
		           FROM lead_stage_history h
		           WHERE h.lead_id = l.id AND h.to_stage = l.stage
		           ORDER BY h.changed_at DESC
		           LIMIT 1
		         ),
		         l.created_at
		       ) AS stage_entered_at,
		       l.last_activity_at, l.next_action_at, l.created_at
		FROM leads l
		WHERE l.id = $1
	`, id).Scan(&l.ID, &l.Name, &l.Company, &l.CompanyCategory, &l.CompanySubcategory, &l.Phone, &email, &l.Source, &l.Stage, &l.Priority, &l.Owner, &l.PotentialValue, &notes, &l.StageEnteredAt, &l.LastActivityAt, &l.NextActionAt, &l.CreatedAt)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "lead not found"})
		return
	}
	if email != "" {
		l.Email = email
	}

	rows, err := a.db.Query(ctx, `
		SELECT id, COALESCE(department, ''), COALESCE(full_name, ''), COALESCE(role, ''), COALESCE(phone, ''), COALESCE(email, ''), COALESCE(notes, '')
		FROM lead_contacts
		WHERE lead_id = $1
		ORDER BY sort_order ASC, created_at ASC
	`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "contacts query"})
		return
	}
	defer rows.Close()

	contacts := []leadContact{}
	for rows.Next() {
		var c leadContact
		if scanErr := rows.Scan(&c.ID, &c.Department, &c.FullName, &c.Role, &c.Phone, &c.Email, &c.Notes); scanErr == nil {
			contacts = append(contacts, c)
		}
	}

	historyRows, err := a.db.Query(ctx, `
		SELECT from_stage, to_stage, COALESCE(changed_by, ''), changed_at
		FROM lead_stage_history
		WHERE lead_id = $1
		ORDER BY changed_at ASC
	`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "history query"})
		return
	}
	defer historyRows.Close()

	stageHistory := []leadStageHistoryItem{}
	for historyRows.Next() {
		var item leadStageHistoryItem
		if scanErr := historyRows.Scan(&item.FromStage, &item.ToStage, &item.ChangedBy, &item.ChangedAt); scanErr == nil {
			stageHistory = append(stageHistory, item)
		}
	}

	taskRows, err := a.db.Query(ctx, `
		SELECT id, COALESCE(reference_type, 'WORK'), reference_id, title, COALESCE(description, ''), type, status, COALESCE(priority, 'MEDIUM'), due_at, created_at
		FROM tasks
		WHERE (reference_type IN ('LEAD','CLIENT') AND reference_id = $1)
		   OR lead_id = $1
		ORDER BY
			CASE status
				WHEN 'PLANNED' THEN 1
				WHEN 'READY' THEN 2
				WHEN 'IN_PROGRESS' THEN 3
				WHEN 'REVIEW' THEN 4
				WHEN 'DONE' THEN 5
				ELSE 99
			END,
			due_at NULLS LAST,
			created_at DESC
	`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "tasks query"})
		return
	}
	defer taskRows.Close()

	tasks := []task{}
	for taskRows.Next() {
		var t task
		if scanErr := taskRows.Scan(&t.ID, &t.ReferenceType, &t.ReferenceID, &t.Title, &t.Description, &t.Type, &t.Status, &t.Priority, &t.DueAt, &t.CreatedAt); scanErr == nil {
			tasks = append(tasks, t)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"lead":         l,
		"notes":        notes.String,
		"contacts":     contacts,
		"stageHistory": stageHistory,
		"tasks":        tasks,
	})
}

func (a *app) handlePatchLeadDetails(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	type contactReq struct {
		ID         string `json:"id"`
		Department string `json:"department"`
		FullName   string `json:"fullName"`
		Role       string `json:"role"`
		Phone      string `json:"phone"`
		Email      string `json:"email"`
		Notes      string `json:"notes"`
	}
	type req struct {
		Name               string       `json:"name"`
		Company            string       `json:"company"`
		CompanyCategory    string       `json:"companyCategory"`
		CompanySubcategory string       `json:"companySubcategory"`
		Phone              string       `json:"phone"`
		Email              string       `json:"email"`
		Notes              string       `json:"notes"`
		Contacts           []contactReq `json:"contacts"`
	}
	var body req
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if strings.TrimSpace(body.Name) == "" || strings.TrimSpace(body.Phone) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and phone are required"})
		return
	}

	tx, err := a.db.Begin(ctx)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "begin tx"})
		return
	}
	defer tx.Rollback(ctx)

	result, err := tx.Exec(ctx, `
		UPDATE leads
		SET name = $2,
		    company = $3,
		    company_category = $4,
		    company_subcategory = $5,
		    phone = $6,
		    email = $7,
		    message = $8,
		    last_activity_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1
	`, id, strings.TrimSpace(body.Name), nullIfEmpty(strings.TrimSpace(body.Company)), normalizeCompanyCategory(body.CompanyCategory), nullIfEmpty(strings.TrimSpace(body.CompanySubcategory)), strings.TrimSpace(body.Phone), nullIfEmpty(strings.TrimSpace(body.Email)), nullIfEmpty(strings.TrimSpace(body.Notes)))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "update lead details"})
		return
	}
	if result.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "lead not found"})
		return
	}

	if _, err = tx.Exec(ctx, `DELETE FROM lead_contacts WHERE lead_id = $1`, id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "clear contacts"})
		return
	}

	for idx, c := range body.Contacts {
		if strings.TrimSpace(c.Department) == "" &&
			strings.TrimSpace(c.FullName) == "" &&
			strings.TrimSpace(c.Role) == "" &&
			strings.TrimSpace(c.Phone) == "" &&
			strings.TrimSpace(c.Email) == "" &&
			strings.TrimSpace(c.Notes) == "" {
			continue
		}

		contactID := strings.TrimSpace(c.ID)
		if contactID == "" {
			contactID = uuid.NewString()
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO lead_contacts (id, lead_id, department, full_name, role, phone, email, notes, sort_order, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
		`, contactID, id, nullIfEmpty(strings.TrimSpace(c.Department)), nullIfEmpty(strings.TrimSpace(c.FullName)), nullIfEmpty(strings.TrimSpace(c.Role)), nullIfEmpty(strings.TrimSpace(c.Phone)), nullIfEmpty(strings.TrimSpace(c.Email)), nullIfEmpty(strings.TrimSpace(c.Notes)), idx)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "insert contact"})
			return
		}
	}

	payload, _ := json.Marshal(map[string]any{"contacts": len(body.Contacts)})
	_, _ = tx.Exec(ctx, `
		INSERT INTO activity_log (id, entity_type, entity_id, action, payload, created_at)
		VALUES ($1,'lead',$2,'details_updated',$3,NOW())
	`, uuid.NewString(), id, payload)

	if err = tx.Commit(ctx); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "commit tx"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *app) handlePatchStage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	type req struct {
		ToStage   string `json:"toStage"`
		ChangedBy string `json:"changedBy"`
	}
	var body req
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	body.ToStage = strings.ToUpper(strings.TrimSpace(body.ToStage))
	if stageOrder(body.ToStage) < 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid stage"})
		return
	}
	if strings.TrimSpace(body.ChangedBy) == "" {
		body.ChangedBy = "admin"
	}

	var currentStage string
	if err := a.db.QueryRow(ctx, `SELECT stage FROM leads WHERE id = $1`, id).Scan(&currentStage); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "lead not found"})
		return
	}

	tx, err := a.db.Begin(ctx)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "begin tx"})
		return
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		UPDATE leads
		SET stage = $2, last_activity_at = NOW(), updated_at = NOW()
		WHERE id = $1
	`, id, body.ToStage)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "update stage"})
		return
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO lead_stage_history (id, lead_id, from_stage, to_stage, changed_by, changed_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`, uuid.NewString(), id, currentStage, body.ToStage, body.ChangedBy)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "history"})
		return
	}

	payload, _ := json.Marshal(map[string]string{"from": currentStage, "to": body.ToStage})
	_, _ = tx.Exec(ctx, `
		INSERT INTO activity_log (id, entity_type, entity_id, action, payload, created_at)
		VALUES ($1,'lead',$2,'stage_changed',$3,NOW())
	`, uuid.NewString(), id, payload)

	if err := tx.Commit(ctx); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "commit"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *app) handleDashboard(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	period := strings.ToLower(r.URL.Query().Get("period"))
	if period == "" {
		period = "7d"
	}
	window := 7 * 24 * time.Hour
	if period == "30d" {
		window = 30 * 24 * time.Hour
	}
	now := time.Now().UTC()
	start := now.Add(-window)
	prevStart := start.Add(-window)

	newLeadsCurrent := scalarInt(ctx, a.db, `SELECT COUNT(*) FROM leads WHERE created_at >= $1`, start)
	newLeadsPrev := scalarInt(ctx, a.db, `SELECT COUNT(*) FROM leads WHERE created_at >= $1 AND created_at < $2`, prevStart, start)

	contactedCurrent := scalarInt(ctx, a.db, `SELECT COUNT(*) FROM lead_stage_history WHERE to_stage = 'CONTACTED' AND changed_at >= $1`, start)
	contactedPrev := scalarInt(ctx, a.db, `SELECT COUNT(*) FROM lead_stage_history WHERE to_stage = 'CONTACTED' AND changed_at >= $1 AND changed_at < $2`, prevStart, start)

	repliedCurrent := scalarInt(ctx, a.db, `SELECT COUNT(*) FROM lead_stage_history WHERE to_stage = 'REPLIED' AND changed_at >= $1`, start)
	repliedPrev := scalarInt(ctx, a.db, `SELECT COUNT(*) FROM lead_stage_history WHERE to_stage = 'REPLIED' AND changed_at >= $1 AND changed_at < $2`, prevStart, start)

	meetingsMtd := scalarInt(ctx, a.db, `SELECT COUNT(*) FROM tasks WHERE type = 'MEETING' AND status = 'DONE' AND updated_at >= date_trunc('month', NOW())`)
	meetingsPrev := scalarInt(ctx, a.db, `SELECT COUNT(*) FROM tasks WHERE type = 'MEETING' AND status = 'DONE' AND updated_at >= date_trunc('month', NOW() - interval '1 month') AND updated_at < date_trunc('month', NOW())`)

	overdueTasks := scalarInt(ctx, a.db, `SELECT COUNT(*) FROM tasks WHERE status <> 'DONE' AND due_at IS NOT NULL AND due_at < NOW()`)
	overduePrev := scalarInt(ctx, a.db, `SELECT COUNT(*) FROM tasks WHERE status <> 'DONE' AND due_at IS NOT NULL AND due_at < NOW() - interval '1 day'`)

	noActivity3d := scalarInt(ctx, a.db, `SELECT COUNT(*) FROM leads WHERE stage NOT IN ('WON','LOST') AND last_activity_at < NOW() - interval '3 day'`)
	noActivityPrev := scalarInt(ctx, a.db, `SELECT COUNT(*) FROM leads WHERE stage NOT IN ('WON','LOST') AND last_activity_at < NOW() - interval '6 day'`)

	trendDays := int(window.Hours()/24 + 0.5)
	if trendDays < 7 {
		trendDays = 7
	}

	newLeadsTrend := a.loadDailyTrend(ctx, `
		SELECT date_trunc('day', created_at) AS day, COUNT(*)
		FROM leads
		WHERE created_at >= $1
		GROUP BY 1
	`, start, trendDays)
	contactedTrend := a.loadDailyTrend(ctx, `
		SELECT date_trunc('day', changed_at) AS day, COUNT(*)
		FROM lead_stage_history
		WHERE changed_at >= $1 AND to_stage = 'CONTACTED'
		GROUP BY 1
	`, start, trendDays)
	repliedTrend := a.loadDailyTrend(ctx, `
		SELECT date_trunc('day', changed_at) AS day, COUNT(*)
		FROM lead_stage_history
		WHERE changed_at >= $1 AND to_stage = 'REPLIED'
		GROUP BY 1
	`, start, trendDays)
	meetingsTrend := a.loadDailyTrend(ctx, `
		SELECT date_trunc('day', updated_at) AS day, COUNT(*)
		FROM tasks
		WHERE updated_at >= $1 AND type = 'MEETING' AND status = 'DONE'
		GROUP BY 1
	`, start, trendDays)

	statusCounts := map[string]int{}
	rows, err := a.db.Query(ctx, `SELECT status, COUNT(*) FROM campaign_messages GROUP BY status`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var status string
			var count int
			if rows.Scan(&status, &count) == nil {
				statusCounts[strings.ToLower(status)] = count
			}
		}
	}
	sent := statusCounts["sent"] + statusCounts["delivered"] + statusCounts["replied"] + statusCounts["bounced"]
	delivered := statusCounts["delivered"] + statusCounts["replied"]
	replied := statusCounts["replied"]
	bounced := statusCounts["bounced"]
	unsubscribed := statusCounts["unsubscribed"]

	replyRate := rate(replied, sent)
	bounceRate := rate(bounced, sent)
	spamRisk := "GREEN"
	if bounceRate > 0.05 {
		spamRisk = "RED"
	}

	funnelStages := []string{"NEW", "CONTACTED", "REPLIED", "QUALIFIED"}
	funnel := make([]map[string]any, 0, len(funnelStages)+1)
	counts := make([]int, 0, len(funnelStages)+1)
	for _, stage := range funnelStages {
		cnt := scalarInt(ctx, a.db, `SELECT COUNT(*) FROM leads WHERE stage = $1`, stage)
		counts = append(counts, cnt)
	}
	counts = append(counts, meetingsMtd)
	labels := append(funnelStages, "MEETING")
	for i, stage := range labels {
		conv := any(nil)
		if i < len(labels)-1 && counts[i] > 0 {
			conv = float64(counts[i+1]) / float64(counts[i])
		}
		funnel = append(funnel, map[string]any{"stage": stage, "count": counts[i], "conversionToNext": conv})
	}

	criticalTasks := []task{}
	taskRows, err := a.db.Query(ctx, `
		SELECT id, COALESCE(reference_type, 'WORK'), reference_id, title, COALESCE(description, ''), type, status, COALESCE(priority, 'MEDIUM'), due_at, created_at
		FROM tasks
		WHERE status <> 'DONE'
		ORDER BY
			CASE COALESCE(priority, 'MEDIUM')
				WHEN 'BLOCKER' THEN -1
				WHEN 'CRITICAL' THEN 0
				WHEN 'HIGH' THEN 1
				WHEN 'MEDIUM' THEN 2
				WHEN 'LOW' THEN 3
				WHEN 'SOMEDAY' THEN 4
				ELSE 5
			END,
			CASE WHEN due_at IS NOT NULL AND due_at < NOW() THEN 0 ELSE 1 END,
			due_at NULLS LAST,
			created_at DESC
		LIMIT 10
	`)
	if err == nil {
		defer taskRows.Close()
		for taskRows.Next() {
			var t task
			if taskRows.Scan(&t.ID, &t.ReferenceType, &t.ReferenceID, &t.Title, &t.Description, &t.Type, &t.Status, &t.Priority, &t.DueAt, &t.CreatedAt) == nil {
				criticalTasks = append(criticalTasks, t)
			}
		}
	}

	topCampaigns := []map[string]any{}
	cRows, err := a.db.Query(ctx, `
		SELECT c.id, c.name,
		       COUNT(cm.*) FILTER (WHERE cm.status IN ('sent','delivered','replied','bounced')) AS sent_cnt,
		       COUNT(cm.*) FILTER (WHERE cm.status = 'replied') AS replied_cnt,
		       COUNT(cm.*) FILTER (WHERE cm.status = 'bounced') AS bounced_cnt
		FROM campaigns c
		LEFT JOIN campaign_messages cm ON cm.campaign_id = c.id
		GROUP BY c.id, c.name
		ORDER BY CASE
			WHEN COUNT(cm.*) FILTER (WHERE cm.status IN ('sent','delivered','replied','bounced')) = 0 THEN 0
			ELSE (COUNT(cm.*) FILTER (WHERE cm.status = 'replied')::float /
			      COUNT(cm.*) FILTER (WHERE cm.status IN ('sent','delivered','replied','bounced'))::float)
		END DESC
		LIMIT 3
	`)
	if err == nil {
		defer cRows.Close()
		for cRows.Next() {
			var id, name string
			var sentCnt, repliedCnt, bouncedCnt int
			if cRows.Scan(&id, &name, &sentCnt, &repliedCnt, &bouncedCnt) == nil {
				topCampaigns = append(topCampaigns, map[string]any{
					"id":         id,
					"name":       name,
					"replyRate":  rate(repliedCnt, sentCnt),
					"bounceRate": rate(bouncedCnt, sentCnt),
					"sent":       sentCnt,
				})
			}
		}
	}

	kpiCard := func(value, prev int, trend []int, href string) map[string]any {
		return map[string]any{
			"value": value,
			"delta": deltaPercent(value, prev),
			"trend": trend,
			"href":  href,
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"kpis": map[string]any{
			"newLeads7d":        kpiCard(newLeadsCurrent, newLeadsPrev, newLeadsTrend, "/leads?sortBy=createdAt&sortDir=desc"),
			"contacted7d":       kpiCard(contactedCurrent, contactedPrev, contactedTrend, "/leads?stage=CONTACTED"),
			"positiveReplies7d": kpiCard(repliedCurrent, repliedPrev, repliedTrend, "/leads?stage=REPLIED"),
			"meetingsMtd":       kpiCard(meetingsMtd, meetingsPrev, meetingsTrend, "/clients"),
			"overdueTasks":      kpiCard(overdueTasks, overduePrev, []int{overdueTasks}, "/"),
			"noActivity3d":      kpiCard(noActivity3d, noActivityPrev, []int{noActivity3d}, "/leads"),
		},
		"mailer": map[string]any{
			"sent":         sent,
			"delivered":    delivered,
			"replied":      replied,
			"bounced":      bounced,
			"unsubscribed": unsubscribed,
			"replyRate":    replyRate,
			"bounceRate":   bounceRate,
			"spamRisk":     spamRisk,
			"topCampaigns": topCampaigns,
		},
		"miniFunnel":    funnel,
		"criticalTasks": criticalTasks,
	})
}

func (a *app) handlePipeline(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	leads, err := a.fetchLeads(ctx, "")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "fetch leads"})
		return
	}

	type col struct {
		Stage           string  `json:"stage"`
		Count           int     `json:"count"`
		AvgHoursOnStage float64 `json:"avgHoursOnStage"`
		PotentialValue  float64 `json:"potentialValue"`
		Leads           []lead  `json:"leads"`
	}
	columns := map[string]*col{}
	for _, stage := range orderedStages {
		columns[stage] = &col{Stage: stage, Leads: []lead{}}
	}

	now := time.Now().UTC()
	for _, l := range leads {
		c := columns[l.Stage]
		if c == nil {
			continue
		}
		c.Count++
		c.PotentialValue += l.PotentialValue
		c.Leads = append(c.Leads, l)

		entered := l.CreatedAt
		if l.StageEnteredAt != nil {
			entered = *l.StageEnteredAt
		}
		c.AvgHoursOnStage += now.Sub(entered).Hours()
	}

	result := make([]col, 0, len(orderedStages))
	counts := make([]int, 0, len(orderedStages))
	for _, stage := range orderedStages {
		c := columns[stage]
		if c.Count > 0 {
			c.AvgHoursOnStage = c.AvgHoursOnStage / float64(c.Count)
		}
		result = append(result, *c)
		counts = append(counts, c.Count)
	}

	var bottleneck string
	minConv := 2.0
	for i := 0; i < len(orderedStages)-1; i++ {
		if counts[i] == 0 {
			continue
		}
		conv := float64(counts[i+1]) / float64(counts[i])
		if conv < minConv {
			minConv = conv
			bottleneck = orderedStages[i]
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"columns":         result,
		"bottleneckStage": nullIfEmptyString(bottleneck),
	})
}

func (a *app) handleClients(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := a.db.Query(ctx, `
		SELECT l.id, l.name, COALESCE(l.company,''), COALESCE(l.company_category, 'OTHER'), COALESCE(l.company_subcategory, ''), l.phone, COALESCE(l.email,''), l.source, l.stage, l.priority, l.owner_name,
		COALESCE(l.potential_value, 0),
		COALESCE(
		  (
		    SELECT h.changed_at
		    FROM lead_stage_history h
		    WHERE h.lead_id = l.id AND h.to_stage = l.stage
		    ORDER BY h.changed_at DESC
		    LIMIT 1
		  ),
		  l.created_at
		) AS stage_entered_at,
		l.last_activity_at, l.next_action_at, l.created_at
		FROM leads l
		WHERE l.stage IN ('SOURCING','PROPOSAL','NEGOTIATION','WON')
		ORDER BY l.updated_at DESC
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "clients query"})
		return
	}
	defer rows.Close()

	items := []lead{}
	for rows.Next() {
		var l lead
		var email string
		if err := rows.Scan(&l.ID, &l.Name, &l.Company, &l.CompanyCategory, &l.CompanySubcategory, &l.Phone, &email, &l.Source, &l.Stage, &l.Priority, &l.Owner, &l.PotentialValue, &l.StageEnteredAt, &l.LastActivityAt, &l.NextActionAt, &l.CreatedAt); err == nil {
			if email != "" {
				l.Email = email
			}
			items = append(items, l)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (a *app) fetchLeads(ctx context.Context, stage string) ([]lead, error) {
	query := `
		SELECT l.id, l.name, COALESCE(l.company,''), COALESCE(l.company_category, 'OTHER'), COALESCE(l.company_subcategory, ''), l.phone, COALESCE(l.email,''), l.source, l.stage, l.priority, l.owner_name,
		COALESCE(l.potential_value, 0),
		COALESCE(
		  (
		    SELECT h.changed_at
		    FROM lead_stage_history h
		    WHERE h.lead_id = l.id AND h.to_stage = l.stage
		    ORDER BY h.changed_at DESC
		    LIMIT 1
		  ),
		  l.created_at
		) AS stage_entered_at,
		l.last_activity_at, l.next_action_at, l.created_at
		FROM leads l
	`
	args := []any{}
	if stage != "" {
		query += " WHERE l.stage = $1"
		args = append(args, stage)
	}
	query += " ORDER BY l.created_at DESC"
	rows, err := a.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []lead{}
	for rows.Next() {
		var l lead
		var email string
		if err := rows.Scan(&l.ID, &l.Name, &l.Company, &l.CompanyCategory, &l.CompanySubcategory, &l.Phone, &email, &l.Source, &l.Stage, &l.Priority, &l.Owner, &l.PotentialValue, &l.StageEnteredAt, &l.LastActivityAt, &l.NextActionAt, &l.CreatedAt); err != nil {
			return nil, err
		}
		if email != "" {
			l.Email = email
		}
		items = append(items, l)
	}
	return items, nil
}

func (a *app) handleListTasks(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	criticalOnly := r.URL.Query().Get("critical") == "1"
	referenceType := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("referenceType")))
	referenceID := strings.TrimSpace(r.URL.Query().Get("referenceId"))

	query := `SELECT id, COALESCE(reference_type, 'WORK'), reference_id, title, COALESCE(description, ''), type, status, COALESCE(priority, 'MEDIUM'), due_at, created_at FROM tasks`
	conditions := []string{}
	args := []any{}
	argIdx := 1
	if criticalOnly {
		conditions = append(conditions, `status <> 'DONE' AND (due_at < NOW() OR due_at IS NULL)`)
	}
	if referenceType != "" {
		if _, ok := taskReferenceTypes[referenceType]; !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid referenceType"})
			return
		}
		conditions = append(conditions, fmt.Sprintf("reference_type = $%d", argIdx))
		args = append(args, referenceType)
		argIdx++
	}
	if referenceID != "" {
		conditions = append(conditions, fmt.Sprintf("reference_id = $%d", argIdx))
		args = append(args, referenceID)
		argIdx++
	}
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += ` ORDER BY
		CASE status
			WHEN 'PLANNED' THEN 1
			WHEN 'READY' THEN 2
			WHEN 'IN_PROGRESS' THEN 3
			WHEN 'REVIEW' THEN 4
			WHEN 'DONE' THEN 5
			ELSE 99
		END,
		CASE COALESCE(priority, 'MEDIUM')
			WHEN 'BLOCKER' THEN -1
			WHEN 'CRITICAL' THEN 0
			WHEN 'HIGH' THEN 1
			WHEN 'MEDIUM' THEN 2
			WHEN 'LOW' THEN 3
			WHEN 'SOMEDAY' THEN 4
			ELSE 5
		END,
		due_at NULLS LAST,
		created_at DESC
		LIMIT 500`

	rows, err := a.db.Query(ctx, query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "tasks query"})
		return
	}
	defer rows.Close()

	items := []task{}
	for rows.Next() {
		var t task
		if err := rows.Scan(&t.ID, &t.ReferenceType, &t.ReferenceID, &t.Title, &t.Description, &t.Type, &t.Status, &t.Priority, &t.DueAt, &t.CreatedAt); err == nil {
			items = append(items, t)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (a *app) handleCreateTask(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	type req struct {
		LeadID        *string    `json:"leadId"`
		ReferenceType string     `json:"referenceType"`
		ReferenceID   *string    `json:"referenceId"`
		Title         string     `json:"title"`
		Description   string     `json:"description"`
		Type          string     `json:"type"`
		Status        string     `json:"status"`
		Priority      string     `json:"priority"`
		Assignee      string     `json:"assignee"`
		DueAt         *time.Time `json:"dueAt"`
	}
	var body req
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if strings.TrimSpace(body.Title) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title required"})
		return
	}
	body.ReferenceType = strings.ToUpper(strings.TrimSpace(body.ReferenceType))
	if body.ReferenceType == "" {
		body.ReferenceType = "WORK"
	}
	if body.ReferenceID == nil && body.LeadID != nil {
		body.ReferenceType = "LEAD"
		body.ReferenceID = body.LeadID
	}
	if _, ok := taskReferenceTypes[body.ReferenceType]; !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid referenceType"})
		return
	}
	if body.ReferenceType != "WORK" && (body.ReferenceID == nil || strings.TrimSpace(*body.ReferenceID) == "") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "referenceId required for linked task"})
		return
	}
	if body.Type == "" {
		body.Type = "OTHER"
	}
	body.Type = strings.ToUpper(strings.TrimSpace(body.Type))
	body.Status = strings.ToUpper(strings.TrimSpace(body.Status))
	if body.Status == "" {
		body.Status = "PLANNED"
	}
	if _, ok := taskStatusSet[body.Status]; !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid task status"})
		return
	}
	body.Priority = strings.ToUpper(strings.TrimSpace(body.Priority))
	if body.Priority == "" {
		body.Priority = "MEDIUM"
	}
	if _, ok := taskPrioritySet[body.Priority]; !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid task priority"})
		return
	}
	if body.Assignee == "" {
		body.Assignee = "owner"
	}
	id := uuid.NewString()
	_, err := a.db.Exec(ctx, `
		INSERT INTO tasks (id, lead_id, reference_type, reference_id, title, description, type, status, priority, assignee, due_at, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
	`, id, body.LeadID, body.ReferenceType, nullIfEmpty(nonEmptyPtrValue(body.ReferenceID)), strings.TrimSpace(body.Title), nullIfEmpty(strings.TrimSpace(body.Description)), body.Type, body.Status, body.Priority, body.Assignee, body.DueAt)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "create task"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (a *app) handlePatchTask(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	type req struct {
		Title         *string    `json:"title"`
		Description   *string    `json:"description"`
		Type          *string    `json:"type"`
		Status        *string    `json:"status"`
		Priority      *string    `json:"priority"`
		DueAt         *time.Time `json:"dueAt"`
		ReferenceType *string    `json:"referenceType"`
		ReferenceID   *string    `json:"referenceId"`
	}
	var body req
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}

	if body.Status != nil {
		status := strings.ToUpper(strings.TrimSpace(*body.Status))
		if _, ok := taskStatusSet[status]; !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid task status"})
			return
		}
		body.Status = &status
	}

	if body.Type != nil {
		taskType := strings.ToUpper(strings.TrimSpace(*body.Type))
		if taskType == "" {
			taskType = "OTHER"
		}
		body.Type = &taskType
	}

	if body.ReferenceType != nil {
		refType := strings.ToUpper(strings.TrimSpace(*body.ReferenceType))
		if _, ok := taskReferenceTypes[refType]; !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid referenceType"})
			return
		}
		body.ReferenceType = &refType
		if refType != "WORK" && (body.ReferenceID == nil || strings.TrimSpace(*body.ReferenceID) == "") {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "referenceId required for linked task"})
			return
		}
	}
	if body.Priority != nil {
		priority := strings.ToUpper(strings.TrimSpace(*body.Priority))
		if _, ok := taskPrioritySet[priority]; !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid task priority"})
			return
		}
		body.Priority = &priority
	}

	var normalizedReferenceID any
	if body.ReferenceID != nil {
		normalizedReferenceID = nullIfEmpty(strings.TrimSpace(*body.ReferenceID))
	}

	_, err := a.db.Exec(ctx, `
		UPDATE tasks
		SET title = COALESCE($2, title),
			status = COALESCE($3, status),
			due_at = COALESCE($4, due_at),
			description = COALESCE($5, description),
			type = COALESCE($6, type),
			reference_type = COALESCE($7, reference_type),
			reference_id = COALESCE($8, reference_id),
			priority = COALESCE($9, priority),
			updated_at = NOW()
		WHERE id = $1
	`, id, body.Title, body.Status, body.DueAt, body.Description, body.Type, body.ReferenceType, normalizedReferenceID, body.Priority)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "patch task"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *app) handleDeleteTask(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	result, err := a.db.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "delete task"})
		return
	}
	if result.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "task not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *app) handleListTaskComments(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	taskID := chi.URLParam(r, "id")

	rows, err := a.db.Query(ctx, `
		SELECT id, task_id, COALESCE(author, 'Система'), body, created_at
		FROM task_comments
		WHERE task_id = $1
		ORDER BY created_at ASC
	`, taskID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "task comments query"})
		return
	}
	defer rows.Close()

	items := []taskComment{}
	for rows.Next() {
		var c taskComment
		if scanErr := rows.Scan(&c.ID, &c.TaskID, &c.Author, &c.Body, &c.CreatedAt); scanErr == nil {
			items = append(items, c)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (a *app) handleCreateTaskComment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	taskID := chi.URLParam(r, "id")

	type req struct {
		Author string `json:"author"`
		Body   string `json:"body"`
	}
	var body req
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	commentBody := strings.TrimSpace(body.Body)
	if commentBody == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "comment body required"})
		return
	}
	author := strings.TrimSpace(body.Author)
	if author == "" {
		author = "Пользователь"
	}

	var exists bool
	if err := a.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1)`, taskID).Scan(&exists); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "task lookup failed"})
		return
	}
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "task not found"})
		return
	}

	commentID := uuid.NewString()
	_, err := a.db.Exec(ctx, `
		INSERT INTO task_comments (id, task_id, author, body, created_at)
		VALUES ($1,$2,$3,$4,NOW())
	`, commentID, taskID, author, commentBody)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "create task comment"})
		return
	}

	_, _ = a.db.Exec(ctx, `UPDATE tasks SET updated_at = NOW() WHERE id = $1`, taskID)
	writeJSON(w, http.StatusCreated, map[string]string{"id": commentID})
}

func (a *app) handleListCampaigns(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := a.db.Query(ctx, `SELECT id, name, status, COALESCE(subject,''), COALESCE(body,''), created_by, created_at FROM campaigns ORDER BY created_at DESC`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "campaigns query"})
		return
	}
	defer rows.Close()
	items := []campaign{}
	for rows.Next() {
		var c campaign
		if err := rows.Scan(&c.ID, &c.Name, &c.Status, &c.Subject, &c.Body, &c.CreatedBy, &c.CreatedAt); err == nil {
			items = append(items, c)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (a *app) handleCreateCampaign(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	type req struct {
		Name      string `json:"name"`
		Subject   string `json:"subject"`
		Body      string `json:"body"`
		CreatedBy string `json:"createdBy"`
	}
	var body req
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name required"})
		return
	}
	if body.CreatedBy == "" {
		body.CreatedBy = "owner"
	}
	id := uuid.NewString()
	_, err := a.db.Exec(ctx, `
		INSERT INTO campaigns (id, name, status, subject, body, created_by, created_at, updated_at)
		VALUES ($1,$2,'DRAFT',$3,$4,$5,NOW(),NOW())
	`, id, body.Name, body.Subject, body.Body, body.CreatedBy)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "create campaign"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (a *app) handleStartCampaign(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	type req struct {
		LeadIDs []string `json:"leadIds"`
	}
	var startReq req
	if err := json.NewDecoder(r.Body).Decode(&startReq); err != nil && !errors.Is(err, io.EOF) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}

	tx, err := a.db.Begin(ctx)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "begin"})
		return
	}
	defer tx.Rollback(ctx)

	var subject, body string
	if err := tx.QueryRow(ctx, `SELECT COALESCE(subject,''), COALESCE(body,'') FROM campaigns WHERE id = $1`, id).Scan(&subject, &body); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "campaign not found"})
		return
	}

	leadSelect := `
		SELECT id
		FROM leads
		WHERE stage IN ('QUALIFIED','SOURCING','PROPOSAL','NEGOTIATION')
		  AND email IS NOT NULL AND email <> ''
	`
	args := []any{}
	if len(startReq.LeadIDs) > 0 {
		leadSelect = `
			SELECT id
			FROM leads
			WHERE id = ANY($1::text[])
			  AND stage IN ('QUALIFIED','SOURCING','PROPOSAL','NEGOTIATION')
			  AND email IS NOT NULL AND email <> ''
		`
		args = append(args, startReq.LeadIDs)
	}
	rows, err := tx.Query(ctx, leadSelect, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "select leads"})
		return
	}

	leadIDs := make([]string, 0, 256)
	for rows.Next() {
		var leadID string
		if err := rows.Scan(&leadID); err != nil {
			continue
		}
		leadIDs = append(leadIDs, leadID)
	}
	rows.Close()
	if rows.Err() != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "scan leads"})
		return
	}

	count := 0
	for _, leadID := range leadIDs {
		tag, err := tx.Exec(ctx, `
			INSERT INTO campaign_messages (id, campaign_id, lead_id, step, status, subject, body, updated_at)
			VALUES ($1,$2,$3,1,'queued',$4,$5,NOW())
			ON CONFLICT (campaign_id, lead_id, step) DO NOTHING
		`, uuid.NewString(), id, leadID, subject, body)
		if err != nil {
			log.Printf("campaign start insert failed campaign=%s lead=%s: %v", id, leadID, err)
			continue
		}
		count += int(tag.RowsAffected())
	}

	_, _ = tx.Exec(ctx, `UPDATE campaigns SET status = 'RUNNING', updated_at = NOW() WHERE id = $1`, id)

	if err := tx.Commit(ctx); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "commit"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "queued": count})
}

func (a *app) handleCampaignStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	rows, err := a.db.Query(ctx, `SELECT status, COUNT(*) FROM campaign_messages WHERE campaign_id = $1 GROUP BY status`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "campaign stats"})
		return
	}
	defer rows.Close()

	statusCounts := map[string]int{}
	for rows.Next() {
		var status string
		var count int
		if rows.Scan(&status, &count) == nil {
			statusCounts[strings.ToLower(status)] = count
		}
	}

	sent := statusCounts["sent"] + statusCounts["delivered"] + statusCounts["replied"] + statusCounts["bounced"]
	delivered := statusCounts["delivered"] + statusCounts["replied"]
	replied := statusCounts["replied"]
	bounced := statusCounts["bounced"]

	writeJSON(w, http.StatusOK, map[string]any{
		"sent":       sent,
		"delivered":  delivered,
		"replied":    replied,
		"bounced":    bounced,
		"replyRate":  rate(replied, sent),
		"bounceRate": rate(bounced, sent),
	})
}

func (a *app) handleCampaignMessages(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	campaignID := chi.URLParam(r, "id")
	limit := parseInt(r.URL.Query().Get("limit"), 200)

	rows, err := a.db.Query(ctx, `
		SELECT cm.id, cm.campaign_id, cm.lead_id, l.name, COALESCE(l.email, ''), cm.status, cm.step, COALESCE(cm.message_id, ''), cm.sent_at
		FROM campaign_messages cm
		JOIN leads l ON l.id = cm.lead_id
		WHERE cm.campaign_id = $1
		ORDER BY cm.updated_at DESC
		LIMIT $2
	`, campaignID, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "campaign messages query"})
		return
	}
	defer rows.Close()

	items := []campaignMessage{}
	for rows.Next() {
		var item campaignMessage
		if err := rows.Scan(&item.ID, &item.CampaignID, &item.LeadID, &item.LeadName, &item.LeadEmail, &item.Status, &item.Step, &item.MessageID, &item.SentAt); err == nil {
			items = append(items, item)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (a *app) handlePatchCampaignMessageStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	type req struct {
		Status string         `json:"status"`
		Raw    map[string]any `json:"raw"`
	}
	var body req
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}

	status := strings.ToLower(strings.TrimSpace(body.Status))
	switch status {
	case "sent", "delivered", "replied", "bounced", "unsubscribed":
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid status"})
		return
	}

	var messageID string
	err := a.db.QueryRow(ctx, `
		UPDATE campaign_messages
		SET status = $2, updated_at = NOW(), sent_at = CASE WHEN sent_at IS NULL AND $2 IN ('sent','delivered','replied','bounced') THEN NOW() ELSE sent_at END
		WHERE id = $1
		RETURNING COALESCE(message_id, '')
	`, id, status).Scan(&messageID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "campaign message not found"})
		return
	}

	rawJSON, _ := json.Marshal(body.Raw)
	_, _ = a.db.Exec(ctx, `
		INSERT INTO email_events (id, message_id, event_type, ts, raw)
		VALUES ($1, $2, $3, NOW(), $4)
	`, uuid.NewString(), nonEmptyOrFallback(messageID, id), strings.ToUpper(status), rawJSON)

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *app) handleIngestEmailEvent(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	expected := os.Getenv("WEBHOOK_TOKEN")
	if expected != "" && r.Header.Get("X-Webhook-Token") != expected {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid webhook token"})
		return
	}

	type req struct {
		MessageID string         `json:"messageId"`
		EventType string         `json:"eventType"`
		Raw       map[string]any `json:"raw"`
	}
	var body req
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}

	eventType := strings.ToUpper(strings.TrimSpace(body.EventType))
	if body.MessageID == "" || eventType == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "messageId and eventType required"})
		return
	}

	rawJSON, _ := json.Marshal(body.Raw)
	_, _ = a.db.Exec(ctx, `
		INSERT INTO email_events (id, message_id, event_type, ts, raw)
		VALUES ($1, $2, $3, NOW(), $4)
	`, uuid.NewString(), body.MessageID, eventType, rawJSON)

	status := mapEventToCampaignStatus(eventType)
	if status != "" {
		_, _ = a.db.Exec(ctx, `
			UPDATE campaign_messages
			SET status = $2, updated_at = NOW(),
			    sent_at = CASE WHEN sent_at IS NULL AND $2 IN ('sent','delivered','replied','bounced') THEN NOW() ELSE sent_at END
			WHERE message_id = $1
		`, body.MessageID, status)
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func rate(num, denom int) float64 {
	if denom <= 0 {
		return 0
	}
	return float64(num) / float64(denom)
}

func scalarInt(ctx context.Context, db *pgxpool.Pool, q string, args ...any) int {
	var out int
	if err := db.QueryRow(ctx, q, args...).Scan(&out); err != nil {
		return 0
	}
	return out
}

func parseInt(raw string, fallback int) int {
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v <= 0 {
		return fallback
	}
	return v
}

func nullIfEmpty(v string) any {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return strings.TrimSpace(v)
}

func nonEmptyPtrValue(v *string) string {
	if v == nil {
		return ""
	}
	return strings.TrimSpace(*v)
}

func normalizeCompanyCategory(v string) string {
	candidate := strings.ToUpper(strings.TrimSpace(v))
	if candidate == "" {
		return "OTHER"
	}
	if _, ok := allowedCompanyCategories[candidate]; !ok {
		return "OTHER"
	}
	return candidate
}

func nullIfEmptyString(v string) any {
	if v == "" {
		return nil
	}
	return v
}

func nonEmptyOrFallback(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}

func mapEventToCampaignStatus(eventType string) string {
	switch strings.ToUpper(strings.TrimSpace(eventType)) {
	case "SENT":
		return "sent"
	case "DELIVERED":
		return "delivered"
	case "REPLIED", "REPLY":
		return "replied"
	case "BOUNCED", "BOUNCE":
		return "bounced"
	case "UNSUBSCRIBED", "UNSUBSCRIBE":
		return "unsubscribed"
	default:
		return ""
	}
}

func deltaPercent(current, prev int) float64 {
	if prev <= 0 {
		if current > 0 {
			return 1
		}
		return 0
	}
	return float64(current-prev) / float64(prev)
}

func (a *app) loadDailyTrend(ctx context.Context, query string, start time.Time, days int) []int {
	result := make([]int, days)
	indexByDay := map[string]int{}
	base := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	for i := 0; i < days; i++ {
		day := base.Add(time.Duration(i) * 24 * time.Hour).Format("2006-01-02")
		indexByDay[day] = i
	}

	rows, err := a.db.Query(ctx, query, start)
	if err != nil {
		return result
	}
	defer rows.Close()

	for rows.Next() {
		var day time.Time
		var count int
		if rows.Scan(&day, &count) == nil {
			key := day.UTC().Format("2006-01-02")
			if idx, ok := indexByDay[key]; ok {
				result[idx] = count
			}
		}
	}

	return result
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func mustParseURL(raw string) *url.URL {
	u, err := url.Parse(raw)
	if err != nil {
		panic(err)
	}
	return u
}

func sanitizeStage(stage string) (string, error) {
	stage = strings.ToUpper(strings.TrimSpace(stage))
	if stageOrder(stage) == -1 {
		return "", errors.New("invalid stage")
	}
	return stage, nil
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func sqlNullTime(t *time.Time) sql.NullTime {
	if t == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *t, Valid: true}
}
