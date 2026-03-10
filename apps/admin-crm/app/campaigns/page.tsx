"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Campaign, CampaignMessage, CampaignStats } from "@/lib/api";
import {
  createCampaign,
  getCampaignMessages,
  getCampaigns,
  getCampaignStats,
  patchCampaignMessageStatus,
  startCampaign
} from "@/lib/api";
import { campaignStatusLabel, messageStatusLabel } from "@/lib/labels";

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export default function CampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [messages, setMessages] = useState<CampaignMessage[]>([]);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const loadCampaigns = useCallback(async () => {
    const data = await getCampaigns();
    setItems(data.items);
    if (!selectedId && data.items.length > 0) {
      setSelectedId(data.items[0].id);
    }
  }, [selectedId]);

  async function loadDetails(id: string) {
    if (!id) return;
    const [statsData, messageData] = await Promise.all([getCampaignStats(id), getCampaignMessages(id)]);
    setStats(statsData);
    setMessages(messageData.items);
  }

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (selectedId) {
      void loadDetails(selectedId);
    }
  }, [selectedId]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const response = await createCampaign({ name, subject, body, createdBy: "владелец" });
    setName("");
    setSubject("");
    setBody("");
    await loadCampaigns();
    setSelectedId(response.id);
    await loadDetails(response.id);
  }

  async function onStart() {
    if (!selectedId) return;
    await startCampaign(selectedId);
    await loadCampaigns();
    await loadDetails(selectedId);
  }

  async function markMessage(id: string, status: "replied" | "bounced" | "unsubscribed" | "delivered") {
    await patchCampaignMessageStatus(id, status);
    if (selectedId) {
      await loadDetails(selectedId);
    }
  }

  const selected = useMemo(() => items.find((i) => i.id === selectedId), [items, selectedId]);

  return (
    <div>
      <h2>Рассылки</h2>
      <section className="in-dev-banner" role="note" aria-label="Экран в разработке">
        <strong>Еще в разработке</strong>
        <span>Экран рассылок в активной доработке. Возможны изменения логики и интерфейса.</span>
      </section>

      <form className="card" onSubmit={onCreate} style={{ marginBottom: 12 }}>
        <h3>Создать рассылку</h3>
        <div className="grid two">
          <input placeholder="Название рассылки" required value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Тема письма" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <textarea
          style={{ width: "100%", marginTop: 8, minHeight: 100 }}
          placeholder="Текст письма"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button type="submit" style={{ marginTop: 8 }}>Создать</button>
      </form>

      <section className="card" style={{ marginBottom: 12 }}>
        <h3>Список рассылок</h3>
        <div className="inline-actions">
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">Выбери рассылку</option>
            {items.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.name} ({campaignStatusLabel(campaign.status)})</option>
            ))}
          </select>
          <button disabled={!selectedId} onClick={() => void onStart()}>Запустить</button>
        </div>
        {selected ? <p className="muted">Выбрано: {selected.name} / {campaignStatusLabel(selected.status)}</p> : null}
      </section>

      <section className="grid two">
        <article className="card">
          <h3>Статистика</h3>
          {stats ? (
            <>
              <p>Отправлено: {stats.sent}</p>
              <p>Доставлено: {stats.delivered}</p>
              <p>Ответов: {stats.replied}</p>
              <p>Возвратов: {stats.bounced}</p>
              <p>Доля ответов: {pct(stats.replyRate)}</p>
              <p>Доля возвратов: {pct(stats.bounceRate)}</p>
            </>
          ) : (
            <p>Выбери рассылку</p>
          )}
        </article>

        <article className="card">
          <h3>Статусы сообщений</h3>
          <table>
            <thead>
              <tr>
                <th>Лид</th>
                <th>Email</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message.id}>
                  <td>{message.leadName}</td>
                  <td>{message.leadEmail || "—"}</td>
                  <td>{messageStatusLabel(message.status)}</td>
                  <td className="table-actions">
                    <button onClick={() => void markMessage(message.id, "replied")}>Ответ</button>
                    <button onClick={() => void markMessage(message.id, "bounced")}>Возврат</button>
                    <button onClick={() => void markMessage(message.id, "unsubscribed")}>Отписка</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>
    </div>
  );
}
