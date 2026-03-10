"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lead, LeadContact, LeadStage } from "@/types/crm";
import { getClients, getLeadDetails, updateLead, updateLeadDetails, updateLeadStage } from "@/lib/api";
import { leadStageLabel } from "@/lib/labels";

const stageOptions: LeadStage[] = [
  "NEW",
  "CONTACTED",
  "REPLIED",
  "QUALIFIED",
  "SOURCING",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST"
];

type ClientEditorState = {
  lead: Lead;
  contacts: LeadContact[];
  notes: string;
  stage: LeadStage;
  nextActionAt: string;
  commentDate: string;
  newComment: string;
  initialStage: LeadStage;
  initialNextActionAt: string;
  initialNotes: string;
};

function toDateTimeLocal(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function formatCommentDate(value: string): string {
  if (!value) return new Date().toLocaleDateString("ru-RU");
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

export default function ClientsPage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<ClientEditorState | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadClients() {
    setLoading(true);
    try {
      const data = await getClients();
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadClients();
  }, []);

  async function openEditor(leadId: string) {
    setDetailsLoading(true);
    setError(null);
    try {
      const data = await getLeadDetails(leadId);
      const nextActionAt = toDateTimeLocal(data.lead.nextActionAt);
      setEditor({
        lead: data.lead,
        contacts: data.contacts ?? [],
        notes: data.notes ?? "",
        stage: data.lead.stage,
        nextActionAt,
        commentDate: new Date().toISOString().slice(0, 10),
        newComment: "",
        initialStage: data.lead.stage,
        initialNextActionAt: nextActionAt,
        initialNotes: data.notes ?? ""
      });
    } catch {
      setError("Не удалось открыть карточку клиента.");
      setEditor(null);
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeEditor() {
    setEditor(null);
    setDetailsLoading(false);
    setSaving(false);
    setError(null);
  }

  function addComment() {
    setEditor((prev) => {
      if (!prev) return prev;
      const text = prev.newComment.trim();
      if (!text) return prev;
      const entry = `${formatCommentDate(prev.commentDate)} — ${text}`;
      const nextNotes = prev.notes.trim() ? `${prev.notes.trim()}\n${entry}` : entry;
      return { ...prev, notes: nextNotes, newComment: "" };
    });
  }

  async function saveChanges() {
    if (!editor) return;
    if (!editor.lead.name.trim() || !editor.lead.phone.trim()) {
      setError("Для сохранения должны быть заполнены имя и телефон.");
      return;
    }
    if (!editor.nextActionAt && editor.initialNextActionAt) {
      setError("Очистка поля «Следующее действие» пока не поддерживается. Поставь новую дату/время.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editor.stage !== editor.initialStage) {
        await updateLeadStage(editor.lead.id, editor.stage);
      }

      if (editor.nextActionAt && editor.nextActionAt !== editor.initialNextActionAt) {
        await updateLead(editor.lead.id, { nextActionAt: new Date(editor.nextActionAt).toISOString() });
      }

      if (editor.notes.trim() !== editor.initialNotes.trim()) {
        await updateLeadDetails(editor.lead.id, {
          name: editor.lead.name,
          company: editor.lead.company,
          companyCategory: editor.lead.companyCategory,
          companySubcategory: editor.lead.companySubcategory,
          phone: editor.lead.phone,
          email: editor.lead.email,
          notes: editor.notes,
          contacts: editor.contacts.map((contact) => ({
            id: contact.id,
            department: contact.department,
            fullName: contact.fullName,
            role: contact.role,
            phone: contact.phone,
            email: contact.email,
            notes: contact.notes
          }))
        });
      }

      await loadClients();
      await openEditor(editor.lead.id);
    } catch {
      setError("Не удалось сохранить изменения клиента.");
    } finally {
      setSaving(false);
    }
  }

  const comments = useMemo(
    () => (editor?.notes ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    [editor?.notes]
  );

  return (
    <div>
      <h2>Клиенты (этап Подбор и выше)</h2>
      <section className="card">
        {loading ? (
          <p>Загрузка...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Компания</th>
                <th>Контакт</th>
                <th>Этап</th>
                <th>Следующее действие</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {items.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.company || "—"}</td>
                  <td>{lead.name}</td>
                  <td>{leadStageLabel(lead.stage)}</td>
                  <td>{lead.nextActionAt ? new Date(lead.nextActionAt).toLocaleString("ru-RU") : "—"}</td>
                  <td>
                    <button type="button" onClick={() => void openEditor(lead.id)}>Редактировать</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editor ? (
        <div className="modal-backdrop" onClick={closeEditor}>
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Карточка клиента</h3>
              <button type="button" onClick={closeEditor}>Закрыть</button>
            </div>

            {detailsLoading ? <p>Загрузка данных клиента...</p> : null}
            {error ? <p className="bad">{error}</p> : null}

            <div className="modal-content">
              <div className="grid two">
                <label>
                  Компания
                  <input value={editor.lead.company} readOnly />
                </label>
                <label>
                  Контакт
                  <input value={editor.lead.name} readOnly />
                </label>
                <label>
                  Этап
                  <select
                    value={editor.stage}
                    onChange={(e) => setEditor((prev) => prev ? { ...prev, stage: e.target.value as LeadStage } : prev)}
                  >
                    {stageOptions.map((stage) => (
                      <option key={stage} value={stage}>{leadStageLabel(stage)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Следующее действие
                  <input
                    type="datetime-local"
                    value={editor.nextActionAt}
                    onChange={(e) => setEditor((prev) => prev ? { ...prev, nextActionAt: e.target.value } : prev)}
                  />
                </label>
              </div>

              <section className="card">
                <h4>Добавить комментарий</h4>
                <div className="grid two" style={{ marginBottom: 8 }}>
                  <label>
                    Дата комментария
                    <input
                      type="date"
                      value={editor.commentDate}
                      onChange={(e) => setEditor((prev) => prev ? { ...prev, commentDate: e.target.value } : prev)}
                    />
                  </label>
                </div>
                <label>
                  Текст комментария
                  <textarea
                    value={editor.newComment}
                    onChange={(e) => setEditor((prev) => prev ? { ...prev, newComment: e.target.value } : prev)}
                    placeholder="Например: ждем ответа от клиента"
                    style={{ minHeight: 90 }}
                  />
                </label>
                <div className="modal-actions" style={{ marginTop: 8 }}>
                  <button type="button" onClick={addComment}>Добавить в историю</button>
                </div>
              </section>

              <section className="card">
                <h4>История комментариев</h4>
                {comments.length ? (
                  <ul className="comments-list">
                    {[...comments].reverse().map((line, index) => (
                      <li key={`${line}-${index}`}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Комментариев пока нет.</p>
                )}
              </section>

              <div className="modal-actions">
                <button type="button" onClick={closeEditor}>Отмена</button>
                <button type="button" disabled={saving} onClick={() => void saveChanges()}>
                  {saving ? "Сохраняем..." : "Сохранить изменения"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
