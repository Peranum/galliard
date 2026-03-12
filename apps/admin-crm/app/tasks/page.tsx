"use client";

import { Dispatch, FormEvent, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import type { Lead, Task } from "@/types/crm";
import { createTask, deleteTask, getClients, getLeads, getTasks, patchTask } from "@/lib/api";
import { taskPriorityLabel, taskStatusLabel, taskTypeLabel } from "@/lib/labels";

const kanbanStatuses: Task["status"][] = ["PLANNED", "READY", "IN_PROGRESS", "REVIEW", "DONE"];

type TaskType = Task["type"];
type TaskReferenceType = Task["referenceType"];

type TaskFormState = {
  title: string;
  description: string;
  type: TaskType;
  status: Task["status"];
  priority: Task["priority"];
  dueAt: string;
  referenceType: TaskReferenceType;
  referenceId: string;
};

const initialFormState: TaskFormState = {
  title: "",
  description: "",
  type: "FOLLOW_UP",
  status: "PLANNED",
  priority: "MEDIUM",
  dueAt: "",
  referenceType: "WORK",
  referenceId: ""
};

function toDatetimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function TasksPage() {
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leadOptions, setLeadOptions] = useState<Lead[]>([]);
  const [clientOptions, setClientOptions] = useState<Lead[]>([]);

  const [createForm, setCreateForm] = useState<TaskFormState>(initialFormState);
  const [createModalStatus, setCreateModalStatus] = useState<Task["status"] | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TaskFormState>(initialFormState);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const entityLabelMap = useMemo(() => {
    const out = new Map<string, string>();
    leadOptions.forEach((item) => out.set(item.id, `${item.name} · ${item.company || "без компании"}`));
    clientOptions.forEach((item) => {
      if (!out.has(item.id)) out.set(item.id, `${item.name} · ${item.company || "без компании"}`);
    });
    return out;
  }, [leadOptions, clientOptions]);

  const selectedTask = useMemo(
    () => items.find((task) => task.id === selectedTaskId) ?? null,
    [items, selectedTaskId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksData, leadsData, clientsData] = await Promise.all([
        getTasks(),
        getLeads({ page: 1, pageSize: 200, sortBy: "createdAt", sortDir: "desc" }),
        getClients()
      ]);
      setItems(tasksData.items);
      setLeadOptions(leadsData.items);
      setClientOptions(clientsData.items);
    } catch {
      setError("Не удалось загрузить задачи.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setFormField(
    setter: Dispatch<SetStateAction<TaskFormState>>,
    field: keyof TaskFormState,
    value: string
  ) {
    setter((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "referenceType" && value === "WORK") {
        next.referenceId = "";
      }
      return next;
    });
  }

  function taskReferenceLabel(task: Task) {
    if (task.referenceType === "WORK") return "Внутренняя задача";
    if (!task.referenceId) return task.referenceType === "LEAD" ? "Лид не выбран" : "Клиент не выбран";
    return entityLabelMap.get(task.referenceId) ?? task.referenceId;
  }

  async function onCreateTask(event: FormEvent) {
    event.preventDefault();
    if (!createForm.title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createTask({
        title: createForm.title.trim(),
        description: createForm.description.trim() || undefined,
        type: createForm.type,
        status: createForm.status,
        priority: createForm.priority,
        dueAt: createForm.dueAt ? new Date(createForm.dueAt).toISOString() : undefined,
        referenceType: createForm.referenceType,
        referenceId: createForm.referenceType === "WORK" ? undefined : createForm.referenceId || undefined,
        assignee: "владелец"
      });
      setCreateForm(initialFormState);
      setCreateModalStatus(null);
      await load();
    } catch {
      setError("Не удалось создать задачу.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(task: Task) {
    setSelectedTaskId(task.id);
    setEditForm({
      title: task.title,
      description: task.description ?? "",
      type: task.type,
      status: task.status,
      priority: task.priority,
      dueAt: toDatetimeLocal(task.dueAt),
      referenceType: task.referenceType,
      referenceId: task.referenceId ?? ""
    });
  }

  async function onSaveTask() {
    if (!selectedTask) return;
    setSaving(true);
    setError(null);
    try {
      await patchTask(selectedTask.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        type: editForm.type,
        status: editForm.status,
        priority: editForm.priority,
        dueAt: editForm.dueAt ? new Date(editForm.dueAt).toISOString() : undefined,
        referenceType: editForm.referenceType,
        referenceId: editForm.referenceType === "WORK" ? undefined : editForm.referenceId || undefined
      });
      await load();
      setSelectedTaskId(null);
    } catch {
      setError("Не удалось сохранить задачу.");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteTask() {
    if (!selectedTask) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(`Удалить задачу "${selectedTask.title}"?`);
      if (!ok) return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteTask(selectedTask.id);
      setSelectedTaskId(null);
      await load();
    } catch {
      setError("Не удалось удалить задачу.");
    } finally {
      setDeleting(false);
    }
  }

  async function moveTask(taskId: string, status: Task["status"]) {
    const target = items.find((task) => task.id === taskId);
    if (!target || target.status === status) return;
    setItems((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)));
    try {
      await patchTask(taskId, { status });
      await load();
    } catch {
      setError("Не удалось переместить задачу.");
      await load();
    }
  }

  function renderReferenceSelect(form: TaskFormState, setter: Dispatch<SetStateAction<TaskFormState>>) {
    if (form.referenceType === "WORK") {
      return <p className="muted">Задача без привязки к сущности.</p>;
    }
    const options = form.referenceType === "LEAD" ? leadOptions : clientOptions;
    return (
      <select value={form.referenceId} onChange={(event) => setFormField(setter, "referenceId", event.target.value)}>
        <option value="">{form.referenceType === "LEAD" ? "Выбери лида" : "Выбери клиента"}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} · {item.company || "без компании"}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div>
      <h2>Задачи</h2>
      {error ? <p className="bad" style={{ marginBottom: 10 }}>{error}</p> : null}

      <section className="kanban-board" aria-label="Kanban board">
        {kanbanStatuses.map((status) => {
          const tasksByStatus = items.filter((task) => task.status === status);
          return (
            <article
              key={status}
              className="kanban-column"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggingTaskId) {
                  void moveTask(draggingTaskId, status);
                }
                setDraggingTaskId(null);
              }}
            >
              <header className="kanban-column__header">
                <h3>{taskStatusLabel(status)}</h3>
                <div className="kanban-column__actions">
                  <span>{tasksByStatus.length}</span>
                  <button
                    type="button"
                    className="kanban-add-btn"
                    title={`Создать задачу в колонке "${taskStatusLabel(status)}"`}
                    onClick={() => {
                      setCreateForm({ ...initialFormState, status });
                      setCreateModalStatus(status);
                    }}
                  >
                    +
                  </button>
                </div>
              </header>
              <div className="kanban-column__body">
                {loading ? (
                  <p className="muted">Загрузка...</p>
                ) : tasksByStatus.length ? (
                  tasksByStatus.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className={`task-card${selectedTaskId === task.id ? " active" : ""}`}
                      draggable
                      onDragStart={() => setDraggingTaskId(task.id)}
                      onDragEnd={() => setDraggingTaskId(null)}
                      onClick={() => startEdit(task)}
                    >
                      <strong>{task.title}</strong>
                      <span className="task-card__meta">{taskTypeLabel(task.type)}</span>
                      <span className={`task-priority-badge ${task.priority.toLowerCase()}`}>{taskPriorityLabel(task.priority)}</span>
                      <span className="task-card__meta">{taskReferenceLabel(task)}</span>
                      {task.description ? <p>{task.description}</p> : null}
                      <span className="task-card__date">
                        Создана: {new Date(task.createdAt).toLocaleString()}
                      </span>
                      <span className="task-card__date">
                        Дедлайн: {task.dueAt ? new Date(task.dueAt).toLocaleString() : "не указан"}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="kanban-empty">
                    <p className="muted">Пусто</p>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {createModalStatus ? (
        <div className="modal-backdrop" onClick={() => setCreateModalStatus(null)}>
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Новая задача: {taskStatusLabel(createModalStatus)}</h3>
              <button type="button" onClick={() => setCreateModalStatus(null)}>Закрыть</button>
            </div>
            <div className="modal-content">
              <form className="grid two" onSubmit={onCreateTask}>
                <label>
                  Название
                  <input
                    required
                    value={createForm.title}
                    onChange={(event) => setFormField(setCreateForm, "title", event.target.value)}
                    placeholder="Например: Подготовить КП для клиента"
                  />
                </label>
                <label>
                  Тип
                  <select value={createForm.type} onChange={(event) => setFormField(setCreateForm, "type", event.target.value)}>
                    <option value="CALL">Звонок</option>
                    <option value="FOLLOW_UP">Фоллоу-ап</option>
                    <option value="PROPOSAL">КП</option>
                    <option value="MEETING">Встреча</option>
                    <option value="OTHER">Другое</option>
                  </select>
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  Описание
                  <textarea
                    value={createForm.description}
                    onChange={(event) => setFormField(setCreateForm, "description", event.target.value)}
                    placeholder="Детали задачи"
                    style={{ width: "100%", minHeight: 74 }}
                  />
                </label>
                <label>
                  Статус
                  <select value={createForm.status} onChange={(event) => setFormField(setCreateForm, "status", event.target.value)}>
                    {kanbanStatuses.map((status) => (
                      <option key={status} value={status}>
                        {taskStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Приоритет
                  <select value={createForm.priority} onChange={(event) => setFormField(setCreateForm, "priority", event.target.value)}>
                    <option value="LOW">Низкий</option>
                    <option value="MEDIUM">Средний</option>
                    <option value="HIGH">Высокий</option>
                  </select>
                </label>
                <label>
                  Дедлайн
                  <input
                    type="datetime-local"
                    value={createForm.dueAt}
                    onChange={(event) => setFormField(setCreateForm, "dueAt", event.target.value)}
                  />
                </label>
                <label>
                  Привязка
                  <select
                    value={createForm.referenceType}
                    onChange={(event) => setFormField(setCreateForm, "referenceType", event.target.value)}
                  >
                    <option value="WORK">Работа (внутренняя)</option>
                    <option value="LEAD">Лид</option>
                    <option value="CLIENT">Клиент</option>
                  </select>
                </label>
                <label>
                  Объект
                  {renderReferenceSelect(createForm, setCreateForm)}
                </label>
                <div className="modal-actions" style={{ gridColumn: "1 / -1" }}>
                  <button type="button" onClick={() => setCreateModalStatus(null)}>Отмена</button>
                  <button disabled={submitting} type="submit">
                    {submitting ? "Создаем..." : "Создать задачу"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {selectedTask ? (
        <div className="modal-backdrop" onClick={() => setSelectedTaskId(null)}>
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Задача</h3>
              <button type="button" onClick={() => setSelectedTaskId(null)}>Закрыть</button>
            </div>
            <div className="modal-content">
              <div className="grid two">
                <label>
                  Название
                  <input value={editForm.title} onChange={(event) => setFormField(setEditForm, "title", event.target.value)} />
                </label>
                <label>
                  Тип
                  <select value={editForm.type} onChange={(event) => setFormField(setEditForm, "type", event.target.value)}>
                    <option value="CALL">Звонок</option>
                    <option value="FOLLOW_UP">Фоллоу-ап</option>
                    <option value="PROPOSAL">КП</option>
                    <option value="MEETING">Встреча</option>
                    <option value="OTHER">Другое</option>
                  </select>
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  Описание
                  <textarea
                    value={editForm.description}
                    onChange={(event) => setFormField(setEditForm, "description", event.target.value)}
                    style={{ width: "100%", minHeight: 74 }}
                  />
                </label>
                <label>
                  Статус
                  <select value={editForm.status} onChange={(event) => setFormField(setEditForm, "status", event.target.value)}>
                    {kanbanStatuses.map((status) => (
                      <option key={status} value={status}>
                        {taskStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Приоритет
                  <select value={editForm.priority} onChange={(event) => setFormField(setEditForm, "priority", event.target.value)}>
                    <option value="LOW">Низкий</option>
                    <option value="MEDIUM">Средний</option>
                    <option value="HIGH">Высокий</option>
                  </select>
                </label>
                <label>
                  Дедлайн
                  <input
                    type="datetime-local"
                    value={editForm.dueAt}
                    onChange={(event) => setFormField(setEditForm, "dueAt", event.target.value)}
                  />
                </label>
                <label>
                  Привязка
                  <select
                    value={editForm.referenceType}
                    onChange={(event) => setFormField(setEditForm, "referenceType", event.target.value)}
                  >
                    <option value="WORK">Работа (внутренняя)</option>
                    <option value="LEAD">Лид</option>
                    <option value="CLIENT">Клиент</option>
                  </select>
                </label>
                <label>
                  Объект
                  {renderReferenceSelect(editForm, setEditForm)}
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setSelectedTaskId(null)}>Отмена</button>
                <button
                  type="button"
                  onClick={() => void onDeleteTask()}
                  disabled={deleting || saving}
                  style={{ borderColor: "#cc4050", background: "linear-gradient(90deg, #c93f52, #e66073)" }}
                >
                  {deleting ? "Удаляем..." : "Удалить"}
                </button>
                <button type="button" onClick={() => void onSaveTask()} disabled={saving || deleting}>
                  {saving ? "Сохраняем..." : "Сохранить"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
