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
  program: "swimming" | "school" | "challenge";
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
  const [files, setFiles] = useState<File[]>([]);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [weekday, setWeekday] = useState<MeetWeekday | "">("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const importContextLabel = `${year}年${month}月${weekday ? ` ${weekday}` : ""}`;

  const buildPreviewFormData = (selectedFiles: File[]) => {
    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append("files", file);
    }
    formData.append("year", year);
    formData.append("month", month);
    if (weekday) {
      formData.append("weekday", weekday);
    }

    return formData;
  };

  const fetchPreviewRows = async (
    selectedFiles: File[]
  ): Promise<{ rows?: PreviewRow[]; message?: string; error?: string }> => {
    const response = await fetch(`/api/admin/import/${program}/preview`, {
      method: "POST",
      body: buildPreviewFormData(selectedFiles)
    });
    const payload = await readApiPayload(response);

    if (!response.ok) {
      return { error: payload?.message ?? `プレビューに失敗しました (HTTP ${response.status})` };
    }

    if (!payload?.rows) {
      return { error: "プレビュー結果の形式が不正です" };
    }

    return { rows: payload.rows, message: payload.message };
  };

  const importWithRows = async (
    rows: PreviewRow[]
  ): Promise<{ message?: string; error?: string }> => {
    const response = await fetch(`/api/admin/import/${program}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows })
    });
    const payload = await readApiPayload(response);

    if (!response.ok) {
      return { error: payload?.message ?? `取り込みに失敗しました (HTTP ${response.status})` };
    }

    return { message: payload?.message ?? "取り込みが完了しました" };
  };

  const handlePreview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (files.length === 0) return;

    setLoading(true);
    setMessage(null);
    setPreview(null);

    try {
      const previewResult = await fetchPreviewRows(files);
      if (!previewResult.rows) {
        setMessage(previewResult.error ?? "プレビューに失敗しました");
        return;
      }

      setPreview(previewResult.rows);
      setMessage(previewResult.message ?? null);
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
      const importResult = await importWithRows(preview);
      if (importResult.error) {
        setMessage(importResult.error);
        return;
      }

      setMessage(importResult.message ?? "取り込みが完了しました");
      setPreview(null);
      setFiles([]);
    } catch (error) {
      setMessage("通信に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleImportWithoutPreview = async () => {
    if (files.length === 0) return;

    setLoading(true);
    setMessage(null);
    setPreview(null);

    try {
      const previewResult = await fetchPreviewRows(files);
      if (!previewResult.rows) {
        setMessage(previewResult.error ?? "取り込みに失敗しました");
        return;
      }

      const importResult = await importWithRows(previewResult.rows);
      if (importResult.error) {
        setMessage(importResult.error);
        return;
      }

      const importMessage = importResult.message ?? "取り込みが完了しました";
      const finalMessage = previewResult.message ? `${importMessage}\n${previewResult.message}` : importMessage;
      setMessage(finalMessage);
      setFiles([]);
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
                setWeekday(event.target.value as MeetWeekday | "");
                setPreview(null);
                setMessage(null);
              }}
            >
              <option value="">指定なし</option>
              {WEEKDAY_VALUES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
        <label htmlFor="csvFile">CSVファイル（複数選択可）</label>
        <input
          id="csvFile"
          type="file"
          accept="text/csv"
          multiple
          onChange={(event) => {
            setFiles(Array.from(event.target.files ?? []));
            setPreview(null);
            setMessage(null);
          }}
          required
        />
        </div>
        {files.length > 0 && (
          <p className="notice" style={{ marginTop: 8 }}>
            選択中: {files.length}ファイル
          </p>
        )}
        <div style={{ marginTop: 16 }}>
          <button type="submit" disabled={loading || files.length === 0}>
            {loading ? "処理中..." : "プレビュー"}
          </button>
          <button
            type="button"
            onClick={handleImportWithoutPreview}
            disabled={loading || files.length === 0}
            style={{ marginLeft: 8 }}
          >
            {loading ? "処理中..." : "プレビューせず取り込み"}
          </button>
        </div>
      </form>

      {preview && (
        <div style={{ marginTop: 24 }}>
          <h2>プレビュー</h2>
          <p className="notice">
            取り込み先: {importContextLabel}
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
