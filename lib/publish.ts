const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parsePublishUntilInput(value: string): Date | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(DATE_INPUT_PATTERN);
  if (!match) {
    throw new Error("公開期限は YYYY-MM-DD 形式で入力してください");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const endOfDayUtc = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  if (
    endOfDayUtc.getUTCFullYear() !== year ||
    endOfDayUtc.getUTCMonth() !== month - 1 ||
    endOfDayUtc.getUTCDate() !== day
  ) {
    throw new Error("公開期限の日付が不正です");
  }

  return endOfDayUtc;
}

export function isPublicNow(publishUntil: Date | null | undefined, now = new Date()): boolean {
  return Boolean(publishUntil && publishUntil.getTime() >= now.getTime());
}

export function toDateInputValue(publishUntil: Date | null | undefined): string {
  if (!publishUntil) {
    return "";
  }

  return publishUntil.toISOString().slice(0, 10);
}

export function formatPublishUntil(publishUntil: Date | null | undefined): string {
  if (!publishUntil) {
    return "未設定";
  }

  return publishUntil.toISOString().slice(0, 10);
}
