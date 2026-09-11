import { Gender } from "@prisma/client";
import { toComparableEventBaseKey } from "./event-key";

export type RankingSourceResult = {
  rank: number;
  timeText: string;
  isNewRecordInTargetMonth?: boolean;
  recordMonthLabel?: string;
  athlete: { fullName: string; fullNameKana?: string | null };
  event: {
    id: string;
    title: string;
    distanceM?: number;
    style?: string;
    grade: number;
    gender: Gender;
  };
};

export type HistoricalFirstSourceResult = {
  timeMs: number;
  timeText: string;
  athlete: { id?: string; fullName: string; fullNameKana?: string | null };
  event: {
    title: string;
    distanceM: number;
    style: string;
    grade: number;
    gender: Gender;
  };
  meet: {
    heldOn: Date;
  };
};

export type RankingEntry = {
  rank: number;
  fullName: string;
  displayName: string;
  timeText: string;
  isNewRecordInTargetMonth?: boolean;
  recordMonthLabel?: string;
};

export type RankingGroup = {
  eventId: string;
  eventTitle: string;
  grade: number;
  gender: Gender;
  entries: RankingEntry[];
};

export type ChallengeGradeRankingGroup = {
  grade: number;
  maleEntries: RankingEntry[];
  femaleEntries: RankingEntry[];
};

export type ChallengeEventRankingGroup = {
  eventTitle: string;
  gradeGroups: ChallengeGradeRankingGroup[];
};

export type PreschoolNameMode = "none" | "kanaOnly" | "nameAndKana";
export type ChallengeGradeRangeMode = "existing" | "minToMax";

export type RankingDisplayOptions = {
  preschoolNameMode?: PreschoolNameMode;
  preschoolMaxGrade?: number;
};

export type ChallengeRankingBuildOptions = RankingDisplayOptions & {
  minRank?: number;
  maxRank?: number;
  gradeRangeMode?: ChallengeGradeRangeMode;
  gradeSequence?: number[];
  excludeOtherGender?: boolean;
};

export type HistoricalFirstChallengeBuildOptions = {
  targetMonthStart?: Date;
  targetMonthEnd?: Date;
  gradeRangeMode?: ChallengeGradeRangeMode;
  gradeSequence?: number[];
  excludeOtherGender?: boolean;
};

const GENDER_ORDER: Record<Gender, number> = {
  male: 0,
  female: 1,
  other: 2
};

const DEFAULT_PRESCHOOL_MAX_GRADE = 3;
const FIXED_EVENT_ORDER = [
  "15m板キック",
  "15m板クロール",
  "15mクロール",
  "30mクロール",
  "15m平泳ぎ",
  "30m平泳ぎ"
] as const;

function normalizeKana(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeAthleteNameKey(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isPreschoolGrade(grade: number, preschoolMaxGrade: number): boolean {
  return grade >= 0 && grade <= preschoolMaxGrade;
}

function toRankingDisplayName(
  input: { fullName: string; fullNameKana?: string | null; grade: number },
  options: RankingDisplayOptions = {}
): string {
  const mode = options.preschoolNameMode ?? "none";
  const preschoolMaxGrade = options.preschoolMaxGrade ?? DEFAULT_PRESCHOOL_MAX_GRADE;

  if (mode === "none" || !isPreschoolGrade(input.grade, preschoolMaxGrade)) {
    return input.fullName;
  }

  const fullNameKana = normalizeKana(input.fullNameKana);
  if (!fullNameKana) {
    return input.fullName;
  }

  if (mode === "kanaOnly") {
    return fullNameKana;
  }

  if (mode === "nameAndKana") {
    return `${input.fullName}（${fullNameKana}）`;
  }

  return input.fullName;
}

function sortRankingEntries(entries: RankingEntry[]): RankingEntry[] {
  return [...entries].sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }

    return a.fullName.localeCompare(b.fullName, "ja");
  });
}

function normalizeEventTitle(value: string): string {
  return value
    .replace(/\u3000/g, " ")
    .replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeEventTitleForOrder(value: string): string {
  return normalizeEventTitle(value).replace(/\s+/g, "");
}

function normalizeEventTitleForDisplay(value: string): string {
  return value
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const FIXED_EVENT_ORDER_MAP = new Map<string, number>(
  FIXED_EVENT_ORDER.map((title, index) => [normalizeEventTitleForOrder(title), index])
);

const FIXED_EVENT_DISPLAY_NAME_BY_COMPARABLE_KEY = new Map<string, string>(
  FIXED_EVENT_ORDER.map((title) => [toComparableEventBaseKey({ title, distanceM: Number.parseInt(title, 10) }), title])
);

function compareChallengeEventTitles(left: string, right: string): number {
  const leftIndex = FIXED_EVENT_ORDER_MAP.get(normalizeEventTitleForOrder(left));
  const rightIndex = FIXED_EVENT_ORDER_MAP.get(normalizeEventTitleForOrder(right));

  const leftInFixed = typeof leftIndex === "number";
  const rightInFixed = typeof rightIndex === "number";

  if (leftInFixed && rightInFixed && leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  if (leftInFixed && !rightInFixed) {
    return -1;
  }

  if (!leftInFixed && rightInFixed) {
    return 1;
  }

  return left.localeCompare(right, "ja", { numeric: true });
}

function toChallengeEventGroupKey(event: RankingSourceResult["event"]): string {
  const distancePart = Number.isFinite(event.distanceM) ? String(event.distanceM) : "";
  return `${normalizeEventTitleForOrder(event.title)}:${distancePart}`;
}

function isRankInRange(rank: number, minRank?: number, maxRank?: number): boolean {
  if (!Number.isFinite(rank) || rank <= 0) {
    return false;
  }

  if (typeof minRank === "number" && rank < minRank) {
    return false;
  }

  if (typeof maxRank === "number" && rank > maxRank) {
    return false;
  }

  return true;
}

function isWithinRange(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime();
  return time >= start.getTime() && time < end.getTime();
}

function formatHeldMonthLabel(date: Date): string {
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`;
}

function buildGradeSequence(grades: number[], mode: ChallengeGradeRangeMode): number[] {
  const sortedUnique = [...new Set(grades)].sort((a, b) => a - b);
  if (mode !== "minToMax" || sortedUnique.length === 0) {
    return sortedUnique;
  }

  const minGrade = sortedUnique[0] as number;
  const maxGrade = sortedUnique[sortedUnique.length - 1] as number;
  const range: number[] = [];
  for (let grade = minGrade; grade <= maxGrade; grade += 1) {
    range.push(grade);
  }

  return range;
}

function normalizeGradeSequence(gradeSequence: number[]): number[] {
  const normalized: number[] = [];
  const seen = new Set<number>();

  for (const grade of gradeSequence) {
    if (!Number.isFinite(grade)) {
      continue;
    }

    const normalizedGrade = Math.floor(grade);
    if (seen.has(normalizedGrade)) {
      continue;
    }

    seen.add(normalizedGrade);
    normalized.push(normalizedGrade);
  }

  return normalized;
}

export function buildMeetRankingGroups(
  results: RankingSourceResult[],
  options: RankingDisplayOptions = {}
): RankingGroup[] {
  const groups = new Map<string, RankingGroup>();

  for (const result of results) {
    const key = result.event.id;
    if (!groups.has(key)) {
      groups.set(key, {
        eventId: result.event.id,
        eventTitle: result.event.title,
        grade: result.event.grade,
        gender: result.event.gender,
        entries: []
      });
    }

    groups.get(key)!.entries.push({
      rank: result.rank,
      fullName: result.athlete.fullName,
      displayName: toRankingDisplayName(
        {
          fullName: result.athlete.fullName,
          fullNameKana: result.athlete.fullNameKana,
          grade: result.event.grade
        },
        options
      ),
      timeText: result.timeText,
      ...(result.recordMonthLabel ? { recordMonthLabel: result.recordMonthLabel } : {}),
      ...(result.isNewRecordInTargetMonth ? { isNewRecordInTargetMonth: true } : {})
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      entries: sortRankingEntries(group.entries)
    }))
    .sort((a, b) => {
      const titleOrder = a.eventTitle.localeCompare(b.eventTitle, "ja");
      if (titleOrder !== 0) {
        return titleOrder;
      }

      if (a.grade !== b.grade) {
        return a.grade - b.grade;
      }

      return GENDER_ORDER[a.gender] - GENDER_ORDER[b.gender];
    });
}

export function buildChallengeEventRankingGroups(
  results: RankingSourceResult[],
  options: ChallengeRankingBuildOptions = {}
): ChallengeEventRankingGroup[] {
  const minRank = options.minRank;
  const maxRank = options.maxRank;
  const gradeRangeMode = options.gradeRangeMode ?? "existing";
  const gradeSequence = Array.isArray(options.gradeSequence)
    ? normalizeGradeSequence(options.gradeSequence)
    : undefined;
  const gradeSet = gradeSequence ? new Set(gradeSequence) : undefined;
  const excludeOtherGender = options.excludeOtherGender ?? false;
  const eventMap = new Map<string, { eventTitle: string; byGrade: Map<number, ChallengeGradeRankingGroup> }>();

  for (const result of results) {
    if (!isRankInRange(result.rank, minRank, maxRank)) {
      continue;
    }

    if (excludeOtherGender && result.event.gender === "other") {
      continue;
    }

    if (gradeSet && !gradeSet.has(result.event.grade)) {
      continue;
    }

    const eventKey = toChallengeEventGroupKey(result.event);
    if (!eventMap.has(eventKey)) {
      eventMap.set(eventKey, {
        eventTitle: normalizeEventTitleForDisplay(result.event.title),
        byGrade: new Map<number, ChallengeGradeRankingGroup>()
      });
    }

    const eventGroup = eventMap.get(eventKey)!;
    const byGrade = eventGroup.byGrade;

    if (!byGrade.has(result.event.grade)) {
      byGrade.set(result.event.grade, {
        grade: result.event.grade,
        maleEntries: [],
        femaleEntries: []
      });
    }

    const gradeGroup = byGrade.get(result.event.grade)!;
    const entry = {
      rank: result.rank,
      fullName: result.athlete.fullName,
      displayName: toRankingDisplayName(
        {
          fullName: result.athlete.fullName,
          fullNameKana: result.athlete.fullNameKana,
          grade: result.event.grade
        },
        options
      ),
      timeText: result.timeText,
      ...(result.recordMonthLabel ? { recordMonthLabel: result.recordMonthLabel } : {}),
      ...(result.isNewRecordInTargetMonth ? { isNewRecordInTargetMonth: true } : {})
    };

    if (result.event.gender === "male") {
      gradeGroup.maleEntries.push(entry);
      continue;
    }

    // チャレンジ出力は左右2列構成のため、female/other は右側列にまとめる。
    gradeGroup.femaleEntries.push(entry);
  }

  return Array.from(eventMap.values())
    .map(({ eventTitle, byGrade }) => {
      const grades = gradeSequence ?? buildGradeSequence(Array.from(byGrade.keys()), gradeRangeMode);
      return {
        eventTitle,
        gradeGroups: grades.map((grade) => {
          const existing = byGrade.get(grade);
          return {
            grade,
            maleEntries: sortRankingEntries(existing?.maleEntries ?? []),
            femaleEntries: sortRankingEntries(existing?.femaleEntries ?? [])
          };
        })
      };
    })
    .sort((a, b) => compareChallengeEventTitles(a.eventTitle, b.eventTitle));
}

function toHistoricalEventClassKey(comparableEventBaseKey: string, result: HistoricalFirstSourceResult): string {
  return [
    comparableEventBaseKey,
    result.event.grade,
    result.event.gender
  ].join(":");
}

function compareHistoricalWinners(left: HistoricalFirstSourceResult, right: HistoricalFirstSourceResult): number {
  if (left.timeMs !== right.timeMs) {
    return left.timeMs - right.timeMs;
  }

  return compareHistoricalDisplayCandidates(left, right);
}

function compareHistoricalDisplayCandidates(left: HistoricalFirstSourceResult, right: HistoricalFirstSourceResult): number {
  const dateDiff = left.meet.heldOn.getTime() - right.meet.heldOn.getTime();
  if (dateDiff !== 0) {
    return dateDiff;
  }

  const nameDiff = left.athlete.fullName.localeCompare(right.athlete.fullName, "ja");
  if (nameDiff !== 0) {
    return nameDiff;
  }

  const titleDiff = left.event.title.localeCompare(right.event.title, "ja");
  if (titleDiff !== 0) {
    return titleDiff;
  }

  return toHistoricalAthleteKey(left.athlete).localeCompare(toHistoricalAthleteKey(right.athlete), "ja");
}

function getHistoricalDisplayTitle(entry: HistoricalFirstSourceResult, comparableEventBaseKey: string): string {
  return (
    FIXED_EVENT_DISPLAY_NAME_BY_COMPARABLE_KEY.get(comparableEventBaseKey) ??
    normalizeEventTitleForDisplay(entry.event.title)
  );
}

function sortHistoricalEntries(entries: HistoricalFirstSourceResult[]): HistoricalFirstSourceResult[] {
  return [...entries].sort(compareHistoricalWinners);
}

function toHistoricalAthleteKey(input: HistoricalFirstSourceResult["athlete"]): string {
  const athleteId = input.id?.trim();
  if (athleteId) {
    return `id:${athleteId}`;
  }

  return `name:${input.fullName}`;
}

function buildHistoricalFirstTopRows(
  results: HistoricalFirstSourceResult[],
  options: Pick<HistoricalFirstChallengeBuildOptions, "targetMonthStart" | "targetMonthEnd"> = {}
): RankingSourceResult[] {
  const fastestTimeByEventClass = new Map<string, number>();
  const comparableEventBaseKeyByRawEvent = new Map<string, string>();
  const comparableEventBaseKeyByEventClass = new Map<string, string>();
  const kanaByNameKey = new Map<string, string>();

  const getComparableEventBaseKey = (result: HistoricalFirstSourceResult): string => {
    const rawEventKey = `${result.event.distanceM}\u0000${result.event.title}`;
    const cached = comparableEventBaseKeyByRawEvent.get(rawEventKey);
    if (cached) {
      return cached;
    }

    const comparableEventBaseKey = toComparableEventBaseKey(result.event);
    comparableEventBaseKeyByRawEvent.set(rawEventKey, comparableEventBaseKey);
    return comparableEventBaseKey;
  };

  const getEventClassKey = (result: HistoricalFirstSourceResult): string => {
    const comparableEventBaseKey = getComparableEventBaseKey(result);
    const eventClassKey = toHistoricalEventClassKey(comparableEventBaseKey, result);
    comparableEventBaseKeyByEventClass.set(eventClassKey, comparableEventBaseKey);
    return eventClassKey;
  };

  for (const result of results) {
    const nameKey = normalizeAthleteNameKey(result.athlete.fullName);
    const fullNameKana = normalizeKana(result.athlete.fullNameKana);
    if (fullNameKana && !kanaByNameKey.has(nameKey)) {
      kanaByNameKey.set(nameKey, fullNameKana);
    }

    const key = getEventClassKey(result);
    const currentFastest = fastestTimeByEventClass.get(key);
    if (typeof currentFastest !== "number" || result.timeMs < currentFastest) {
      fastestTimeByEventClass.set(key, result.timeMs);
    }
  }

  const topRows: RankingSourceResult[] = [];
  const targetMonthStart = options.targetMonthStart;
  const targetMonthEnd = options.targetMonthEnd;
  const hasTargetMonth = Boolean(targetMonthStart && targetMonthEnd);
  const winnersByEventClass = new Map<string, HistoricalFirstSourceResult[]>();
  const priorTopAthleteKeysByEventClass = new Map<string, Set<string>>();

  for (const result of results) {
    const eventKey = getEventClassKey(result);
    const firstTime = fastestTimeByEventClass.get(eventKey);
    if (result.timeMs !== firstTime) {
      continue;
    }

    const winners = winnersByEventClass.get(eventKey) ?? [];
    winners.push(result);
    winnersByEventClass.set(eventKey, winners);

    if (hasTargetMonth && result.meet.heldOn.getTime() < targetMonthStart!.getTime()) {
      const priorAthleteKeys = priorTopAthleteKeysByEventClass.get(eventKey) ?? new Set<string>();
      priorAthleteKeys.add(toHistoricalAthleteKey(result.athlete));
      priorTopAthleteKeysByEventClass.set(eventKey, priorAthleteKeys);
    }
  }

  const representativeByComparableEventBaseKey = new Map<string, HistoricalFirstSourceResult>();
  for (const [eventKey, winners] of winnersByEventClass.entries()) {
    const comparableEventBaseKey = comparableEventBaseKeyByEventClass.get(eventKey);
    if (!comparableEventBaseKey) {
      continue;
    }

    for (const winner of winners) {
      const currentRepresentative = representativeByComparableEventBaseKey.get(comparableEventBaseKey);
      if (!currentRepresentative || compareHistoricalDisplayCandidates(winner, currentRepresentative) < 0) {
        representativeByComparableEventBaseKey.set(comparableEventBaseKey, winner);
      }
    }
  }

  for (const [eventKey, winners] of winnersByEventClass.entries()) {
    const sortedWinners = sortHistoricalEntries(winners);
    const winner = sortedWinners[0];
    if (!winner) {
      continue;
    }

    const comparableEventBaseKey = comparableEventBaseKeyByEventClass.get(eventKey) ?? getComparableEventBaseKey(winner);
    const representative = representativeByComparableEventBaseKey.get(comparableEventBaseKey) ?? winner;

    const eventTitle = getHistoricalDisplayTitle(representative, comparableEventBaseKey);
    const priorTopAthleteKeys = priorTopAthleteKeysByEventClass.get(eventKey);

    for (const entry of sortedWinners) {
      const isInTargetMonth = hasTargetMonth
        ? isWithinRange(entry.meet.heldOn, targetMonthStart!, targetMonthEnd!)
        : false;
      const isNewRecordInTargetMonth = Boolean(
        isInTargetMonth && !priorTopAthleteKeys?.has(toHistoricalAthleteKey(entry.athlete))
      );
      const fallbackKana = kanaByNameKey.get(normalizeAthleteNameKey(entry.athlete.fullName)) ?? "";
      const athleteKana = normalizeKana(entry.athlete.fullNameKana) || fallbackKana;

      topRows.push({
        rank: 1,
        timeText: entry.timeText,
        recordMonthLabel: formatHeldMonthLabel(entry.meet.heldOn),
        ...(isNewRecordInTargetMonth ? { isNewRecordInTargetMonth: true } : {}),
        athlete: {
          fullName: entry.athlete.fullName,
          ...(athleteKana ? { fullNameKana: athleteKana } : {})
        },
        event: {
          id: eventKey,
          title: eventTitle,
          distanceM: entry.event.distanceM,
          style: entry.event.style,
          grade: entry.event.grade,
          gender: entry.event.gender
        }
      });
    }
  }

  return topRows;
}

export function buildHistoricalFirstRankingGroups(results: HistoricalFirstSourceResult[]): RankingGroup[] {
  const topRows = buildHistoricalFirstTopRows(results);

  return buildMeetRankingGroups(topRows, {
    preschoolNameMode: "none"
  });
}

export function buildHistoricalFirstChallengeGroups(
  results: HistoricalFirstSourceResult[],
  options: HistoricalFirstChallengeBuildOptions = {}
): ChallengeEventRankingGroup[] {
  const topRows = buildHistoricalFirstTopRows(results, {
    targetMonthStart: options.targetMonthStart,
    targetMonthEnd: options.targetMonthEnd
  });

  return buildChallengeEventRankingGroups(topRows, {
    preschoolNameMode: "kanaOnly",
    preschoolMaxGrade: DEFAULT_PRESCHOOL_MAX_GRADE,
    minRank: 1,
    maxRank: 1,
    gradeRangeMode: options.gradeRangeMode ?? "existing",
    gradeSequence: options.gradeSequence,
    excludeOtherGender: options.excludeOtherGender ?? true
  });
}
