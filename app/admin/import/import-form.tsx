"use client";

import { useState } from "react";

type PreviewRow = Record<string, string>;

type Props = {
  program: "swimming" | "school";
};

export default function ImportForm({ program }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/admin/import/${program}/preview`, {
        method: "POST",
        body: formData
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.message ?? "プレビューに失敗しました");
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
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.message ?? "取り込みに失敗しました");
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
        <label htmlFor="csvFile">CSVファイル</label>
        <input
          id="csvFile"
          type="file"
          accept="text/csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          required
        />
        <div style={{ marginTop: 16 }}>
          <button type="submit" disabled={loading || !file}>
            {loading ? "処理中..." : "プレビュー"}
          </button>
        </div>
      </form>

      {preview && (
        <div style={{ marginTop: 24 }}>
          <h2>プレビュー</h2>
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
