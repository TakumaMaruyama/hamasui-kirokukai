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
export type ChallengeGradeRangeMode = "existing" | "minToMax";

export type RankingDisplayOptions = {
  preschoolNameMode?: PreschoolNameMode;
  preschoolMaxGrade?: number;
};

export type ChallengeRankingBuildOptions = RankingDisplayOptions & {
  minRank?: number;
  maxRank?: number;
  gradeRangeMode?: ChallengeGradeRangeMode;
  excludeOtherGender?: boolean;
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
  options: ChallengeRankingBuildOptions = {}
): ChallengeEventRankingGroup[] {
  const minRank = options.minRank;
  const maxRank = options.maxRank;
  const gradeRangeMode = options.gradeRangeMode ?? "existing";
  const excludeOtherGender = options.excludeOtherGender ?? false;
  const eventMap = new Map<string, Map<number, ChallengeGradeRankingGroup>>();

  for (const result of results) {
    if (!isRankInRange(result.rank, minRank, maxRank)) {
      continue;
    }

    if (excludeOtherGender && result.event.gender === "other") {
      continue;
    }

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
    .map(([eventTitle, byGrade]) => {
      const grades = buildGradeSequence(Array.from(byGrade.keys()), gradeRangeMode);
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
