import { parse } from "csv-parse/sync";
import { MeetContext, formatMeetTitle, heldOnFromMeetContext } from "./meet-context";

export type CsvRow = {
  meet_title: string;
  held_on: string;
  full_name: string;
  grade: string;
  gender: string;
  event_title: string;
  style: string;
  distance_m: string;
  lane?: string;
  time_text: string;
};

type CsvValue = string | string[] | undefined;
type RawCsvRow = Record<string, CsvValue>;

type ParseCsvOptions = {
  fileName?: string;
  meetContext?: MeetContext;
};

const REQUIRED_COLUMNS: Array<keyof CsvRow> = [
  "meet_title",
  "held_on",
  "full_name",
  "grade",
  "gender",
  "event_title",
  "style",
  "distance_m",
  "time_text"
];

const LEGACY_COLUMNS = ["full_name", "grade", "gender", "event_title", "time_text"];

const HEADER_ALIASES: Record<string, keyof CsvRow> = {
  meet_title: "meet_title",
  "記録会名称": "meet_title",
  held_on: "held_on",
  "開催日": "held_on",
  full_name: "full_name",
  "氏名": "full_name",
  grade: "grade",
  "学年": "grade",
  gender: "gender",
  "性別": "gender",
  event_title: "event_title",
  "種目名": "event_title",
  "種目": "event_title",
  style: "style",
  "泳法": "style",
  distance_m: "distance_m",
  "距離": "distance_m",
  lane: "lane",
  "レーン": "lane",
  "コース": "lane",
  time_text: "time_text",
  "記録": "time_text",
  "タイム": "time_text",
  "名前": "full_name"
};

function normalizeHeaderName(rawHeader: string): string {
  const normalized = rawHeader.replace(/^\uFEFF/, "").trim();
  const lowered = normalized.toLowerCase();
  return HEADER_ALIASES[lowered] ?? HEADER_ALIASES[normalized] ?? lowered;
}

function toSet(values: string[]): Set<string> {
  return new Set(values.map((value) => value.trim()).filter(Boolean));
}

function pickCellValue(value: CsvValue, mode: "first" | "last" = "first"): string {
  if (!Array.isArray(value)) {
    return value?.trim() ?? "";
  }

  const candidates = mode === "first" ? value : [...value].reverse();

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return value[0]?.trim() ?? "";
}

function toHalfWidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

const GRADE_ALIASES: Record<string, string> = {
  "年少々": "0",
  "年少": "1",
  "年中": "2",
  "年長": "3",
  "小1": "1",
  "小2": "2",
  "小3": "3",
  "小4": "4",
  "小5": "5",
  "小6": "6",
  "中1": "7",
  "中2": "8",
  "中3": "9",
  "高1": "10",
  "高2": "11",
  "高3": "12"
};

function normalizeGrade(rawGrade: string): string {
  const trimmed = toHalfWidthDigits(rawGrade.trim());
  if (!trimmed) {
    return "";
  }

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  if (GRADE_ALIASES[trimmed]) {
    return GRADE_ALIASES[trimmed];
  }

  const elementaryMatch = trimmed.match(/^小\s*(\d+)$/);
  if (elementaryMatch) {
    return elementaryMatch[1];
  }

  const middleMatch = trimmed.match(/^中\s*(\d+)$/);
  if (middleMatch) {
    return String(6 + Number(middleMatch[1]));
  }

  const highMatch = trimmed.match(/^高\s*(\d+)$/);
  if (highMatch) {
    return String(9 + Number(highMatch[1]));
  }

  return trimmed;
}

function normalizeGender(rawGender: string): string {
  const trimmed = rawGender.trim().toLowerCase();

  if (["male", "m", "男", "男子", "男性"].includes(trimmed)) {
    return "male";
  }

  if (["female", "f", "女", "女子", "女性"].includes(trimmed)) {
    return "female";
  }

  if (["other", "その他"].includes(trimmed)) {
    return "other";
  }

  return rawGender.trim();
}

function extractDistance(eventTitle: string): string {
  const normalized = toHalfWidthDigits(eventTitle);
  const match = normalized.match(/(\d+)\s*[mｍ]/i);
  return match?.[1] ?? "";
}

function normalizeStyle(eventTitle: string): string {
  if (eventTitle.includes("自由形") || eventTitle.includes("クロール")) {
    return "free";
  }

  if (eventTitle.includes("背泳ぎ")) {
    return "back";
  }

  if (eventTitle.includes("平泳ぎ")) {
    return "breast";
  }

  if (eventTitle.includes("バタフライ")) {
    return "fly";
  }

  if (eventTitle.includes("メドレー")) {
    return "im";
  }

  if (eventTitle.includes("キック")) {
    return "kick";
  }

  return "other";
}

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

function deriveHeldOn(fileName?: string, meetContext?: MeetContext): string | null {
  if (meetContext) {
    return heldOnFromMeetContext(meetContext);
  }

  if (!fileName) {
    return null;
  }

  const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, "");
  const normalized = toHalfWidthDigits(nameWithoutExtension);

  const ymdMatch = normalized.match(/(\d{4})[-_.\/](\d{1,2})[-_.\/](\d{1,2})/);
  if (ymdMatch) {
    return normalizeDateParts(Number(ymdMatch[1]), Number(ymdMatch[2]), Number(ymdMatch[3]));
  }

  const ymMatch = normalized.match(/(\d{2})[-_.\/](\d{1,2})/);
  if (ymMatch) {
    const year = 2000 + Number(ymMatch[1]);
    const month = Number(ymMatch[2]);
    return normalizeDateParts(year, month, 1);
  }

  return null;
}

function deriveMeetTitle(fileName?: string, meetContext?: MeetContext): string | null {
  if (meetContext) {
    return formatMeetTitle(meetContext);
  }

  if (!fileName) {
    return null;
  }

  const fileNameOnly = fileName.split(/[/\\]/).at(-1) ?? fileName;
  const nameWithoutExtension = fileNameOnly.replace(/\.[^/.]+$/, "").trim();
  return nameWithoutExtension || null;
}

function missingColumns(columnSet: Set<string>): string[] {
  return REQUIRED_COLUMNS.filter((column) => !columnSet.has(column));
}

function hasColumns(columnSet: Set<string>, requiredColumns: string[]): boolean {
  return requiredColumns.every((column) => columnSet.has(column));
}

function normalizeCanonicalRows(rows: RawCsvRow[]): CsvRow[] {
  return rows.map((row) => ({
    meet_title: pickCellValue(row.meet_title),
    held_on: pickCellValue(row.held_on),
    full_name: pickCellValue(row.full_name),
    grade: pickCellValue(row.grade),
    gender: pickCellValue(row.gender),
    event_title: pickCellValue(row.event_title),
    style: pickCellValue(row.style),
    distance_m: pickCellValue(row.distance_m),
    lane: pickCellValue(row.lane) || undefined,
    time_text: pickCellValue(row.time_text)
  }));
}

function normalizeLegacyRows(rows: RawCsvRow[], options: ParseCsvOptions): CsvRow[] {
  const meetTitle = deriveMeetTitle(options.fileName, options.meetContext);
  const heldOn = deriveHeldOn(options.fileName, options.meetContext);

  if (!meetTitle) {
    throw new Error("名簿CSVの変換に失敗しました: 記録会名を判定できませんでした");
  }

  if (!heldOn) {
    throw new Error("名簿CSVの変換に失敗しました: 開催年月を判定できませんでした");
  }

  const normalizedRows: CsvRow[] = [];

  for (const [index, row] of rows.entries()) {
    const eventTitle = pickCellValue(row.event_title);
    const fullName = pickCellValue(row.full_name).replace(/\s+/g, " ").trim();
    const gender = normalizeGender(pickCellValue(row.gender));
    const grade = normalizeGrade(pickCellValue(row.grade));
    const timeText = pickCellValue(row.time_text).replace(/\s+/g, "");
    const lane = pickCellValue(row.lane);

    if (!fullName && !timeText) {
      continue;
    }

    // 出欠簿ルール: 名前があるのに種目が空の場合は欠席として取り込み対象外にする
    if (fullName && !eventTitle) {
      continue;
    }

    if (!eventTitle || !fullName || !gender || !grade || !timeText) {
      throw new Error(`${index + 2}行目: 名簿CSVの必須項目が不足しています`);
    }

    const distanceM = extractDistance(eventTitle);
    if (!distanceM) {
      throw new Error(`${index + 2}行目: 種目から距離を判定できませんでした (${eventTitle})`);
    }

    normalizedRows.push({
      meet_title: meetTitle,
      held_on: heldOn,
      full_name: fullName,
      grade,
      gender,
      event_title: eventTitle,
      style: normalizeStyle(eventTitle),
      distance_m: distanceM,
      lane: lane || undefined,
      time_text: timeText
    });
  }

  if (normalizedRows.length === 0) {
    throw new Error("名簿CSVの有効なデータ行が見つかりませんでした");
  }

  return normalizedRows;
}

export function parseCsv(content: string, options: ParseCsvOptions = {}): CsvRow[] {
  try {
    const rows = parse(content, {
      bom: true,
      columns: (headers: string[]) => headers.map(normalizeHeaderName),
      skip_empty_lines: true,
      trim: true,
      group_columns_by_name: true,
      relax_column_count: true
    }) as RawCsvRow[];

    if (rows.length === 0) {
      return [];
    }

    const columns = toSet(Object.keys(rows[0]));

    if (hasColumns(columns, REQUIRED_COLUMNS)) {
      return normalizeCanonicalRows(rows);
    }

    if (hasColumns(columns, LEGACY_COLUMNS) && !columns.has("meet_title") && !columns.has("held_on")) {
      return normalizeLegacyRows(rows, options);
    }

    const missing = missingColumns(columns);
    if (missing.length > 0) {
      throw new Error(`必須列が不足しています: ${missing.join(", ")}`);
    }

    return normalizeCanonicalRows(rows);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`CSV解析に失敗しました: ${error.message}`);
    }

    throw new Error("CSV解析に失敗しました");
  }
}

function decodeWithEncoding(bytes: Uint8Array, encoding: string): string | null {
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return null;
  }
}

function replacementCount(text: string): number {
  return (text.match(/\uFFFD/g) ?? []).length;
}

export async function readCsvText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const utf8 = decodeWithEncoding(bytes, "utf-8");
  const shiftJis = decodeWithEncoding(bytes, "shift_jis");

  if (!utf8 && !shiftJis) {
    throw new Error("CSVの文字コードを判定できませんでした");
  }

  if (!utf8) {
    return shiftJis as string;
  }

  if (!shiftJis) {
    return utf8;
  }

  return replacementCount(shiftJis) < replacementCount(utf8) ? shiftJis : utf8;
}
