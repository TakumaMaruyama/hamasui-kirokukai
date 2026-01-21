"use client";

import { useState } from "react";

type Props = {
  title: string;
  endpoint: string;
  filename: string;
};

export default function DocsAction({ title, endpoint, filename }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, { method: "POST" });
      if (!response.ok) {
        const payload = await response.json();
        setMessage(payload.message ?? "生成に失敗しました");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage("通信に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <button onClick={handleClick} disabled={loading}>
        {loading ? "生成中..." : title}
      </button>
      {message && <p style={{ marginTop: 8 }}>{message}</p>}
    </div>
  );
}
