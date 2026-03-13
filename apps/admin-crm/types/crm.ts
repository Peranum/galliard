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
  tasks: Task[];
}

export interface Task {
  id: string;
  referenceType: "WORK" | "LEAD" | "CLIENT";
  referenceId?: string;
  title: string;
  description?: string;
  type: "CALL" | "FOLLOW_UP" | "PROPOSAL" | "MEETING" | "OTHER";
  status: "PLANNED" | "READY" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "BLOCKER" | "SOMEDAY";
  dueAt?: string;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  author: string;
  body: string;
  createdAt: string;
}
