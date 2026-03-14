import type { Gender, Program } from "@prisma/client";
import { prisma } from "./prisma";
import { toComparableEventBaseKey } from "./event-key";
import { formatMeetMonthLabel } from "./meet-context";
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
  slotLabel: "今回" | "前回の前回比";
  state:
    | "ready"
    | "not-comparable"
    | "waiting-next-meet"
    | "waiting-older-month"
    | "unavailable";
  currentMeet: HomeMeetOverview | null;
  previousMeet: HomeMeetOverview | null;
  totalImprovementMs: number;
};

type ComparisonEntry = {
  timeMs: number;
};

type HomeMeetMonthGroup = {
  id: string;
  title: string;
  heldOn: Date;
  results: HomeMeetResultInput[];
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

function toMeetOverview(meet: HomeMeetMonthGroup): HomeMeetOverview {
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
  meet: Pick<HomeMeetMonthGroup, "results">
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

function buildMonthGroups(meets: HomeMeetSummaryInput[]): HomeMeetMonthGroup[] {
  const monthlyGroups = new Map<string, HomeMeetMonthGroup>();

  for (const meet of meets.filter((candidate) => candidate.program === "swimming").sort(compareMeetOrder)) {
    const monthLabel = formatMeetMonthLabel(meet);
    const existingGroup = monthlyGroups.get(monthLabel);

    if (!existingGroup) {
      monthlyGroups.set(monthLabel, {
        id: monthLabel,
        title: monthLabel,
        heldOn: meet.heldOn,
        results: [...meet.results]
      });
      continue;
    }

    if (meet.heldOn.getTime() > existingGroup.heldOn.getTime()) {
      existingGroup.heldOn = meet.heldOn;
    }

    existingGroup.results.push(...meet.results);
  }

  return Array.from(monthlyGroups.values()).slice(0, 3);
}

function buildComparisonCard(input: {
  slotLabel: HomeMeetComparisonCard["slotLabel"];
  currentMonth: HomeMeetMonthGroup | null | undefined;
  previousMonth: HomeMeetMonthGroup | null | undefined;
  waitingState: "waiting-next-meet" | "waiting-older-month";
}): HomeMeetComparisonCard {
  if (!input.currentMonth) {
    return {
      slotLabel: input.slotLabel,
      state: "unavailable",
      currentMeet: null,
      previousMeet: null,
      totalImprovementMs: 0
    };
  }

  const currentMeet = toMeetOverview(input.currentMonth);

  if (!input.previousMonth) {
    return {
      slotLabel: input.slotLabel,
      state: input.waitingState,
      currentMeet,
      previousMeet: null,
      totalImprovementMs: 0
    };
  }

  const previousMeet = toMeetOverview(input.previousMonth);
  const currentResults = buildUniqueResultMap(input.currentMonth);
  const previousResults = buildUniqueResultMap(input.previousMonth);
  let totalImprovementMs = 0;
  let hasComparableRecord = false;

  for (const [key, currentResult] of currentResults.entries()) {
    const previousResult = previousResults.get(key);
    if (!previousResult) {
      continue;
    }

    hasComparableRecord = true;

    const improvementMs = previousResult.timeMs - currentResult.timeMs;
    if (improvementMs <= 0) {
      continue;
    }

    totalImprovementMs += improvementMs;
  }

  return {
    slotLabel: input.slotLabel,
    state: hasComparableRecord ? "ready" : "not-comparable",
    currentMeet,
    previousMeet,
    totalImprovementMs
  };
}

export function buildHomeMeetComparisonCards(
  meets: HomeMeetSummaryInput[]
): HomeMeetComparisonCard[] | null {
  const latestMonths = buildMonthGroups(meets);

  if (!latestMonths[0]) {
    return null;
  }

  return [
    buildComparisonCard({
      slotLabel: "今回",
      currentMonth: latestMonths[0],
      previousMonth: latestMonths[1],
      waitingState: "waiting-next-meet"
    }),
    buildComparisonCard({
      slotLabel: "前回の前回比",
      currentMonth: latestMonths[1],
      previousMonth: latestMonths[2],
      waitingState: "waiting-older-month"
    })
  ];
}

export async function getHomeMeetComparisonCards() {
  const meets = await prisma.meet.findMany({
    where: {
      program: "swimming"
    },
    orderBy: [{ heldOn: "desc" }, { createdAt: "desc" }],
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
