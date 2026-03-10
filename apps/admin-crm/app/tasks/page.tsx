"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Task } from "@/types/crm";
import { createTask, getTasks, patchTask } from "@/lib/api";
import { taskStatusLabel, taskTypeLabel } from "@/lib/labels";

export default function TasksPage() {
  const [items, setItems] = useState<Task[]>([]);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"CALL" | "FOLLOW_UP" | "PROPOSAL" | "MEETING" | "OTHER">("FOLLOW_UP");
  const [dueAt, setDueAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getTasks({ critical: criticalOnly });
    setItems(data.items);
    setLoading(false);
  }, [criticalOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await createTask({
      title,
      type,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      assignee: "владелец"
    });
    setTitle("");
    setDueAt("");
    await load();
  }

  async function toggleDone(task: Task) {
    await patchTask(task.id, { status: task.status === "DONE" ? "OPEN" : "DONE" });
    await load();
  }

  return (
    <div>
      <h2>Задачи</h2>
      <section className="in-dev-banner" role="note" aria-label="Экран в разработке">
        <strong>Еще в разработке</strong>
        <span>Экран задач пока развивается: часть автоматизаций и статусов будет расширена в следующих итерациях.</span>
      </section>

      <form className="card form-inline" onSubmit={onSubmit}>
        <input placeholder="Название задачи" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value as "CALL" | "FOLLOW_UP" | "PROPOSAL" | "MEETING" | "OTHER")}> 
          <option value="CALL">Звонок</option>
          <option value="FOLLOW_UP">Фоллоу-ап</option>
          <option value="PROPOSAL">КП</option>
          <option value="MEETING">Встреча</option>
          <option value="OTHER">Другое</option>
        </select>
        <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        <button type="submit">Добавить задачу</button>
      </form>

      <section className="card" style={{ marginBottom: 12 }}>
        <label className="checkbox-line">
          <input type="checkbox" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)} />
          Показать только критичные
        </label>
      </section>

      <section className="card">
        {loading ? (
          <p>Загрузка...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Тип</th>
                <th>Статус</th>
                <th>Срок</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {items.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>{taskTypeLabel(task.type)}</td>
                  <td>{taskStatusLabel(task.status)}</td>
                  <td>{task.dueAt ? new Date(task.dueAt).toLocaleString() : "—"}</td>
                  <td>
                    <button onClick={() => void toggleDone(task)}>
                      {task.status === "DONE" ? "Переоткрыть" : "Отметить выполненной"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
