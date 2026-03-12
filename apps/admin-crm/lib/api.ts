import type { Lead, LeadDetails, LeadStage, Task } from "@/types/crm";

export interface DashboardData {
  kpis: {
    newLeads7d: KpiCard;
    contacted7d: KpiCard;
    positiveReplies7d: KpiCard;
    meetingsMtd: KpiCard;
    overdueTasks: KpiCard;
    noActivity3d: KpiCard;
  };
  mailer: {
    sent: number;
    delivered: number;
    replied: number;
    bounced: number;
    unsubscribed: number;
    replyRate: number;
    bounceRate: number;
    spamRisk: "GREEN" | "RED";
    topCampaigns: Array<{
      id: string;
      name: string;
      replyRate: number;
      bounceRate: number;
      sent: number;
    }>;
  };
  miniFunnel: Array<{ stage: LeadStage; count: number; conversionToNext: number | null }>;
  criticalTasks: Task[];
}

export interface KpiCard {
  value: number;
  delta: number;
  trend: number[];
  href: string;
}

export interface PipelineBoard {
  columns: Array<{
    stage: LeadStage;
    count: number;
    avgHoursOnStage: number;
    potentialValue: number;
    leads: Lead[];
  }>;
  bottleneckStage: LeadStage | null;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  subject?: string;
  body?: string;
  createdBy: string;
  createdAt: string;
}

export interface CampaignStats {
  sent: number;
  delivered: number;
  replied: number;
  bounced: number;
  replyRate: number;
  bounceRate: number;
}

export interface CampaignMessage {
  id: string;
  campaignId: string;
  leadId: string;
  leadName: string;
  leadEmail: string;
  status: string;
  step: number;
  messageId?: string;
  sentAt?: string;
}

const apiBase = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Ошибка API ${response.status} для ${path}`);
  }

  return (await response.json()) as T;
}

export function getDashboard(period = "7d") {
  return request<DashboardData>(`/dashboard?period=${period}`);
}

export function getLeads(params?: {
  q?: string;
  stage?: LeadStage | "";
  owner?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "lastActivity" | "name" | "company" | "stage";
  sortDir?: "asc" | "desc";
}) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.stage) search.set("stage", params.stage);
  if (params?.owner) search.set("owner", params.owner);
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDir) search.set("sortDir", params.sortDir);

  const suffix = search.toString();
  return request<{ items: Lead[]; total: number; page: number; pageSize: number }>(`/leads${suffix ? `?${suffix}` : ""}`);
}

export function createLead(payload: {
  name: string;
  company: string;
  companyCategory?: string;
  companySubcategory?: string;
  phone: string;
  email?: string;
  source?: string;
}) {
  return request<{ id: string }>("/leads", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateLeadStage(id: string, stage: LeadStage) {
  return request<{ ok: true }>(`/leads/${id}/stage`, {
    method: "PATCH",
    body: JSON.stringify({ toStage: stage, changedBy: "админка" })
  });
}

export function getLeadDetails(id: string) {
  return request<LeadDetails>(`/leads/${id}`);
}

export function updateLeadDetails(id: string, payload: {
  name: string;
  company: string;
  companyCategory?: string;
  companySubcategory?: string;
  phone: string;
  email?: string;
  notes?: string;
  contacts: Array<{
    id?: string;
    department?: string;
    fullName?: string;
    role?: string;
    phone?: string;
    email?: string;
    notes?: string;
  }>;
}) {
  return request<{ ok: true }>(`/leads/${id}/details`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function getPipeline() {
  return request<PipelineBoard>("/pipeline");
}

export function getClients() {
  return request<{ items: Lead[] }>("/clients");
}

export function updateLead(id: string, payload: {
  owner?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  potentialValue?: number;
  nextActionAt?: string;
}) {
  return request<{ ok: true }>(`/leads/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteLead(id: string) {
  return request<{ ok: true }>(`/leads/${id}`, {
    method: "DELETE"
  });
}

export function patchCampaignMessageStatus(id: string, status: "replied" | "bounced" | "unsubscribed" | "delivered") {
  return request<{ ok: true }>(`/campaign-messages/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function getTasks(params?: { critical?: boolean }) {
  const search = new URLSearchParams();
  if (params?.critical) search.set("critical", "1");
  const suffix = search.toString();
  return request<{ items: Task[] }>(`/tasks${suffix ? `?${suffix}` : ""}`);
}

export function createTask(payload: {
  referenceType?: "WORK" | "LEAD" | "CLIENT";
  referenceId?: string;
  title: string;
  description?: string;
  type: "CALL" | "FOLLOW_UP" | "PROPOSAL" | "MEETING" | "OTHER";
  assignee?: string;
  dueAt?: string;
  status?: "PLANNED" | "READY" | "IN_PROGRESS" | "REVIEW" | "DONE";
}) {
  return request<{ id: string }>("/tasks", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function patchTask(id: string, payload: {
  title?: string;
  description?: string;
  status?: "PLANNED" | "READY" | "IN_PROGRESS" | "REVIEW" | "DONE";
  dueAt?: string;
  type?: "CALL" | "FOLLOW_UP" | "PROPOSAL" | "MEETING" | "OTHER";
  referenceType?: "WORK" | "LEAD" | "CLIENT";
  referenceId?: string;
}) {
  return request<{ ok: true }>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteTask(id: string) {
  return request<{ ok: true }>(`/tasks/${id}`, {
    method: "DELETE"
  });
}

export function getCampaigns() {
  return request<{ items: Campaign[] }>("/campaigns");
}

export function createCampaign(payload: { name: string; subject: string; body: string; createdBy?: string }) {
  return request<{ id: string }>("/campaigns", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function startCampaign(id: string) {
  return request<{ ok: true; queued: number }>(`/campaigns/${id}/start`, {
    method: "POST"
  });
}

export function getCampaignStats(id: string) {
  return request<CampaignStats>(`/campaigns/${id}/stats`);
}

export function getCampaignMessages(id: string) {
  return request<{ items: CampaignMessage[] }>(`/campaigns/${id}/messages`);
}
