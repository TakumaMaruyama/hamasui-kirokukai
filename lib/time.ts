export function parseTimeToMs(timeText: string): number {
  const trimmed = timeText.trim();
  if (!trimmed) {
    throw new Error("time_text is empty");
  }

  const parts = trimmed.split(":");
  let minutes = 0;
  let secondsPart = trimmed;

  if (parts.length === 2) {
    minutes = Number(parts[0]);
    secondsPart = parts[1];
  } else if (parts.length > 2) {
    throw new Error("Invalid time format");
  }

  const [secStr, msStr] = secondsPart.split(".");
  const seconds = Number(secStr);
  const milliseconds = msStr ? Number(msStr.padEnd(3, "0")) : 0;

  if ([minutes, seconds, milliseconds].some((value) => Number.isNaN(value))) {
    throw new Error("Invalid time format");
  }

  return minutes * 60_000 + seconds * 1000 + milliseconds;
}
