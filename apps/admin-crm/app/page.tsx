"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardData, KpiCard } from "@/lib/api";
import { getDashboard } from "@/lib/api";
import { leadStageLabel, spamRiskLabel } from "@/lib/labels";

function num(v: number) {
  return new Intl.NumberFormat("ru-RU").format(v);
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function Trend({ values }: { values: number[] }) {
  if (!values.length || values.every((value) => value === 0)) {
    return <span>Нет данных за период</span>;
  }
  return <span>Динамика: {values.map((value) => num(value)).join(" / ")}</span>;
}

function deltaText(delta: number): string {
  if (Math.abs(delta) < 0.0005) return "Без изменений";
  if (delta > 0) return `Рост: +${pct(delta)}`;
  return `Снижение: ${pct(delta)}`;
}

function KpiTile({ title, card }: { title: string; card: KpiCard }) {
  const deltaClass = card.delta > 0 ? "good" : card.delta < 0 ? "bad" : "";

  return (
    <article className="card">
      <h3>{title}</h3>
      <p className="kpi-value">{num(card.value)}</p>
      <p className={deltaClass}>{deltaText(card.delta)}</p>
      <p className="muted"><Trend values={card.trend} /></p>
      <Link href={card.href}>Открыть</Link>
    </article>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState<"7d" | "30d">("7d");

  useEffect(() => {
    void getDashboard(period).then(setData).catch(() => setData(null));
  }, [period]);

  if (!data) {
    return <p>Загрузка дашборда...</p>;
  }

  return (
    <div>
      <h2>Дашборд</h2>
      <div className="toolbar">
        <button onClick={() => setPeriod("7d")} className={period === "7d" ? "active" : ""}>7д</button>
        <button onClick={() => setPeriod("30d")} className={period === "30d" ? "active" : ""}>30д</button>
      </div>

      <section className="cards six">
        <KpiTile title={`Новые лиды (${period})`} card={data.kpis.newLeads7d} />
        <KpiTile title={`Связались (${period})`} card={data.kpis.contacted7d} />
        <KpiTile title={`Положительные ответы (${period})`} card={data.kpis.positiveReplies7d} />
        <KpiTile title="Просроченные задачи" card={data.kpis.overdueTasks} />
        <KpiTile title="Без активности >3д" card={data.kpis.noActivity3d} />
      </section>

      <section className="grid two">
        <article className="card">
          <h3>Мини-воронка</h3>
          <table>
            <thead>
              <tr><th>Этап</th><th>Количество</th><th>Конверсия</th></tr>
            </thead>
            <tbody>
              {data.miniFunnel.map((item) => (
                <tr key={item.stage}>
                  <td>{leadStageLabel(item.stage)}</td>
                  <td>{num(item.count)}</td>
                  <td>{item.conversionToNext === null ? "Нет данных" : pct(item.conversionToNext)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="card">
          <h3>Состояние рассылки</h3>
          <p>Отправлено: {data.mailer.sent}</p>
          <p>Доставлено: {data.mailer.delivered}</p>
          <p>Ответов: {data.mailer.replied}</p>
          <p>Возвратов: {data.mailer.bounced}</p>
          <p>Отписок: {data.mailer.unsubscribed}</p>
          <p>Доля ответов: {pct(data.mailer.replyRate)}</p>
          <p>Доля возвратов: {pct(data.mailer.bounceRate)}</p>
          <p>Риск спама: <strong className={data.mailer.spamRisk === "RED" ? "bad" : "good"}>{spamRiskLabel(data.mailer.spamRisk)}</strong></p>
          <h4>Топ рассылок по доле ответов</h4>
          {data.mailer.topCampaigns.length ? (
            <ul>
              {data.mailer.topCampaigns.map((campaign) => (
                <li key={campaign.id}>{campaign.name}: {pct(campaign.replyRate)}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Пока нет рассылок для сравнения.</p>
          )}
        </article>
      </section>

      <section className="card">
        <h3>Топ-10 критичных действий</h3>
        {data.criticalTasks.length ? (
          <ul>
            {data.criticalTasks.map((task) => (
              <li key={task.id}>{task.title}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Критичных действий сейчас нет.</p>
        )}
      </section>
    </div>
  );
}
