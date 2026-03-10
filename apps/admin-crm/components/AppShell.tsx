"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren, useEffect, useState } from "react";

const links = [
  { href: "/", label: "Дашборд", hint: "Общая картина бизнеса: ключевые метрики, воронка и критичные действия." },
  { href: "/leads", label: "База лидов", hint: "Полный список лидов: поиск, фильтры, сортировка и быстрый переход по этапам." },
  { href: "/pipeline", label: "Воронка", hint: "Канбан по этапам продаж, чтобы видеть где застревают лиды и что двигать дальше." },
  { href: "/clients", label: "Клиенты", hint: "Лиды на поздних стадиях (Подбор и выше) для ежедневной клиентской работы." },
  { href: "/campaigns", label: "Рассылки", hint: "Запуск и контроль email-рассылок: статусы писем, ответы, возвраты и эффективность." },
  { href: "/tasks", label: "Задачи", hint: "Операционный список задач: сроки, приоритет и контроль исполнения." }
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <h1>Galliard CRM</h1>
            <p className="sidebar-subtitle">Управление лидами и продажами</p>
          </div>
          <button
            type="button"
            className="nav-toggle"
            aria-label="Открыть меню"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            Меню
          </button>
        </div>
        <nav className={menuOpen ? "open" : ""}>
          {links.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${isActive ? " active" : ""}`}
              title={item.hint}
              data-hint={item.hint}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
            );
          })}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
