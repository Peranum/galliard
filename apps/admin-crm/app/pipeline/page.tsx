"use client";

import { useEffect, useMemo, useState } from "react";
import { getPipeline, updateLeadStage } from "@/lib/api";
import type { Lead, LeadStage } from "@/types/crm";
import { leadStageLabel } from "@/lib/labels";

const stages: LeadStage[] = [
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

const funnelStages: LeadStage[] = [
  "NEW",
  "CONTACTED",
  "REPLIED",
  "QUALIFIED",
  "SOURCING",
  "PROPOSAL",
  "NEGOTIATION",
  "WON"
];

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export default function PipelinePage() {
  const [board, setBoard] = useState<Awaited<ReturnType<typeof getPipeline>> | null>(null);
  const [draggingLead, setDraggingLead] = useState<Lead | null>(null);

  async function load() {
    const data = await getPipeline();
    setBoard(data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function move(leadId: string, stage: LeadStage) {
    await updateLeadStage(leadId, stage);
    await load();
  }

  const columns = useMemo(() => {
    return stages.map((stage) => board?.columns.find((c) => c.stage === stage));
  }, [board]);

  const funnelView = useMemo(() => {
    const stageToColumn = new Map((board?.columns ?? []).map((column) => [column.stage, column]));
    const maxCount = Math.max(0, ...funnelStages.map((stage) => stageToColumn.get(stage)?.count ?? 0));

    const items = funnelStages.map((stage, index) => {
      const current = stageToColumn.get(stage);
      const nextStage = funnelStages[index + 1];
      const nextCount = nextStage ? stageToColumn.get(nextStage)?.count ?? 0 : 0;
      const count = current?.count ?? 0;
      const conversion = nextStage && count > 0 ? nextCount / count : null;
      const width = maxCount > 0 ? 44 + (count / maxCount) * 56 : Math.max(44, 100 - index * 7);

      return {
        stage,
        count,
        avgHours: Math.round(current?.avgHoursOnStage ?? 0),
        conversion,
        width
      };
    });

    const wonCount = stageToColumn.get("WON")?.count ?? 0;
    const lostCount = stageToColumn.get("LOST")?.count ?? 0;
    return { items, wonCount, lostCount };
  }, [board]);

  return (
    <div>
      <h2>Воронка</h2>
      <section className="card funnel-card">
        <h3>Визуальная воронка продаж</h3>
        <p className="muted">Сверху ты видишь форму воронки и потери между этапами.</p>
        <div className="funnel-visual">
          {funnelView.items.map((item) => (
            <div
              key={item.stage}
              className="funnel-step"
              data-stage={item.stage}
              style={{ width: `${item.width}%` }}
            >
              <div className="funnel-step__inner">
                <strong>{leadStageLabel(item.stage)}</strong>
                <small>
                  {item.count} лидов · ср. {item.avgHours} ч
                  {item.conversion === null ? "" : ` · конверсия ${pct(item.conversion)}`}
                </small>
              </div>
            </div>
          ))}
        </div>
        <div className="funnel-outcomes">
          <span className="outcome good">Выиграно: {funnelView.wonCount}</span>
          <span className="outcome bad">Проиграно: {funnelView.lostCount}</span>
          {board?.bottleneckStage ? <span className="outcome">Узкое место: {leadStageLabel(board.bottleneckStage)}</span> : null}
        </div>
      </section>

      <p className="muted">Перетаскивай карточки между колонками ниже, чтобы менять этап.</p>
      <div className="pipeline">
        {stages.map((stage, index) => {
          const column = columns[index];
          return (
            <section
              className="card column"
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggingLead && draggingLead.stage !== stage) {
                  void move(draggingLead.id, stage);
                }
                setDraggingLead(null);
              }}
            >
              <h3>{leadStageLabel(stage)}</h3>
              <p>Количество: {column?.count ?? 0}</p>
              <p>Среднее время (ч): {Math.round(column?.avgHoursOnStage ?? 0)}</p>
              <div className="stack">
                {column?.leads.map((lead) => (
                  <article
                    key={lead.id}
                    className="lead"
                    draggable
                    onDragStart={() => setDraggingLead(lead)}
                    onDragEnd={() => setDraggingLead(null)}
                  >
                    <strong>{lead.company || lead.name}</strong>
                    <small>{lead.name}</small>
                    <select value={lead.stage} onChange={(e) => void move(lead.id, e.target.value as LeadStage)}>
                      {stages.map((item) => (
                        <option key={item} value={item}>{leadStageLabel(item)}</option>
                      ))}
                    </select>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
