"use client";

import { FormEvent, useEffect, useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const nextPathRaw = params.get("next") ?? "/";
    setNextPath(nextPathRaw.startsWith("/") ? nextPathRaw : "/");
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "same-origin",
        cache: "no-store"
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Ошибка входа");
        return;
      }

      // Hard navigation avoids client-side race where middleware still sees old cookies.
      window.location.replace(nextPath);
    } catch {
      setError("Не удалось выполнить вход. Попробуй снова.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <h2>Вход в админку</h2>
        <form className="card auth-card" onSubmit={onSubmit}>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="bad">{error}</p> : null}
          <button type="submit" disabled={loading}>{loading ? "Входим..." : "Войти"}</button>
        </form>
      </div>
    </div>
  );
}
