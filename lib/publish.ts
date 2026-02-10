const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parsePublishDateInput(value: string, mode: "start" | "end"): Date | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(DATE_INPUT_PATTERN);
  if (!match) {
    throw new Error("公開期間は YYYY-MM-DD 形式で入力してください");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate =
    mode === "start"
      ? new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
      : new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    throw new Error("公開期間の日付が不正です");
  }

  return utcDate;
}

export function toDateInputValue(value: Date | null | undefined): string {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}

function formatMonthDay(value: Date): string {
  return `${value.getUTCMonth() + 1}月${value.getUTCDate()}日`;
}

export function formatPublishRange(
  publishFrom: Date | null | undefined,
  publishUntil: Date | null | undefined
): string {
  if (publishFrom && publishUntil) {
    return `公開期限は${formatMonthDay(publishFrom)}～${formatMonthDay(publishUntil)}です`;
  }

  if (publishFrom) {
    return `公開期限は${formatMonthDay(publishFrom)}からです`;
  }

  if (publishUntil) {
    return `公開期限は${formatMonthDay(publishUntil)}までです`;
  }

  return "公開期限は未設定です";
}
