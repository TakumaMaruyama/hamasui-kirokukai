"use client";

import { useState } from "react";
import { formatGradeLabel } from "@/lib/grade";
import { SEARCH_CONSENT_ITEMS, SEARCH_CONSENT_VERSION } from "@/lib/search-consent";

type SearchGender = "male" | "female" | "other";

type SearchResult = {
  fullName: string;
  gender: SearchGender;
  grades: number[];
};

function formatGenderLabel(gender: SearchGender): string {
  if (gender === "male") {
    return "男子";
  }

  if (gender === "female") {
    return "女子";
  }

  return "その他";
}

function formatGradeRange(grades: number[]): string {
  if (grades.length === 0) {
    return "-";
  }

  if (grades.length === 1) {
    return formatGradeLabel(grades[0]);
  }

  const minGrade = grades[0];
  const maxGrade = grades[grades.length - 1];
  return `${formatGradeLabel(minGrade)}〜${formatGradeLabel(maxGrade)}`;
}

export default function SearchForm() {
  const [fullName, setFullName] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
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
        body: JSON.stringify({
          fullName,
          consentAccepted,
          consentVersion: SEARCH_CONSENT_VERSION
        })
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
      setConsentAccepted(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="fullName">
        名前
        <span style={{ marginLeft: 8, color: "#94a3b8", fontSize: "0.88rem", fontWeight: 500 }}>
          ※フルネーム（漢字）完全一致で検索できます。
        </span>
      </label>
      <input
        id="fullName"
        type="text"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        required
      />
      <div
        style={{
          marginTop: 16,
          padding: 14,
          background: "#fff8e7",
          borderRadius: 8,
          border: "1px solid #f2d48a"
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: "1.05rem",
            marginBottom: 8,
            color: "#92400e"
          }}
        >
          検索利用時の同意事項
        </div>
        <ul
          style={{
            margin: "0 0 0 1.2rem",
            padding: 0,
            color: "#1f2937",
            fontSize: "0.95rem",
            lineHeight: 1.55,
            fontWeight: 500
          }}
        >
          {SEARCH_CONSENT_ITEMS.map((item) => {
            const isLogRecordNotice = item.startsWith("ログ記録:");

            return (
              <li
                key={item}
                style={{
                  marginBottom: 4,
                  ...(isLogRecordNotice
                    ? {
                        color: "#9f1239",
                        fontWeight: 700
                      }
                    : {})
                }}
              >
                {item}
              </li>
            );
          })}
        </ul>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10 }}>
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(event) => setConsentAccepted(event.target.checked)}
            required
            style={{ width: 16, height: 16, marginTop: 2 }}
          />
          <span style={{ color: "#6b7280", fontSize: "0.9rem", fontWeight: 400 }}>
            上記に同意して検索します
          </span>
        </label>
      </div>
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
              <li key={`${result.fullName}:${result.gender}`}>
                <a
                  href={`/athletes/history?${new URLSearchParams({
                    fullName: result.fullName,
                    gender: result.gender
                  }).toString()}`}
                >
                  {result.fullName}（{formatGenderLabel(result.gender)} / {formatGradeRange(result.grades)}）
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
