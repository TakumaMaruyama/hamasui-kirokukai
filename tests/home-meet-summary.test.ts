import { describe, expect, it } from "vitest";
import type { HomeMeetSummaryInput } from "../lib/home-meet-summary";
import { buildHomeMeetComparisonCards } from "../lib/home-meet-summary";

type MeetResultInput = HomeMeetSummaryInput["results"][number];

function buildResult(input: {
  athleteId: string;
  fullName: string;
  gender: MeetResultInput["athlete"]["gender"];
  eventTitle: string;
  distanceM: number;
  timeMs: number;
}): MeetResultInput {
  return {
    athleteId: input.athleteId,
    timeMs: input.timeMs,
    athlete: {
      fullName: input.fullName,
      gender: input.gender
    },
    event: {
      title: input.eventTitle,
      distanceM: input.distanceM
    }
  };
}

function buildMeet(input: {
  id: string;
  program: HomeMeetSummaryInput["program"];
  title: string;
  heldOn: string;
  createdAt: string;
  results: MeetResultInput[];
}): HomeMeetSummaryInput {
  return {
    id: input.id,
    program: input.program,
    title: input.title,
    heldOn: new Date(input.heldOn),
    createdAt: new Date(input.createdAt),
    results: input.results
  };
}

describe("buildHomeMeetComparisonCards", () => {
  it("builds two cards from the latest three swimming meets and ignores other programs", () => {
    const cards = buildHomeMeetComparisonCards([
      buildMeet({
        id: "school-newer",
        program: "school",
        title: "学校委託",
        heldOn: "2025-10-01T00:00:00.000Z",
        createdAt: "2025-10-02T00:00:00.000Z",
        results: []
      }),
      buildMeet({
        id: "swim-oldest",
        program: "swimming",
        title: "2025年7月",
        heldOn: "2025-07-01T00:00:00.000Z",
        createdAt: "2025-07-02T00:00:00.000Z",
        results: []
      }),
      buildMeet({
        id: "swim-previous",
        program: "swimming",
        title: "2025年8月",
        heldOn: "2025-08-01T00:00:00.000Z",
        createdAt: "2025-08-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "a1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25mクロール",
            distanceM: 25,
            timeMs: 19_100
          })
        ]
      }),
      buildMeet({
        id: "swim-current",
        program: "swimming",
        title: "2025年9月",
        heldOn: "2025-09-01T00:00:00.000Z",
        createdAt: "2025-09-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "a1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25mクロール",
            distanceM: 25,
            timeMs: 18_900
          })
        ]
      }),
      buildMeet({
        id: "challenge-middle",
        program: "challenge",
        title: "チャレンジ",
        heldOn: "2025-08-15T00:00:00.000Z",
        createdAt: "2025-08-16T00:00:00.000Z",
        results: []
      })
    ]);

    expect(cards).not.toBeNull();
    expect(cards).toHaveLength(2);
    expect(cards?.[0]?.slotLabel).toBe("今回");
    expect(cards?.[0]?.currentMeet?.id).toBe("swim-current");
    expect(cards?.[0]?.previousMeet?.id).toBe("swim-previous");
    expect(cards?.[1]?.slotLabel).toBe("1つ前");
    expect(cards?.[1]?.currentMeet?.id).toBe("swim-previous");
    expect(cards?.[1]?.previousMeet?.id).toBe("swim-oldest");
  });

  it("matches rows across whitespace, school year changes, and full/half-width event text", () => {
    const cards = buildHomeMeetComparisonCards([
      buildMeet({
        id: "current",
        program: "swimming",
        title: "2025年9月",
        heldOn: "2025-09-01T00:00:00.000Z",
        createdAt: "2025-09-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "a-new-grade",
            fullName: "山田 太郎",
            gender: "male",
            eventTitle: "25ｍ クロール",
            distanceM: 25,
            timeMs: 17_800
          })
        ]
      }),
      buildMeet({
        id: "previous",
        program: "swimming",
        title: "2025年8月",
        heldOn: "2025-08-01T00:00:00.000Z",
        createdAt: "2025-08-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "a-old-grade",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25mクロール",
            distanceM: 25,
            timeMs: 18_100
          })
        ]
      }),
      buildMeet({
        id: "oldest",
        program: "swimming",
        title: "2025年7月",
        heldOn: "2025-07-01T00:00:00.000Z",
        createdAt: "2025-07-02T00:00:00.000Z",
        results: []
      })
    ]);

    expect(cards?.[0]?.comparedEntryCount).toBe(1);
    expect(cards?.[0]?.totalImprovementMs).toBe(300);
    expect(cards?.[0]?.improvedEntryCount).toBe(1);
  });

  it("adds only positive improvements and ignores slower, tied, or missing rows", () => {
    const cards = buildHomeMeetComparisonCards([
      buildMeet({
        id: "current",
        program: "swimming",
        title: "2025年9月",
        heldOn: "2025-09-01T00:00:00.000Z",
        createdAt: "2025-09-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "a1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25mクロール",
            distanceM: 25,
            timeMs: 17_800
          }),
          buildResult({
            athleteId: "a2",
            fullName: "佐藤花子",
            gender: "female",
            eventTitle: "25m背泳ぎ",
            distanceM: 25,
            timeMs: 20_500
          }),
          buildResult({
            athleteId: "a3",
            fullName: "鈴木一郎",
            gender: "male",
            eventTitle: "25m平泳ぎ",
            distanceM: 25,
            timeMs: 22_100
          }),
          buildResult({
            athleteId: "a4",
            fullName: "中村桃子",
            gender: "female",
            eventTitle: "25mバタフライ",
            distanceM: 25,
            timeMs: 19_900
          })
        ]
      }),
      buildMeet({
        id: "previous",
        program: "swimming",
        title: "2025年8月",
        heldOn: "2025-08-01T00:00:00.000Z",
        createdAt: "2025-08-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "b1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25mクロール",
            distanceM: 25,
            timeMs: 18_100
          }),
          buildResult({
            athleteId: "b2",
            fullName: "佐藤花子",
            gender: "female",
            eventTitle: "25m背泳ぎ",
            distanceM: 25,
            timeMs: 20_300
          }),
          buildResult({
            athleteId: "b3",
            fullName: "鈴木一郎",
            gender: "male",
            eventTitle: "25m平泳ぎ",
            distanceM: 25,
            timeMs: 22_100
          }),
          buildResult({
            athleteId: "b5",
            fullName: "高橋健太",
            gender: "male",
            eventTitle: "25m自由形",
            distanceM: 25,
            timeMs: 19_300
          })
        ]
      }),
      buildMeet({
        id: "oldest",
        program: "swimming",
        title: "2025年7月",
        heldOn: "2025-07-01T00:00:00.000Z",
        createdAt: "2025-07-02T00:00:00.000Z",
        results: []
      })
    ]);

    expect(cards?.[0]?.comparedEntryCount).toBe(3);
    expect(cards?.[0]?.totalImprovementMs).toBe(300);
    expect(cards?.[0]?.improvedEntryCount).toBe(1);
  });

  it("drops duplicated comparison keys within the same meet", () => {
    const cards = buildHomeMeetComparisonCards([
      buildMeet({
        id: "current",
        program: "swimming",
        title: "2025年9月",
        heldOn: "2025-09-01T00:00:00.000Z",
        createdAt: "2025-09-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "a1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25mクロール",
            distanceM: 25,
            timeMs: 17_800
          }),
          buildResult({
            athleteId: "a2",
            fullName: "山田 太郎",
            gender: "male",
            eventTitle: "25ｍクロール",
            distanceM: 25,
            timeMs: 18_000
          })
        ]
      }),
      buildMeet({
        id: "previous",
        program: "swimming",
        title: "2025年8月",
        heldOn: "2025-08-01T00:00:00.000Z",
        createdAt: "2025-08-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "b1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25mクロール",
            distanceM: 25,
            timeMs: 18_100
          })
        ]
      }),
      buildMeet({
        id: "oldest",
        program: "swimming",
        title: "2025年7月",
        heldOn: "2025-07-01T00:00:00.000Z",
        createdAt: "2025-07-02T00:00:00.000Z",
        results: []
      })
    ]);

    expect(cards?.[0]?.state).toBe("not-comparable");
    expect(cards?.[0]?.comparedEntryCount).toBe(0);
    expect(cards?.[0]?.totalImprovementMs).toBe(0);
  });

  it("uses a placeholder card when there are only two meets", () => {
    const cards = buildHomeMeetComparisonCards([
      buildMeet({
        id: "current",
        program: "swimming",
        title: "2025年9月",
        heldOn: "2025-09-01T00:00:00.000Z",
        createdAt: "2025-09-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "a1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25mクロール",
            distanceM: 25,
            timeMs: 17_800
          })
        ]
      }),
      buildMeet({
        id: "previous",
        program: "swimming",
        title: "2025年8月",
        heldOn: "2025-08-01T00:00:00.000Z",
        createdAt: "2025-08-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "b1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25mクロール",
            distanceM: 25,
            timeMs: 18_100
          })
        ]
      })
    ]);

    expect(cards?.[0]?.state).toBe("ready");
    expect(cards?.[1]?.slotLabel).toBe("1つ前");
    expect(cards?.[1]?.state).toBe("unavailable");
    expect(cards?.[1]?.currentMeet).toBeNull();
    expect(cards?.[1]?.previousMeet).toBeNull();
  });

  it("returns a waiting card for the first slot when there is only one meet", () => {
    const cards = buildHomeMeetComparisonCards([
      buildMeet({
        id: "current-only",
        program: "swimming",
        title: "2025年9月",
        heldOn: "2025-09-01T00:00:00.000Z",
        createdAt: "2025-09-02T00:00:00.000Z",
        results: []
      })
    ]);

    expect(cards?.[0]?.state).toBe("waiting-next-meet");
    expect(cards?.[0]?.currentMeet?.id).toBe("current-only");
    expect(cards?.[1]?.state).toBe("unavailable");
  });
});
