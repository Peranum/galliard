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
  phone: string;
  email?: string;
  stage: LeadStage;
  priority: "LOW" | "MEDIUM" | "HIGH";
  owner: string;
  source: string;
  lastActivityAt?: string;
  nextActionAt?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  leadId?: string;
  title: string;
  type: "CALL" | "FOLLOW_UP" | "PROPOSAL" | "MEETING" | "OTHER";
  status: "OPEN" | "DONE";
  dueAt?: string;
}
