import type { Gender, Program } from "@prisma/client";
import { prisma } from "./prisma";
import { toComparableEventBaseKey } from "./event-key";
import { nameSearchKey } from "./search-request";

type HomeMeetResultInput = {
  athleteId: string;
  timeMs: number;
  athlete: {
    fullName: string;
    gender: Gender;
  };
  event: {
    title: string;
    distanceM: number;
  };
};

export type HomeMeetSummaryInput = {
  id: string;
  program: Program;
  title: string;
  heldOn: Date;
  createdAt: Date;
  results: HomeMeetResultInput[];
};

export type HomeMeetOverview = {
  id: string;
  title: string;
  heldOn: Date;
  participantCount: number;
  resultCount: number;
};

export type HomeMeetComparisonCard = {
  slotLabel: "今回" | "1つ前";
  state: "ready" | "not-comparable" | "waiting-next-meet" | "unavailable";
  currentMeet: HomeMeetOverview | null;
  previousMeet: HomeMeetOverview | null;
  totalImprovementMs: number;
  comparedEntryCount: number;
  improvedEntryCount: number;
};

type ComparisonEntry = {
  timeMs: number;
};

function compareMeetOrder(
  a: Pick<HomeMeetSummaryInput, "heldOn" | "createdAt" | "id">,
  b: Pick<HomeMeetSummaryInput, "heldOn" | "createdAt" | "id">
) {
  const heldOnOrder = b.heldOn.getTime() - a.heldOn.getTime();
  if (heldOnOrder !== 0) {
    return heldOnOrder;
  }

  const createdAtOrder = b.createdAt.getTime() - a.createdAt.getTime();
  if (createdAtOrder !== 0) {
    return createdAtOrder;
  }

  return b.id.localeCompare(a.id, "en");
}

function toMeetOverview(
  meet: Pick<HomeMeetSummaryInput, "id" | "title" | "heldOn" | "results">
): HomeMeetOverview {
  return {
    id: meet.id,
    title: meet.title,
    heldOn: meet.heldOn,
    participantCount: new Set(meet.results.map((result) => result.athleteId)).size,
    resultCount: meet.results.length
  };
}

function toComparisonKey(result: HomeMeetResultInput): string {
  const childKey = `${nameSearchKey(result.athlete.fullName)}:${result.athlete.gender}`;
  const eventKey = toComparableEventBaseKey(result.event);
  return `${childKey}:${eventKey}`;
}

function buildUniqueResultMap(
  meet: Pick<HomeMeetSummaryInput, "results">
): Map<string, ComparisonEntry> {
  const uniqueResults = new Map<string, ComparisonEntry>();

  for (const result of meet.results) {
    const key = toComparisonKey(result);
    const existing = uniqueResults.get(key);

    if (!existing || result.timeMs < existing.timeMs) {
      uniqueResults.set(key, {
        timeMs: result.timeMs
      });
    }
  }

  return uniqueResults;
}

function buildComparisonCard(
  slotLabel: HomeMeetComparisonCard["slotLabel"],
  currentMeetInput: HomeMeetSummaryInput | null | undefined,
  previousMeetInput: HomeMeetSummaryInput | null | undefined
): HomeMeetComparisonCard {
  if (!currentMeetInput) {
    return {
      slotLabel,
      state: "unavailable",
      currentMeet: null,
      previousMeet: null,
      totalImprovementMs: 0,
      comparedEntryCount: 0,
      improvedEntryCount: 0
    };
  }

  const currentMeet = toMeetOverview(currentMeetInput);

  if (!previousMeetInput) {
    return {
      slotLabel,
      state: "waiting-next-meet",
      currentMeet,
      previousMeet: null,
      totalImprovementMs: 0,
      comparedEntryCount: 0,
      improvedEntryCount: 0
    };
  }

  const previousMeet = toMeetOverview(previousMeetInput);
  const currentResults = buildUniqueResultMap(currentMeetInput);
  const previousResults = buildUniqueResultMap(previousMeetInput);
  let totalImprovementMs = 0;
  let comparedEntryCount = 0;
  let improvedEntryCount = 0;

  for (const [key, currentResult] of currentResults.entries()) {
    const previousResult = previousResults.get(key);
    if (!previousResult) {
      continue;
    }

    comparedEntryCount += 1;

    const improvementMs = previousResult.timeMs - currentResult.timeMs;
    if (improvementMs <= 0) {
      continue;
    }

    totalImprovementMs += improvementMs;
    improvedEntryCount += 1;
  }

  return {
    slotLabel,
    state: comparedEntryCount > 0 ? "ready" : "not-comparable",
    currentMeet,
    previousMeet,
    totalImprovementMs,
    comparedEntryCount,
    improvedEntryCount
  };
}

export function buildHomeMeetComparisonCards(
  meets: HomeMeetSummaryInput[]
): HomeMeetComparisonCard[] | null {
  const latestMeets = meets
    .filter((meet) => meet.program === "swimming")
    .sort(compareMeetOrder)
    .slice(0, 3);

  if (!latestMeets[0]) {
    return null;
  }

  return [
    buildComparisonCard("今回", latestMeets[0], latestMeets[1]),
    buildComparisonCard("1つ前", latestMeets[2] ? latestMeets[1] : null, latestMeets[2])
  ];
}

export async function getHomeMeetComparisonCards() {
  const meets = await prisma.meet.findMany({
    where: {
      program: "swimming"
    },
    orderBy: [{ heldOn: "desc" }, { createdAt: "desc" }],
    take: 3,
    select: {
      id: true,
      program: true,
      title: true,
      heldOn: true,
      createdAt: true,
      results: {
        select: {
          athleteId: true,
          timeMs: true,
          athlete: {
            select: {
              fullName: true,
              gender: true
            }
          },
          event: {
            select: {
              title: true,
              distanceM: true
            }
          }
        }
      }
    }
  });

  return buildHomeMeetComparisonCards(meets);
}
