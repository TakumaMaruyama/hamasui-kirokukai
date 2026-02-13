"use client";

import { useState } from "react";
import { formatGradeLabel } from "@/lib/grade";

type SearchResult = {
  id: string;
  fullName: string;
  grade: number;
  gender: string;
};

export default function SearchForm() {
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName })
      });

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.message ?? "検索に失敗しました");
        setResults([]);
        return;
      }

      const payload = (await response.json()) as { results: SearchResult[] };
      setResults(payload.results);
    } catch (err) {
      setError("通信に失敗しました");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="fullName">フルネーム</label>
      <input
        id="fullName"
        type="text"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        required
      />
      <div style={{ marginTop: 16 }}>
        <button type="submit" disabled={loading}>
          {loading ? "検索中..." : "検索"}
        </button>
      </div>
      {error && (
        <p style={{ color: "#c53434", marginTop: 16 }}>{error}</p>
      )}
      {results.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2>検索結果</h2>
          <ul>
            {results.map((result) => (
              <li key={result.id}>
                <a href={`/athletes/${result.id}`}>
                  {result.fullName}（{formatGradeLabel(result.grade)}）
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
