export type LeadStage =
  | "NEW"
  | "CONTACTED"
  | "REPLIED"
  | "QUALIFIED"
  | "SOURCING"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export interface Lead {
  id: string;
  name: string;
  company: string;
  companyCategory: string;
  companySubcategory?: string;
  phone: string;
  email?: string;
  source: string;
  stage: LeadStage;
  priority: "LOW" | "MEDIUM" | "HIGH";
  owner: string;
  potentialValue: number;
  stageEnteredAt?: string;
  lastActivityAt?: string;
  nextActionAt?: string;
  createdAt: string;
}

export interface LeadStageHistoryEntry {
  fromStage?: LeadStage;
  toStage: LeadStage;
  changedBy: string;
  changedAt: string;
}

export interface LeadContact {
  id: string;
  department: string;
  fullName: string;
  role: string;
  phone: string;
  email: string;
  notes: string;
}

export interface LeadDetails {
  lead: Lead;
  notes: string;
  contacts: LeadContact[];
  stageHistory: LeadStageHistoryEntry[];
}

export interface Task {
  id: string;
  leadId?: string;
  title: string;
  type: "CALL" | "FOLLOW_UP" | "PROPOSAL" | "MEETING" | "OTHER";
  status: "OPEN" | "DONE";
  dueAt?: string;
}
