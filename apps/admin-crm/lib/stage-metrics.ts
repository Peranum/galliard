import type { Lead, LeadStage, LeadStageHistoryEntry } from "@/types/crm";

const HOUR_MS = 60 * 60 * 1000;

export const stageSlaHours: Record<LeadStage, number> = {
  NEW: 24,
  CONTACTED: 24,
  REPLIED: 48,
  QUALIFIED: 72,
  SOURCING: 96,
  PROPOSAL: 72,
  NEGOTIATION: 120,
  WON: 0,
  LOST: 0
};

export const stageColorByCode: Record<LeadStage, string> = {
  NEW: "#425b7f",
  CONTACTED: "#2a73f6",
  REPLIED: "#10a7be",
  QUALIFIED: "#7a67ff",
  SOURCING: "#a85ddf",
  PROPOSAL: "#e98416",
  NEGOTIATION: "#db6a1e",
  WON: "#25a35b",
  LOST: "#cf5d6e"
};

export type StageHealth = "normal" | "warn" | "critical" | "terminal";

export type LeadStageSegment = {
  stage: LeadStage;
  startAt: string;
  endAt: string;
  hours: number;
  isCurrent: boolean;
  slaHours: number;
  health: StageHealth;
  color: string;
};

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isLeadStage(value: string): value is LeadStage {
  return value in stageSlaHours;
}

function toHours(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / HOUR_MS);
}

export function stageHealth(stage: LeadStage, hours: number): StageHealth {
  if (stage === "WON" || stage === "LOST") return "terminal";
  const sla = stageSlaHours[stage];
  if (hours >= sla * 1.7) return "critical";
  if (hours >= sla) return "warn";
  return "normal";
}

export function formatDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "0 ч";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} мин`;
  if (hours < 24) return `${Math.round(hours)} ч`;
  return `${(hours / 24).toFixed(1)} д`;
}

export function getLeadCurrentStageHours(lead: Lead, now = new Date()): number {
  const enteredAt = parseDate(lead.stageEnteredAt) ?? parseDate(lead.createdAt);
  if (!enteredAt) return 0;
  return toHours(enteredAt, now);
}

export function buildLeadStageTimeline(lead: Lead, history: LeadStageHistoryEntry[], now = new Date()): LeadStageSegment[] {
  const createdAt = parseDate(lead.createdAt);
  if (!createdAt) return [];

  const events = [...history]
    .filter((item) => isLeadStage(item.toStage))
    .map((item) => ({ ...item, changedAtDate: parseDate(item.changedAt) }))
    .filter((item): item is LeadStageHistoryEntry & { changedAtDate: Date } => Boolean(item.changedAtDate))
    .sort((a, b) => a.changedAtDate.getTime() - b.changedAtDate.getTime());

  let currentStage: LeadStage = "NEW";
  let currentStart = createdAt;
  const segments: LeadStageSegment[] = [];

  for (const event of events) {
    if (event.changedAtDate <= currentStart) continue;
    if (event.toStage === currentStage) {
      currentStart = event.changedAtDate;
      continue;
    }
    const hours = toHours(currentStart, event.changedAtDate);
    segments.push({
      stage: currentStage,
      startAt: currentStart.toISOString(),
      endAt: event.changedAtDate.toISOString(),
      hours,
      isCurrent: false,
      slaHours: stageSlaHours[currentStage],
      health: stageHealth(currentStage, hours),
      color: stageColorByCode[currentStage]
    });
    currentStage = event.toStage;
    currentStart = event.changedAtDate;
  }

  const targetStage = isLeadStage(lead.stage) ? lead.stage : currentStage;
  if (currentStage !== targetStage) {
    currentStage = targetStage;
    currentStart = parseDate(lead.stageEnteredAt) ?? currentStart;
  }

  const currentHours = toHours(currentStart, now);
  segments.push({
    stage: currentStage,
    startAt: currentStart.toISOString(),
    endAt: now.toISOString(),
    hours: currentHours,
    isCurrent: true,
    slaHours: stageSlaHours[currentStage],
    health: stageHealth(currentStage, currentHours),
    color: stageColorByCode[currentStage]
  });

  return segments.filter((item) => item.hours >= 0);
}
