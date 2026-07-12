export function parseTimeToMs(timeText: string): number {
  const trimmed = timeText.normalize("NFKC").trim();
  if (!trimmed) {
    throw new Error("time_text is empty");
  }

  const match = trimmed.match(/^(?:(\d+):)?(\d+)(?:\.(\d{1,3}))?$/);
  if (!match) {
    throw new Error("Invalid time format");
  }

  const hasMinutes = typeof match[1] === "string";
  const minutes = hasMinutes ? Number(match[1]) : 0;
  const seconds = Number(match[2]);
  const milliseconds = match[3] ? Number(match[3].padEnd(3, "0")) : 0;

  if (hasMinutes && seconds >= 60) {
    throw new Error("Invalid time format");
  }

  const total = minutes * 60_000 + seconds * 1000 + milliseconds;
  if (!Number.isSafeInteger(total)) {
    throw new Error("Invalid time format");
  }

  return total;
}
