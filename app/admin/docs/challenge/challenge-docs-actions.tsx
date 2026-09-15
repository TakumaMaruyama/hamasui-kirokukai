"use client";

import { useEffect, useRef, useState } from "react";
import { getDownloadFilename } from "@/lib/download-filename";
import { formatTimeForDocument } from "@/lib/display-time";
import { formatGradeLabel } from "@/lib/grade";
import type { ChallengeDocumentMonth, ChallengeRankingPreview } from "@/lib/challenge-docs-types";

type MonthOption = ChallengeDocumentMonth;

async function readMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `処理に失敗しました (HTTP ${response.status})`;
  try {
    const payload = JSON.parse(text) as { message?: string };
    return payload.message ?? `処理に失敗しました (HTTP ${response.status})`;
  } catch {
    return text.trim() || `処理に失敗しました (HTTP ${response.status})`;
  }
}

function isUnauthorizedMessage(message: string): boolean {
  return /(?:unauthorized|認証|401|再度ログイン)/i.test(message);
}

function periodLabel(month: MonthOption | null): string {
  return month ? `${month.year}年${month.month}月` : "対象年月を選択";
}

export default function ChallengeDocsActions() {
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [preview, setPreview] = useState<ChallengeRankingPreview | null>(null);
  const [loading, setLoading] = useState<"months" | "preview" | null>("months");
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "info">("info");
  const [monthsLoadFailed, setMonthsLoadFailed] = useState(false);
  const [monthRequest, setMonthRequest] = useState(0);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewSequenceRef = useRef(0);

  const activeMonth = months.find((month) => `${month.year}-${month.month}` === selectedMonth) ?? null;
  const isBusy = loading !== null || downloading;

  useEffect(() => {
    const controller = new AbortController();
    setLoading("months");
    setMonthsLoadFailed(false);
    void (async () => {
      try {
        const response = await fetch("/api/admin/docs/challenge/months", { signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 ? "401 Unauthorized" : await readMessage(response));
        const payload = await response.json() as { months?: MonthOption[] };
        const options = Array.isArray(payload.months) ? payload.months : [];
        setMonths(options);
        setSelectedMonth((current) => current || (options[0] ? `${options[0].year}-${options[0].month}` : ""));
        if (options.length === 0) {
          setMessage("登録済みのチャレンジコース年月がありません");
          setMessageType("info");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const errorMessage = error instanceof Error ? error.message : "対象年月の取得に失敗しました";
        setMonthsLoadFailed(true);
        setMessage(isUnauthorizedMessage(errorMessage) ? "ログイン期限が切れました。管理者ログイン画面から再ログインしてください。" : errorMessage);
        setMessageType("error");
      } finally {
        if (!controller.signal.aborted) setLoading(null);
      }
    })();
    return () => controller.abort();
  }, [monthRequest]);

  useEffect(() => () => {
    previewAbortRef.current?.abort();
    previewSequenceRef.current += 1;
  }, []);

  const clearPreview = () => {
    previewAbortRef.current?.abort();
    previewSequenceRef.current += 1;
    setPreview(null);
  };

  const handleMonthChange = (value: string) => {
    if (isBusy) return;
    setSelectedMonth(value);
    clearPreview();
    setMessage(null);
  };

  const handlePreview = async () => {
    if (!activeMonth || isBusy) return;
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    const sequence = ++previewSequenceRef.current;
    setLoading("preview");
    setMessage(null);
    setPreview(null);
    try {
      const response = await fetch("/api/admin/docs/challenge/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: activeMonth.year, month: activeMonth.month }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(response.status === 401 ? "401 Unauthorized" : await readMessage(response));
      const payload = await response.json() as ChallengeRankingPreview;
      if (sequence !== previewSequenceRef.current) return;
      setPreview(payload);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (sequence !== previewSequenceRef.current) return;
      const errorMessage = error instanceof Error ? error.message : "対象確認に失敗しました";
      setMessage(isUnauthorizedMessage(errorMessage) ? "ログイン期限が切れました。管理者ログイン画面から再ログインしてください。" : errorMessage);
      setMessageType("error");
    } finally {
      if (sequence === previewSequenceRef.current) setLoading(null);
    }
  };

  const download = async () => {
    if (!activeMonth || !preview || preview.counts.records === 0 || isBusy) return;
    setDownloading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/docs/challenge/rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: activeMonth.year, month: activeMonth.month })
      });
      if (!response.ok) throw new Error(response.status === 401 ? "401 Unauthorized" : await readMessage(response));
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("PDFの内容を受信できませんでした");
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = getDownloadFilename(response.headers.get("Content-Disposition"), preview.filename || "challenge_ranking.pdf");
      link.style.display = "none";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "ダウンロードに失敗しました";
      setMessage(isUnauthorizedMessage(errorMessage) ? "ログイン期限が切れました。管理者ログイン画面から再ログインしてください。" : errorMessage);
      setMessageType("error");
    } finally {
      setDownloading(false);
    }
  };

  const retryMonths = () => {
    if (isBusy) return;
    setMessage(null);
    setMonthRequest((current) => current + 1);
  };

  return (
    <div className="swimming-docs-actions">
      <div className="swimming-docs-period">
        <label htmlFor="challenge-docs-period">対象年月</label>
        <select id="challenge-docs-period" value={selectedMonth} onChange={(event) => handleMonthChange(event.target.value)} disabled={isBusy || months.length === 0}>
          {months.length === 0 && <option value="">{loading === "months" ? "読み込み中..." : monthsLoadFailed ? "取得できませんでした" : "登録済み年月なし"}</option>}
          {months.map((month) => <option key={`${month.year}-${month.month}`} value={`${month.year}-${month.month}`}>{month.year}年{month.month}月</option>)}
        </select>
        <p className="notice">{activeMonth ? `${periodLabel(activeMonth)}のランキングを作成します。` : "登録済みの対象年月を選択してください。"}</p>
      </div>

      {message && (
        <p className={`swimming-docs-message ${messageType}`} aria-live="polite">
          {message}
          {message.includes("再ログイン") && <> <a href="/admin">ログイン画面を開く</a></>}
          {monthsLoadFailed && !message.includes("再ログイン") && loading === null && <> <button type="button" className="swimming-docs-retry" onClick={retryMonths}>年月を再読み込み</button></>}
        </p>
      )}

      <section className="swimming-docs-section">
        <h2>ランキング</h2>
        <p className="notice">対象年月に記録のある全員を掲載します。</p>
        <div className="swimming-docs-buttons">
          <button type="button" onClick={() => void handlePreview()} disabled={!activeMonth || isBusy}>{loading === "preview" ? "対象を確認中..." : "対象を確認"}</button>
          <button type="button" className="secondary" onClick={() => void download()} disabled={!preview || preview.counts.records === 0 || isBusy}>{downloading ? "ダウンロード中..." : "PDFをダウンロード"}</button>
        </div>

        {preview && (
          <div className="swimming-docs-preview">
            <p>{preview.counts.records === 0 ? "条件に一致する対象はありません" : `掲載 ${preview.counts.records}件・${preview.counts.events}種目`}</p>
            {preview.groups.length > 0 && (
              <details>
                <summary>対象一覧を表示</summary>
                <ul>
                  {preview.groups.map((eventGroup) => (
                    <li key={eventGroup.eventTitle}>
                      <strong>{eventGroup.eventTitle}</strong>
                      <ul>
                        {eventGroup.gradeGroups.map((gradeGroup) => (
                          <li key={gradeGroup.grade}>
                            {formatGradeLabel(gradeGroup.grade)}
                            <ul>
                              <li>男子: {gradeGroup.maleEntries.length === 0 ? "対象なし" : gradeGroup.maleEntries.map((entry, index) => <span key={`${entry.fullName}-${entry.timeText}-${index}`}>{index > 0 ? "、" : ""}{entry.rank}位 {entry.displayName} {formatTimeForDocument(entry)}</span>)}</li>
                              <li>女子: {gradeGroup.femaleEntries.length === 0 ? "対象なし" : gradeGroup.femaleEntries.map((entry, index) => <span key={`${entry.fullName}-${entry.timeText}-${index}`}>{index > 0 ? "、" : ""}{entry.rank}位 {entry.displayName} {formatTimeForDocument(entry)}</span>)}</li>
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
