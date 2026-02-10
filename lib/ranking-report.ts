import { Gender } from "@prisma/client";

export type RankingSourceResult = {
  rank: number;
  timeText: string;
  athlete: { fullName: string };
  event: {
    id: string;
    title: string;
    grade: number;
    gender: Gender;
  };
};

export type RankingEntry = {
  rank: number;
  fullName: string;
  timeText: string;
};

export type RankingGroup = {
  eventId: string;
  eventTitle: string;
  grade: number;
  gender: Gender;
  entries: RankingEntry[];
};

const GENDER_ORDER: Record<Gender, number> = {
  male: 0,
  female: 1,
  other: 2
};

export function buildMeetRankingGroups(results: RankingSourceResult[]): RankingGroup[] {
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
      timeText: result.timeText
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      entries: [...group.entries].sort((a, b) => {
        if (a.rank !== b.rank) {
          return a.rank - b.rank;
        }

        return a.fullName.localeCompare(b.fullName, "ja");
      })
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
