"use client";

import { useState } from "react";

export default function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.message ?? "ログインに失敗しました");
        return;
      }

      setMessage("ログインしました。各メニューへ移動してください。");
    } catch (error) {
      setMessage("通信に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="adminPassword">パスワード</label>
      <input
        id="adminPassword"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      <div style={{ marginTop: 16 }}>
        <button type="submit" disabled={loading}>
          {loading ? "送信中..." : "ログイン"}
        </button>
      </div>
      {message && <p style={{ marginTop: 16 }}>{message}</p>}
    </form>
  );
}
