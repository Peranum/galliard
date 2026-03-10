"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Lead, LeadContact } from "@/types/crm";
import { createLead, getLeadDetails, getLeads, updateLeadDetails, updateLeadStage } from "@/lib/api";
import { leadStageLabel } from "@/lib/labels";
import {
  companyCategoryLabel,
  companyCategoryOptions,
  companySubcategoryLabel,
  companySubcategoryOptions
} from "@/lib/company-categories";

const stageOptions = ["", "NEW", "CONTACTED", "REPLIED", "QUALIFIED", "SOURCING", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
const stageValues = stageOptions.filter((stage): stage is Exclude<(typeof stageOptions)[number], ""> => Boolean(stage));

type LeadFormState = {
  name: string;
  company: string;
  companyCategory: string;
  companySubcategory: string;
  phone: string;
  email: string;
  notes: string;
  contacts: LeadContact[];
};

function emptyContact(): LeadContact {
  return {
    id: "",
    department: "",
    fullName: "",
    role: "",
    phone: "",
    email: "",
    notes: ""
  };
}

export default function LeadsPage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<(typeof stageOptions)[number]>("");
  const [sortBy, setSortBy] = useState<"createdAt" | "lastActivity" | "name" | "company" | "stage">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [companyCategory, setCompanyCategory] = useState("OTHER");
  const [companySubcategory, setCompanySubcategory] = useState("");
  const [phone, setPhone] = useState("");

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState<LeadFormState | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get("q");
    const stageParam = params.get("stage");
    const sortByParam = params.get("sortBy");
    const sortDirParam = params.get("sortDir");
    if (qParam) setQ(qParam);
    if (stageParam && stageOptions.includes(stageParam as (typeof stageOptions)[number])) {
      setStageFilter(stageParam as (typeof stageOptions)[number]);
    }
    if (sortByParam && ["createdAt", "lastActivity", "name", "company", "stage"].includes(sortByParam)) {
      setSortBy(sortByParam as "createdAt" | "lastActivity" | "name" | "company" | "stage");
    }
    if (sortDirParam === "asc" || sortDirParam === "desc") {
      setSortDir(sortDirParam);
    }
  }, []);

  const load = useCallback(async (nextPage = page) => {
    setLoading(true);
    const data = await getLeads({
      q: q || undefined,
      stage: stageFilter || undefined,
      page: nextPage,
      pageSize,
      sortBy,
      sortDir
    });
    setItems(data.items);
    setTotal(data.total);
    setPage(data.page);
    setLoading(false);
  }, [page, pageSize, q, stageFilter, sortBy, sortDir]);

  useEffect(() => {
    void load(1);
  }, [load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await createLead({
      name,
      company,
      companyCategory,
      companySubcategory,
      phone,
      source: "админка"
    });
    setName("");
    setCompany("");
    setCompanyCategory("OTHER");
    setCompanySubcategory("");
    setPhone("");
    await load(1);
  }

  async function onStageChange(id: string, stage: Lead["stage"]) {
    await updateLeadStage(id, stage);
    await load();
  }

  async function openLeadModal(id: string) {
    setSelectedLeadId(id);
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const data = await getLeadDetails(id);
      setLeadForm({
        name: data.lead.name ?? "",
        company: data.lead.company ?? "",
        companyCategory: data.lead.companyCategory || "OTHER",
        companySubcategory: data.lead.companySubcategory || "",
        phone: data.lead.phone ?? "",
        email: data.lead.email ?? "",
        notes: data.notes ?? "",
        contacts: data.contacts?.length ? data.contacts : [emptyContact()]
      });
    } catch {
      setDetailsError("Не удалось загрузить карточку лида.");
      setLeadForm(null);
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeLeadModal() {
    setSelectedLeadId(null);
    setLeadForm(null);
    setDetailsError(null);
    setDetailsLoading(false);
    setDetailsSaving(false);
  }

  function updateContact(index: number, field: keyof LeadContact, value: string) {
    setLeadForm((prev) => {
      if (!prev) return prev;
      const next = [...prev.contacts];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, contacts: next };
    });
  }

  function addContact() {
    setLeadForm((prev) => {
      if (!prev) return prev;
      return { ...prev, contacts: [...prev.contacts, emptyContact()] };
    });
  }

  function removeContact(index: number) {
    setLeadForm((prev) => {
      if (!prev) return prev;
      const next = prev.contacts.filter((_, i) => i !== index);
      return { ...prev, contacts: next.length ? next : [emptyContact()] };
    });
  }

  async function saveLeadDetails() {
    if (!selectedLeadId || !leadForm) return;

    if (!leadForm.name.trim() || !leadForm.phone.trim()) {
      setDetailsError("Имя и телефон обязательны.");
      return;
    }

    setDetailsSaving(true);
    setDetailsError(null);
    try {
      await updateLeadDetails(selectedLeadId, {
        name: leadForm.name,
        company: leadForm.company,
        companyCategory: leadForm.companyCategory,
        companySubcategory: leadForm.companySubcategory,
        phone: leadForm.phone,
        email: leadForm.email,
        notes: leadForm.notes,
        contacts: leadForm.contacts.map((contact) => ({
          id: contact.id,
          department: contact.department,
          fullName: contact.fullName,
          role: contact.role,
          phone: contact.phone,
          email: contact.email,
          notes: contact.notes
        }))
      });
      await load(page);
      await openLeadModal(selectedLeadId);
    } catch {
      setDetailsError("Не удалось сохранить изменения.");
    } finally {
      setDetailsSaving(false);
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const quickSubcategories = useMemo(() => companySubcategoryOptions(companyCategory), [companyCategory]);
  const modalSubcategories = useMemo(() => companySubcategoryOptions(leadForm?.companyCategory || "OTHER"), [leadForm?.companyCategory]);

  return (
    <div>
      <h2>База лидов</h2>

      <form className="card" onSubmit={onSubmit} style={{ marginBottom: 12 }}>
        <div className="grid two" style={{ marginBottom: 10 }}>
          <input placeholder="Имя" required value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Компания" value={company} onChange={(e) => setCompany(e.target.value)} />
          <select
            value={companyCategory}
            onChange={(e) => {
              const nextCategory = e.target.value;
              setCompanyCategory(nextCategory);
              const available = companySubcategoryOptions(nextCategory);
              if (!available.some((item) => item.value === companySubcategory)) {
                setCompanySubcategory("");
              }
            }}
          >
            {companyCategoryOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={companySubcategory}
            onChange={(e) => setCompanySubcategory(e.target.value)}
            disabled={!quickSubcategories.length}
          >
            <option value="">Подкатегория (не выбрана)</option>
            {quickSubcategories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input placeholder="Телефон" required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <button type="submit">Добавить</button>
      </form>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="grid two">
          <input placeholder="Поиск по имени/компании/телефону" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as (typeof stageOptions)[number])}>
            {stageOptions.map((stage) => (
              <option key={stage || "ALL"} value={stage}>{stage ? leadStageLabel(stage) : "Все этапы"}</option>
            ))}
          </select>
        </div>
        <div className="grid two" style={{ marginTop: 10 }}>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "createdAt" | "lastActivity" | "name" | "company" | "stage")}> 
            <option value="createdAt">Сортировать по созданию</option>
            <option value="lastActivity">Сортировать по последней активности</option>
            <option value="name">Сортировать по имени</option>
            <option value="company">Сортировать по компании</option>
            <option value="stage">Сортировать по этапу</option>
          </select>
          <select value={sortDir} onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}> 
            <option value="desc">По убыванию</option>
            <option value="asc">По возрастанию</option>
          </select>
        </div>
      </section>

      <section className="card">
        {loading ? (
          <p>Загрузка...</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Компания</th>
                  <th>Категория</th>
                  <th>Этап</th>
                  <th>Быстро сменить этап</th>
                  <th>Последняя активность</th>
                </tr>
              </thead>
              <tbody>
                {items.map((lead) => (
                  <tr key={lead.id} className="lead-row" onClick={() => void openLeadModal(lead.id)}>
                    <td>{lead.name}</td>
                    <td>{lead.company}</td>
                    <td>
                      {companyCategoryLabel(lead.companyCategory)}
                      {lead.companySubcategory ? ` / ${companySubcategoryLabel(lead.companyCategory, lead.companySubcategory)}` : ""}
                    </td>
                    <td>{leadStageLabel(lead.stage)}</td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <select value={lead.stage} onChange={(e) => void onStageChange(lead.id, e.target.value as Lead["stage"])}>
                        {stageValues.map((stage) => (
                          <option key={stage} value={stage}>{leadStageLabel(stage)}</option>
                        ))}
                      </select>
                    </td>
                    <td>{lead.lastActivityAt ? new Date(lead.lastActivityAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <button disabled={page <= 1} onClick={() => void load(page - 1)}>Назад</button>
              <span>Страница {page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => void load(page + 1)}>Вперед</button>
            </div>
          </>
        )}
      </section>

      {selectedLeadId ? (
        <div className="modal-backdrop" onClick={closeLeadModal}>
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Карточка лида</h3>
              <button type="button" onClick={closeLeadModal}>Закрыть</button>
            </div>

            {detailsLoading ? <p>Загрузка данных...</p> : null}
            {detailsError ? <p className="bad">{detailsError}</p> : null}

            {leadForm ? (
              <div className="modal-content">
                <div className="grid two">
                  <label>
                    Имя
                    <input value={leadForm.name} onChange={(e) => setLeadForm((prev) => prev ? { ...prev, name: e.target.value } : prev)} />
                  </label>
                  <label>
                    Компания
                    <input value={leadForm.company} onChange={(e) => setLeadForm((prev) => prev ? { ...prev, company: e.target.value } : prev)} />
                  </label>
                  <label>
                    Категория компании
                    <select
                      value={leadForm.companyCategory}
                      onChange={(e) => {
                        const nextCategory = e.target.value;
                        setLeadForm((prev) => {
                          if (!prev) return prev;
                          const available = companySubcategoryOptions(nextCategory);
                          const nextSubcategory = available.some((item) => item.value === prev.companySubcategory) ? prev.companySubcategory : "";
                          return { ...prev, companyCategory: nextCategory, companySubcategory: nextSubcategory };
                        });
                      }}
                    >
                      {companyCategoryOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Подкатегория
                    <select
                      value={leadForm.companySubcategory}
                      onChange={(e) => setLeadForm((prev) => prev ? { ...prev, companySubcategory: e.target.value } : prev)}
                      disabled={!modalSubcategories.length}
                    >
                      <option value="">Не выбрана</option>
                      {modalSubcategories.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Телефон
                    <input value={leadForm.phone} onChange={(e) => setLeadForm((prev) => prev ? { ...prev, phone: e.target.value } : prev)} />
                  </label>
                  <label>
                    Email
                    <input value={leadForm.email} onChange={(e) => setLeadForm((prev) => prev ? { ...prev, email: e.target.value } : prev)} />
                  </label>
                </div>

                <label>
                  Примечания по лиду
                  <textarea
                    value={leadForm.notes}
                    onChange={(e) => setLeadForm((prev) => prev ? { ...prev, notes: e.target.value } : prev)}
                    style={{ width: "100%", minHeight: 90 }}
                  />
                </label>

                <div className="contacts-header">
                  <h4>Контакты</h4>
                  <button type="button" onClick={addContact}>Добавить контакт</button>
                </div>

                <div className="contacts-list">
                  {leadForm.contacts.map((contact, index) => (
                    <article className="contact-card" key={`${contact.id || "new"}-${index}`}>
                      <div className="contact-card__head">
                        <strong>Контакт #{index + 1}</strong>
                        <button type="button" onClick={() => removeContact(index)}>Удалить</button>
                      </div>
                      <div className="grid two">
                        <label>
                          Отдел
                          <input value={contact.department} onChange={(e) => updateContact(index, "department", e.target.value)} placeholder="Например: Отдел продаж" />
                        </label>
                        <label>
                          Контактное лицо
                          <input value={contact.fullName} onChange={(e) => updateContact(index, "fullName", e.target.value)} placeholder="ФИО" />
                        </label>
                        <label>
                          Должность
                          <input value={contact.role} onChange={(e) => updateContact(index, "role", e.target.value)} placeholder="Руководитель отдела продаж" />
                        </label>
                        <label>
                          Телефон
                          <input value={contact.phone} onChange={(e) => updateContact(index, "phone", e.target.value)} placeholder="+375 ..." />
                        </label>
                        <label>
                          Email
                          <input value={contact.email} onChange={(e) => updateContact(index, "email", e.target.value)} placeholder="mail@company.com" />
                        </label>
                      </div>
                      <label>
                        Примечания
                        <textarea
                          value={contact.notes}
                          onChange={(e) => updateContact(index, "notes", e.target.value)}
                          style={{ width: "100%", minHeight: 70 }}
                          placeholder="Комментарий по контакту"
                        />
                      </label>
                    </article>
                  ))}
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={closeLeadModal}>Отмена</button>
                  <button type="button" disabled={detailsSaving} onClick={() => void saveLeadDetails()}>
                    {detailsSaving ? "Сохраняем..." : "Сохранить"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
