"use client";

import { useEffect, useRef, useState } from "react";
import { getDownloadFilename } from "@/lib/download-filename";
import { WEEKDAY_VALUES, type MeetWeekday } from "@/lib/meet-context";
import type { SwimmingDocumentKind, SwimmingDocumentMonth, SwimmingDocumentPreview } from "@/lib/swimming-docs-types";

type DocumentKind = SwimmingDocumentKind;
type MonthOption = SwimmingDocumentMonth;
type PreviewPayload = SwimmingDocumentPreview;

const DOCUMENTS: Array<{
  kind: DocumentKind;
  title: string;
  endpoint: string;
  defaultFilename: string;
}> = [
  { kind: "records", title: "一般コース記録証", endpoint: "/api/admin/docs/swimming/records", defaultFilename: "swimming_records.pdf" },
  { kind: "certificates", title: "1位賞状", endpoint: "/api/admin/docs/swimming/certificates", defaultFilename: "swimming_certificates.pdf" },
  { kind: "historical-firsts", title: "歴代1位記録一覧", endpoint: "/api/admin/docs/swimming/historical-firsts", defaultFilename: "swimming_historical_firsts.pdf" }
];

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

function previewSummary(preview: PreviewPayload): string {
  if (preview.counts.records === 0) return "条件に一致する対象はありません";
  if (preview.kind === "historical-firsts") {
    return `掲載 ${preview.counts.records}件・${preview.counts.events ?? 0}種目`;
  }
  return `対象 ${preview.counts.people ?? 0}人・${preview.counts.pages ?? 0}枚`;
}

export default function SwimmingDocsActions() {
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [weekday, setWeekday] = useState<MeetWeekday | "">("");
  const [recordName, setRecordName] = useState("");
  const [certificateName, setCertificateName] = useState("");
  const [previews, setPreviews] = useState<Partial<Record<DocumentKind, PreviewPayload>>>({});
  const [loadingKind, setLoadingKind] = useState<DocumentKind | "months" | null>("months");
  const [downloadingKind, setDownloadingKind] = useState<DocumentKind | "rankings" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "info">("info");
  const [monthsLoadFailed, setMonthsLoadFailed] = useState(false);
  const [monthRequest, setMonthRequest] = useState(0);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewSequenceRef = useRef(0);
  const previewKindRef = useRef<DocumentKind | null>(null);

  const activeMonth = months.find((month) => `${month.year}-${month.month}` === selectedMonth) ?? null;
  const isBusy = loadingKind !== null || downloadingKind !== null;

  useEffect(() => {
    const controller = new AbortController();
    setLoadingKind("months");
    setMonthsLoadFailed(false);
    void (async () => {
      try {
        const response = await fetch("/api/admin/docs/swimming/months", { signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 ? "401 Unauthorized" : await readMessage(response));
        const payload = await response.json() as { months?: MonthOption[] };
        const options = Array.isArray(payload.months) ? payload.months : [];
        setMonths(options);
        setMonthsLoadFailed(false);
        setSelectedMonth((current) => current || (options[0] ? `${options[0].year}-${options[0].month}` : ""));
        if (options.length === 0) {
          setMessage("登録済みの記録会年月がありません");
          setMessageType("info");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const errorMessage = error instanceof Error ? error.message : "対象年月の取得に失敗しました";
        setMonthsLoadFailed(true);
        setMessage(isUnauthorizedMessage(errorMessage) ? "ログイン期限が切れました。管理者ログイン画面から再ログインしてください。" : errorMessage);
        setMessageType("error");
      } finally {
        if (!controller.signal.aborted) setLoadingKind(null);
      }
    })();
    return () => controller.abort();
  }, [monthRequest]);

  useEffect(() => () => {
    previewAbortRef.current?.abort();
    previewSequenceRef.current += 1;
    previewKindRef.current = null;
  }, []);

  const discardPreviews = (kinds: DocumentKind[]) => {
    if (previewKindRef.current && kinds.includes(previewKindRef.current)) {
      previewAbortRef.current?.abort();
      previewSequenceRef.current += 1;
      previewKindRef.current = null;
    }
    setPreviews((current) => {
      const next = { ...current };
      for (const kind of kinds) delete next[kind];
      return next;
    });
    setMessage(null);
  };

  const handleMonthChange = (value: string) => {
    if (isBusy) return;
    setSelectedMonth(value);
    discardPreviews(DOCUMENTS.map((document) => document.kind));
  };

  const handlePreview = async (kind: DocumentKind) => {
    if (!activeMonth || isBusy) return;
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    previewKindRef.current = kind;
    const sequence = ++previewSequenceRef.current;
    setLoadingKind(kind);
    setMessage(null);
    setPreviews((current) => {
      const next = { ...current };
      delete next[kind];
      return next;
    });
    try {
      const body = {
        kind,
        year: activeMonth.year,
        month: activeMonth.month,
        ...(kind === "records" && weekday ? { weekday } : {}),
        ...(kind === "records" && recordName.trim() ? { fullName: recordName.trim() } : {}),
        ...(kind === "certificates" && certificateName.trim() ? { fullName: certificateName.trim() } : {})
      };
      const response = await fetch("/api/admin/docs/swimming/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(response.status === 401 ? "401 Unauthorized" : await readMessage(response));
      const preview = await response.json() as PreviewPayload;
      if (sequence !== previewSequenceRef.current) return;
      setPreviews((current) => ({ ...current, [kind]: preview }));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (sequence !== previewSequenceRef.current) return;
      const isUnauthorized = error instanceof Error && isUnauthorizedMessage(error.message);
      setMessage(isUnauthorized ? "ログイン期限が切れました。管理者ログイン画面から再ログインしてください。" : error instanceof Error ? error.message : "対象確認に失敗しました");
      setMessageType("error");
    } finally {
      if (sequence === previewSequenceRef.current) {
        previewKindRef.current = null;
        setLoadingKind(null);
      }
    }
  };

  const download = async (kind: DocumentKind | "rankings") => {
    if (!activeMonth || isBusy) return;
    const documentConfig = kind === "rankings" ? null : DOCUMENTS.find((candidate) => candidate.kind === kind);
    const preview = documentConfig ? previews[documentConfig.kind] : undefined;
    if (documentConfig && (!preview || preview.counts.records === 0)) return;
    setDownloadingKind(kind);
    setMessage(null);
    try {
      const body = {
        year: activeMonth.year,
        month: activeMonth.month,
        ...(kind === "records" && weekday ? { weekday } : {}),
        ...(kind === "records" && recordName.trim() ? { fullName: recordName.trim() } : {}),
        ...(kind === "certificates" && certificateName.trim() ? { fullName: certificateName.trim() } : {})
      };
      const endpoint = kind === "rankings" ? "/api/admin/docs/swimming/rankings" : documentConfig!.endpoint;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(response.status === 401 ? "401 Unauthorized" : await readMessage(response));
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("PDFの内容を受信できませんでした");
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = getDownloadFilename(
        response.headers.get("Content-Disposition"),
        preview?.filename ?? documentConfig?.defaultFilename ?? "swimming_rankings.zip"
      );
      link.style.display = "none";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      const isUnauthorized = error instanceof Error && isUnauthorizedMessage(error.message);
      setMessage(isUnauthorized ? "ログイン期限が切れました。管理者ログイン画面から再ログインしてください。" : error instanceof Error ? error.message : "ダウンロードに失敗しました");
      setMessageType("error");
    } finally {
      setDownloadingKind(null);
    }
  };

  const changeCondition = (kind: DocumentKind, change: () => void) => {
    if (isBusy) return;
    change();
    discardPreviews([kind]);
  };

  const retryMonths = () => {
    if (isBusy) return;
    setMessage(null);
    setLoadingKind("months");
    setMonthRequest((current) => current + 1);
  };

  const renderDocumentSection = (document: (typeof DOCUMENTS)[number]) => {
    const preview = previews[document.kind];
    const isLoading = loadingKind === document.kind;
    const isDownloading = downloadingKind === document.kind;
    return (
      <section className="swimming-docs-section" key={document.kind}>
        <h2>{document.title}</h2>
        {document.kind === "records" && (
          <div className="swimming-docs-filters">
            <div>
              <label htmlFor="swimming-record-weekday">曜日</label>
              <select
                id="swimming-record-weekday"
                value={weekday}
                disabled={isBusy}
                onChange={(event) => changeCondition("records", () => setWeekday(event.target.value as MeetWeekday | ""))}
              >
                <option value="">指定なし</option>
                {WEEKDAY_VALUES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="swimming-record-name">氏名（任意）</label>
              <input
                id="swimming-record-name"
                type="text"
                value={recordName}
                disabled={isBusy}
                onChange={(event) => changeCondition("records", () => setRecordName(event.target.value))}
                placeholder="例: 山田 太郎"
              />
            </div>
          </div>
        )}
        {document.kind === "certificates" && (
          <div className="swimming-docs-filters single">
            <div>
              <label htmlFor="swimming-certificate-name">氏名（任意）</label>
              <input
                id="swimming-certificate-name"
                type="text"
                value={certificateName}
                disabled={isBusy}
                onChange={(event) => changeCondition("certificates", () => setCertificateName(event.target.value))}
                placeholder="例: 山田 太郎"
              />
            </div>
          </div>
        )}
        <div className="swimming-docs-buttons">
          <button type="button" onClick={() => void handlePreview(document.kind)} disabled={!activeMonth || isBusy}>
            {isLoading ? "対象を確認中..." : "対象を確認"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void download(document.kind)}
            disabled={!preview || preview.counts.records === 0 || isBusy}
          >
            {isDownloading ? "ダウンロード中..." : "PDFをダウンロード"}
          </button>
        </div>
        {preview && (
          <div className="swimming-docs-preview">
            <p>{previewSummary(preview)}</p>
            {preview.items.length > 0 && (
              <details>
                <summary>対象一覧を表示</summary>
                <ul>
                  {preview.items.map((item, index) => (
                    <li key={`${item.name}-${index}`}>
                      <strong>{item.name}</strong>（{item.gradeLabel}・{item.genderLabel}{item.weekday ? `・${item.weekday}` : ""}）
                      <ul>
                        {item.entries.map((entry, entryIndex) => (
                          <li key={`${entry.eventTitle}-${entry.timeText}-${entryIndex}`}>
                            {entry.eventTitle} {entry.timeText}
                            {entry.recordMonthLabel ? `（${entry.recordMonthLabel}）` : ""}
                            {entry.isNewRecordInTargetMonth ? " NEW" : ""}
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
    );
  };

  return (
    <div className="swimming-docs-actions">
      <div className="swimming-docs-period">
        <label htmlFor="swimming-docs-period">対象年月</label>
        <select
          id="swimming-docs-period"
          value={selectedMonth}
          onChange={(event) => handleMonthChange(event.target.value)}
          disabled={isBusy || months.length === 0}
        >
          {months.length === 0 && <option value="">{loadingKind === "months" ? "読み込み中..." : monthsLoadFailed ? "取得できませんでした" : "登録済み年月なし"}</option>}
          {months.map((month) => (
            <option key={`${month.year}-${month.month}`} value={`${month.year}-${month.month}`}>
              {month.year}年{month.month}月
            </option>
          ))}
        </select>
        <p className="notice">{activeMonth ? `${periodLabel(activeMonth)}の記録を作成します。` : "登録済みの対象年月を選択してください。"}</p>
      </div>

      {message && (
        <p className={`swimming-docs-message ${messageType}`} aria-live="polite">
          {message}
          {message.includes("再ログイン") && <> <a href="/admin">ログイン画面を開く</a></>}
          {monthsLoadFailed && !message.includes("再ログイン") && loadingKind === null && (
            <>
              {" "}
              <button type="button" className="swimming-docs-retry" onClick={retryMonths}>
                年月を再読み込み
              </button>
            </>
          )}
        </p>
      )}

      {renderDocumentSection(DOCUMENTS[0])}
      {renderDocumentSection(DOCUMENTS[1])}

      <section className="swimming-docs-section">
        <h2>ランキング</h2>
        <p className="notice">種目ごとに男女左右で1〜3位を出力します。</p>
        <button type="button" onClick={() => void download("rankings")} disabled={!activeMonth || isBusy}>
          {downloadingKind === "rankings" ? "ダウンロード中..." : "PDFをダウンロード"}
        </button>
      </section>
      {renderDocumentSection(DOCUMENTS[2])}
    </div>
  );
}
