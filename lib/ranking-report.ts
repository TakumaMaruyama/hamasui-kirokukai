import { Gender } from "@prisma/client";

export type RankingSourceResult = {
  rank: number;
  timeText: string;
  athlete: { fullName: string; fullNameKana?: string | null };
  event: {
    id: string;
    title: string;
    grade: number;
    gender: Gender;
  };
};

export type HistoricalFirstSourceResult = {
  timeMs: number;
  timeText: string;
  athlete: { fullName: string };
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

export type RankingDisplayOptions = {
  preschoolNameMode?: PreschoolNameMode;
  preschoolMaxGrade?: number;
};

const GENDER_ORDER: Record<Gender, number> = {
  male: 0,
  female: 1,
  other: 2
};

const DEFAULT_PRESCHOOL_MAX_GRADE = 3;

function normalizeKana(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
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
      timeText: result.timeText
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
  options: RankingDisplayOptions = {}
): ChallengeEventRankingGroup[] {
  const eventMap = new Map<string, Map<number, ChallengeGradeRankingGroup>>();

  for (const result of results) {
    const eventTitle = result.event.title;

    if (!eventMap.has(eventTitle)) {
      eventMap.set(eventTitle, new Map<number, ChallengeGradeRankingGroup>());
    }

    const byGrade = eventMap.get(eventTitle)!;

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
      timeText: result.timeText
    };

    if (result.event.gender === "male") {
      gradeGroup.maleEntries.push(entry);
      continue;
    }

    // チャレンジ出力は左右2列構成のため、female/other は右側列にまとめる。
    gradeGroup.femaleEntries.push(entry);
  }

  return Array.from(eventMap.entries())
    .map(([eventTitle, byGrade]) => ({
      eventTitle,
      gradeGroups: Array.from(byGrade.values())
        .map((gradeGroup) => ({
          ...gradeGroup,
          maleEntries: sortRankingEntries(gradeGroup.maleEntries),
          femaleEntries: sortRankingEntries(gradeGroup.femaleEntries)
        }))
        .sort((a, b) => a.grade - b.grade)
    }))
    .sort((a, b) => a.eventTitle.localeCompare(b.eventTitle, "ja", { numeric: true }));
}

function toEventClassKey(result: HistoricalFirstSourceResult): string {
  return [
    result.event.title,
    result.event.distanceM,
    result.event.style,
    result.event.grade,
    result.event.gender
  ].join(":");
}

export function buildHistoricalFirstRankingGroups(results: HistoricalFirstSourceResult[]): RankingGroup[] {
  const byEventClass = new Map<string, HistoricalFirstSourceResult[]>();

  for (const result of results) {
    const key = toEventClassKey(result);
    if (!byEventClass.has(key)) {
      byEventClass.set(key, []);
    }

    byEventClass.get(key)!.push(result);
  }

  const topRows: RankingSourceResult[] = [];

  for (const [eventKey, entries] of byEventClass.entries()) {
    const sorted = [...entries].sort((a, b) => {
      if (a.timeMs !== b.timeMs) {
        return a.timeMs - b.timeMs;
      }

      const dateDiff = a.meet.heldOn.getTime() - b.meet.heldOn.getTime();
      if (dateDiff !== 0) {
        return dateDiff;
      }

      return a.athlete.fullName.localeCompare(b.athlete.fullName, "ja");
    });

    const firstTime = sorted[0]?.timeMs;
    if (typeof firstTime !== "number") {
      continue;
    }

    for (const entry of sorted) {
      if (entry.timeMs !== firstTime) {
        break;
      }

      topRows.push({
        rank: 1,
        timeText: entry.timeText,
        athlete: { fullName: entry.athlete.fullName },
        event: {
          id: eventKey,
          title: entry.event.title,
          grade: entry.event.grade,
          gender: entry.event.gender
        }
      });
    }
  }

  return buildMeetRankingGroups(topRows, {
    preschoolNameMode: "none"
  });
}
