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

export type HomeMeetComparisonSummary = {
  state: "ready" | "not-comparable" | "waiting-next-meet";
  currentMeet: HomeMeetOverview;
  previousMeet: HomeMeetOverview | null;
  totalImprovementMs: number;
  comparedEntryCount: number;
  improvedEntryCount: number;
  improvedChildCount: number;
};

type ComparisonEntry = {
  childKey: string;
  timeMs: number;
};

function compareMeetOrder(a: Pick<HomeMeetSummaryInput, "heldOn" | "createdAt" | "id">, b: Pick<HomeMeetSummaryInput, "heldOn" | "createdAt" | "id">) {
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

function toMeetOverview(meet: Pick<HomeMeetSummaryInput, "id" | "title" | "heldOn" | "results">): HomeMeetOverview {
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

function buildUniqueResultMap(meet: Pick<HomeMeetSummaryInput, "results">): Map<string, ComparisonEntry> {
  const uniqueResults = new Map<string, ComparisonEntry>();
  const duplicatedKeys = new Set<string>();

  for (const result of meet.results) {
    const key = toComparisonKey(result);

    if (duplicatedKeys.has(key)) {
      continue;
    }

    const existing = uniqueResults.get(key);
    if (existing) {
      uniqueResults.delete(key);
      duplicatedKeys.add(key);
      continue;
    }

    uniqueResults.set(key, {
      childKey: `${nameSearchKey(result.athlete.fullName)}:${result.athlete.gender}`,
      timeMs: result.timeMs
    });
  }

  return uniqueResults;
}

export function buildHomeMeetComparisonSummary(
  meets: HomeMeetSummaryInput[]
): HomeMeetComparisonSummary | null {
  const latestMeets = meets
    .filter((meet) => meet.program === "swimming")
    .sort(compareMeetOrder)
    .slice(0, 2);

  const currentMeet = latestMeets[0];
  if (!currentMeet) {
    return null;
  }

  const currentOverview = toMeetOverview(currentMeet);
  const previousMeet = latestMeets[1];
  const previousOverview = previousMeet ? toMeetOverview(previousMeet) : null;

  if (!previousMeet) {
    return {
      state: "waiting-next-meet",
      currentMeet: currentOverview,
      previousMeet: null,
      totalImprovementMs: 0,
      comparedEntryCount: 0,
      improvedEntryCount: 0,
      improvedChildCount: 0
    };
  }

  const currentResults = buildUniqueResultMap(currentMeet);
  const previousResults = buildUniqueResultMap(previousMeet);
  const improvedChildren = new Set<string>();
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
    improvedChildren.add(currentResult.childKey);
  }

  return {
    state: comparedEntryCount > 0 ? "ready" : "not-comparable",
    currentMeet: currentOverview,
    previousMeet: previousOverview,
    totalImprovementMs,
    comparedEntryCount,
    improvedEntryCount,
    improvedChildCount: improvedChildren.size
  };
}

export async function getHomeMeetComparisonSummary() {
  const meets = await prisma.meet.findMany({
    where: {
      program: "swimming"
    },
    orderBy: [{ heldOn: "desc" }, { createdAt: "desc" }],
    take: 2,
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

  return buildHomeMeetComparisonSummary(meets);
}
