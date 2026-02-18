export const WEEKDAY_VALUES = ["月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜"] as const;

export type MeetWeekday = (typeof WEEKDAY_VALUES)[number];

export type MeetContext = {
  year: number;
  month: number;
  weekday?: MeetWeekday;
};

const CONTEXT_TITLE_PATTERN = /^(\d{4})年(\d{1,2})月(?:([月火水木金土日])曜(?:日)?)?(?:\s*(.+))?$/;

type ParsedMeetTitle = {
  year: number;
  month: number;
  weekday?: MeetWeekday;
  suffix?: string;
};

function normalizeDateParts(year: number, month: number, day: number): string | null {
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function heldOnFromMeetContext(context: Pick<MeetContext, "year" | "month">): string | null {
  return normalizeDateParts(context.year, context.month, 1);
}

export function formatMeetTitle(context: MeetContext): string {
  const weekday = context.weekday ?? "";
  return `${context.year}年${context.month}月${weekday}`;
}

function parseMeetTitle(title: string): ParsedMeetTitle | null {
  const match = title.trim().match(CONTEXT_TITLE_PATTERN);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const weekday = match[3] ? (`${match[3]}曜` as MeetWeekday) : undefined;

  if (!heldOnFromMeetContext({ year, month })) {
    return null;
  }

  const suffix = match[4]?.trim();

  const base: ParsedMeetTitle = weekday ? { year, month, weekday } : { year, month };
  return suffix ? { ...base, suffix } : base;
}

export function parseMeetTitleContext(title: string): MeetContext | null {
  const parsed = parseMeetTitle(title);
  if (!parsed) {
    return null;
  }

  return {
    year: parsed.year,
    month: parsed.month,
    ...(parsed.weekday ? { weekday: parsed.weekday } : {})
  };
}

export function formatMeetLabel(meet: { title: string; heldOn: Date }): string {
  const parsed = parseMeetTitle(meet.title);

  if (parsed) {
    const baseLabel = parsed.weekday
      ? `${parsed.year}年${parsed.month}月 ${parsed.weekday}`
      : `${parsed.year}年${parsed.month}月`;
    return parsed.suffix ? `${baseLabel} ${parsed.suffix}` : baseLabel;
  }

  return `${meet.title} (${meet.heldOn.toISOString().slice(0, 10)})`;
}

export function formatMeetMonthLabel(meet: { title: string; heldOn: Date }): string {
  const context = parseMeetTitleContext(meet.title);

  if (context) {
    return `${context.year}年${context.month}月`;
  }

  return meet.heldOn.toISOString().slice(0, 7);
}
