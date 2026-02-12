"use client";

import { useState } from "react";
import { WEEKDAY_VALUES, type MeetWeekday } from "@/lib/meet-context";

type Props = {
  title: string;
  endpoint: string;
  filename: string;
  allowYearMonth?: boolean;
  allowFullName?: boolean;
  allowWeekday?: boolean;
};

type ApiPayload = {
  message?: string;
};

async function readApiPayload(response: Response): Promise<ApiPayload | null> {
  const bodyText = await response.text();
  if (!bodyText) {
    return null;
  }

  try {
    return JSON.parse(bodyText) as ApiPayload;
  } catch {
    const trimmed = bodyText.trim();
    if (!trimmed) {
      return null;
    }

    return { message: trimmed };
  }
}

export default function DocsAction({
  title,
  endpoint,
  filename,
  allowYearMonth = true,
  allowFullName = true,
  allowWeekday = true
}: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [weekday, setWeekday] = useState<MeetWeekday | "">("");
  const [fullName, setFullName] = useState("");
  const hasFilters = allowYearMonth || allowWeekday || allowFullName;

  const handleClick = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: allowYearMonth ? year || undefined : undefined,
          month: allowYearMonth ? month || undefined : undefined,
          weekday: allowWeekday ? weekday || undefined : undefined,
          fullName: allowFullName ? fullName.trim() || undefined : undefined
        })
      });

      if (!response.ok) {
        const payload = await readApiPayload(response);
        setMessage(payload?.message ?? `生成に失敗しました (HTTP ${response.status})`);
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
      setMessage(error instanceof Error ? error.message : "通信に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {hasFilters && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.max(1, (allowYearMonth ? 2 : 0) + (allowWeekday ? 1 : 0) + (allowFullName ? 1 : 0))}, minmax(120px, 1fr))`,
            gap: 12,
            marginBottom: 10
          }}
        >
          {allowYearMonth && (
            <>
              <div>
                <label htmlFor={`${endpoint}-year`}>年</label>
                <input
                  id={`${endpoint}-year`}
                  type="number"
                  min={2000}
                  max={2100}
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  placeholder="例: 2025"
                />
              </div>
              <div>
                <label htmlFor={`${endpoint}-month`}>月</label>
                <input
                  id={`${endpoint}-month`}
                  type="number"
                  min={1}
                  max={12}
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  placeholder="例: 9"
                />
              </div>
            </>
          )}
          {allowWeekday && (
            <div>
              <label htmlFor={`${endpoint}-weekday`}>曜日</label>
              <select
                id={`${endpoint}-weekday`}
                value={weekday}
                onChange={(event) => setWeekday(event.target.value as MeetWeekday | "")}
              >
                <option value="">指定なし</option>
                {WEEKDAY_VALUES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )}
          {allowFullName && (
            <div>
              <label htmlFor={`${endpoint}-fullName`}>氏名（任意）</label>
              <input
                id={`${endpoint}-fullName`}
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="例: 山田 太郎"
              />
            </div>
          )}
        </div>
      )}
      <button onClick={handleClick} disabled={loading}>
        {loading ? "生成中..." : title}
      </button>
      {message && <p style={{ marginTop: 8 }}>{message}</p>}
    </div>
  );
}
