import { parseTimeToMs } from "./time";

type DisplayTimeInput = {
  timeText: string;
  timeMs?: number;
};

function formatMsAsJapanese(ms: number): string {
  const normalizedMs = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(normalizedMs / 60_000);
  const restMs = normalizedMs - minutes * 60_000;
  const seconds = Math.floor(restMs / 1000);
  const hundredths = Math.floor((restMs % 1000) / 10);

  if (normalizedMs > 60_000) {
    return `${minutes}分${seconds}秒${String(hundredths).padStart(2, "0")}`;
  }

  const totalSeconds = Math.floor(normalizedMs / 1000);
  return `${totalSeconds}秒${String(hundredths).padStart(2, "0")}`;
}

export function formatImprovementTotal(ms: number): string {
  const normalizedMs = Math.max(0, Math.floor(ms));
  return `${(normalizedMs / 1000).toFixed(2)}秒`;
}

export function formatTimeForDocument(input: DisplayTimeInput): string {
  const trimmed = input.timeText.trim();
  if (!trimmed) {
    return "";
  }

  let ms = input.timeMs;
  if (ms === undefined) {
    try {
      ms = parseTimeToMs(trimmed);
    } catch {
      return trimmed;
    }
  }

  return formatMsAsJapanese(ms);
}
