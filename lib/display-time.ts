import { parseTimeToMs } from "./time";

type DisplayTimeInput = {
  timeText: string;
  timeMs?: number;
};

function formatMsAsJapanese(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const restMs = ms - minutes * 60_000;
  const seconds = Math.floor(restMs / 1000);
  const hundredths = Math.floor((restMs % 1000) / 10);

  if (hundredths > 0) {
    return `${minutes}分${seconds}秒${String(hundredths).padStart(2, "0")}`;
  }

  return `${minutes}分${seconds}秒`;
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

  if (ms > 60_000) {
    return formatMsAsJapanese(ms);
  }

  return trimmed;
}
