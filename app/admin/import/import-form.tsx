"use client";

import { useState } from "react";
import { WEEKDAY_VALUES } from "@/lib/meet-context";
import type { MeetWeekday } from "@/lib/meet-context";

type PreviewRow = Record<string, string>;
type ApiPayload = {
  message?: string;
  rows?: PreviewRow[];
};

type Props = {
  program: "swimming" | "school";
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
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
      return null;
    }

    return { message: trimmed };
  }
}

export default function ImportForm({ program }: Props) {
  const now = new Date();
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [weekday, setWeekday] = useState<MeetWeekday>("月曜");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;

    setLoading(true);
    setMessage(null);
    setPreview(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("year", year);
      formData.append("month", month);
      formData.append("weekday", weekday);

      const response = await fetch(`/api/admin/import/${program}/preview`, {
        method: "POST",
        body: formData
      });
      const payload = await readApiPayload(response);

      if (!response.ok) {
        setMessage(payload?.message ?? `プレビューに失敗しました (HTTP ${response.status})`);
        return;
      }

      if (!payload?.rows) {
        setMessage("プレビュー結果の形式が不正です");
        return;
      }

      setPreview(payload.rows);
    } catch (error) {
      setMessage("通信に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/import/${program}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview })
      });
      const payload = await readApiPayload(response);

      if (!response.ok) {
        setMessage(payload?.message ?? `取り込みに失敗しました (HTTP ${response.status})`);
        return;
      }

      setMessage("取り込みが完了しました");
      setPreview(null);
      setFile(null);
    } catch (error) {
      setMessage("通信に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handlePreview}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(120px, 1fr))", gap: 12 }}>
          <div>
            <label htmlFor="importYear">年</label>
            <input
              id="importYear"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(event) => {
                setYear(event.target.value);
                setPreview(null);
                setMessage(null);
              }}
              required
            />
          </div>
          <div>
            <label htmlFor="importMonth">月</label>
            <input
              id="importMonth"
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setPreview(null);
                setMessage(null);
              }}
              required
            />
          </div>
          <div>
            <label htmlFor="importWeekday">曜日</label>
            <select
              id="importWeekday"
              value={weekday}
              onChange={(event) => {
                setWeekday(event.target.value as MeetWeekday);
                setPreview(null);
                setMessage(null);
              }}
              required
            >
              {WEEKDAY_VALUES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
        <label htmlFor="csvFile">CSVファイル</label>
        <input
          id="csvFile"
          type="file"
          accept="text/csv"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setPreview(null);
            setMessage(null);
          }}
          required
        />
        </div>
        <div style={{ marginTop: 16 }}>
          <button type="submit" disabled={loading || !file}>
            {loading ? "処理中..." : "プレビュー"}
          </button>
        </div>
      </form>

      {preview && (
        <div style={{ marginTop: 24 }}>
          <h2>プレビュー</h2>
          <p className="notice">
            取り込み先: {year}年{month}月 {weekday}
          </p>
          <table className="table">
            <thead>
              <tr>
                {Object.keys(preview[0] ?? {}).map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.slice(0, 10).map((row, index) => (
                <tr key={index}>
                  {Object.values(row).map((value, idx) => (
                    <td key={idx}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 16 }}>
            <button onClick={handleConfirm} disabled={loading}>
              {loading ? "取り込み中..." : "確定して取り込み"}
            </button>
          </div>
        </div>
      )}

      {message && <p style={{ marginTop: 16 }}>{message}</p>}
    </div>
  );
}
