import type { LeadStage, Task } from "@/types/crm";

const leadStageLabels: Record<string, string> = {
  NEW: "Новый",
  CONTACTED: "Связались",
  REPLIED: "Ответил",
  QUALIFIED: "Квалифицирован",
  MEETING: "Встреча",
  SOURCING: "Подбор",
  PROPOSAL: "КП",
  NEGOTIATION: "Переговоры",
  WON: "Выиграно",
  LOST: "Проиграно"
};

export function leadStageLabel(stage: LeadStage | string): string {
  const key = stage.toUpperCase();
  return leadStageLabels[key] ?? stage;
}

const taskTypeLabels: Record<Task["type"], string> = {
  CALL: "Звонок",
  FOLLOW_UP: "Фоллоу-ап",
  PROPOSAL: "КП",
  MEETING: "Встреча",
  OTHER: "Другое"
};

export function taskTypeLabel(type: Task["type"]): string {
  return taskTypeLabels[type] ?? type;
}

const taskStatusLabels: Record<Task["status"], string> = {
  PLANNED: "В планах",
  READY: "Можно приступать",
  IN_PROGRESS: "В работе",
  REVIEW: "На рассмотрение",
  DONE: "Сделана"
};

export function taskStatusLabel(status: Task["status"]): string {
  return taskStatusLabels[status] ?? status;
}

const taskPriorityLabels: Record<Task["priority"], string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий"
};

export function taskPriorityLabel(priority: Task["priority"]): string {
  return taskPriorityLabels[priority] ?? priority;
}

export function campaignStatusLabel(status: string): string {
  const value = status.toLowerCase();
  if (value === "draft") return "Черновик";
  if (value === "running") return "Запущена";
  if (value === "completed") return "Завершена";
  if (value === "paused") return "Пауза";
  return status;
}

export function messageStatusLabel(status: string): string {
  const value = status.toLowerCase();
  if (value === "queued") return "В очереди";
  if (value === "sent") return "Отправлено";
  if (value === "delivered") return "Доставлено";
  if (value === "replied") return "Ответ";
  if (value === "bounced") return "Возврат";
  if (value === "unsubscribed") return "Отписка";
  return status;
}

export function spamRiskLabel(value: "GREEN" | "RED"): string {
  return value === "RED" ? "Высокий" : "Низкий";
}
