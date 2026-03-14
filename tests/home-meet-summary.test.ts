import { describe, expect, it } from "vitest";
import type { HomeMeetSummaryInput } from "../lib/home-meet-summary";
import { buildHomeMeetComparisonSummary } from "../lib/home-meet-summary";

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

describe("buildHomeMeetComparisonSummary", () => {
  it("groups swimming meets by month and ignores other programs", () => {
    const summary = buildHomeMeetComparisonSummary([
      buildMeet({
        id: "school-newer",
        program: "school",
        title: "学校委託",
        heldOn: "2026-04-01T00:00:00.000Z",
        createdAt: "2026-04-02T00:00:00.000Z",
        results: []
      }),
      buildMeet({
        id: "march-sun",
        program: "swimming",
        title: "2026年3月日曜",
        heldOn: "2026-03-08T00:00:00.000Z",
        createdAt: "2026-03-08T08:00:00.000Z",
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
        id: "march-sat",
        program: "swimming",
        title: "2026年3月土曜",
        heldOn: "2026-03-07T00:00:00.000Z",
        createdAt: "2026-03-07T08:00:00.000Z",
        results: [
          buildResult({
            athleteId: "a2",
            fullName: "佐藤花子",
            gender: "female",
            eventTitle: "25m背泳ぎ",
            distanceM: 25,
            timeMs: 20_100
          })
        ]
      }),
      buildMeet({
        id: "sep-sat",
        program: "swimming",
        title: "2025年9月土曜",
        heldOn: "2025-09-06T00:00:00.000Z",
        createdAt: "2025-09-06T08:00:00.000Z",
        results: [
          buildResult({
            athleteId: "b1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25mクロール",
            distanceM: 25,
            timeMs: 19_100
          })
        ]
      }),
      buildMeet({
        id: "challenge-middle",
        program: "challenge",
        title: "チャレンジ",
        heldOn: "2026-03-01T00:00:00.000Z",
        createdAt: "2026-03-01T08:00:00.000Z",
        results: []
      })
    ]);

    expect(summary).not.toBeNull();
    expect(summary?.currentMeet.id).toBe("2026年3月");
    expect(summary?.currentMeet.title).toBe("2026年3月");
    expect(summary?.currentMeet.participantCount).toBe(2);
    expect(summary?.currentMeet.resultCount).toBe(2);
    expect(summary?.previousMeet?.id).toBe("2025年9月");
    expect(summary?.state).toBe("ready");
  });

  it("compares the latest month with the previous distinct month and ignores older months", () => {
    const summary = buildHomeMeetComparisonSummary([
      buildMeet({
        id: "march-sun",
        program: "swimming",
        title: "2026年3月日曜",
        heldOn: "2026-03-08T00:00:00.000Z",
        createdAt: "2026-03-08T08:00:00.000Z",
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
        id: "march-sat",
        program: "swimming",
        title: "2026年3月土曜",
        heldOn: "2026-03-07T00:00:00.000Z",
        createdAt: "2026-03-07T08:00:00.000Z",
        results: []
      }),
      buildMeet({
        id: "sep",
        program: "swimming",
        title: "2025年9月",
        heldOn: "2025-09-01T00:00:00.000Z",
        createdAt: "2025-09-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "b1",
            fullName: "佐藤花子",
            gender: "female",
            eventTitle: "25m背泳ぎ",
            distanceM: 25,
            timeMs: 20_300
          })
        ]
      }),
      buildMeet({
        id: "july",
        program: "swimming",
        title: "2025年7月",
        heldOn: "2025-07-01T00:00:00.000Z",
        createdAt: "2025-07-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "c1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25m自由形",
            distanceM: 25,
            timeMs: 18_100
          })
        ]
      })
    ]);

    expect(summary?.currentMeet.id).toBe("2026年3月");
    expect(summary?.previousMeet?.id).toBe("2025年9月");
    expect(summary?.state).toBe("not-comparable");
  });

  it("uses the best monthly time across multiple meets in the same month", () => {
    const summary = buildHomeMeetComparisonSummary([
      buildMeet({
        id: "march-sun",
        program: "swimming",
        title: "2026年3月日曜",
        heldOn: "2026-03-08T00:00:00.000Z",
        createdAt: "2026-03-08T08:00:00.000Z",
        results: [
          buildResult({
            athleteId: "a-new-grade",
            fullName: "山田 太郎",
            gender: "male",
            eventTitle: "25ｍ クロール",
            distanceM: 25,
            timeMs: 18_000
          })
        ]
      }),
      buildMeet({
        id: "march-sat",
        program: "swimming",
        title: "2026年3月土曜",
        heldOn: "2026-03-07T00:00:00.000Z",
        createdAt: "2026-03-07T08:00:00.000Z",
        results: [
          buildResult({
            athleteId: "a-new-grade",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25mクロール",
            distanceM: 25,
            timeMs: 17_800
          })
        ]
      }),
      buildMeet({
        id: "sep",
        program: "swimming",
        title: "2025年9月",
        heldOn: "2025-09-01T00:00:00.000Z",
        createdAt: "2025-09-02T00:00:00.000Z",
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
      })
    ]);

    expect(summary?.state).toBe("ready");
    expect(summary?.totalImprovementMs).toBe(300);
  });

  it("treats freestyle label variants as the same comparable event", () => {
    const summary = buildHomeMeetComparisonSummary([
      buildMeet({
        id: "march",
        program: "swimming",
        title: "2026年3月",
        heldOn: "2026-03-01T00:00:00.000Z",
        createdAt: "2026-03-02T00:00:00.000Z",
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
        id: "sep",
        program: "swimming",
        title: "2025年9月",
        heldOn: "2025-09-01T00:00:00.000Z",
        createdAt: "2025-09-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "b1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25m自由形",
            distanceM: 25,
            timeMs: 18_100
          })
        ]
      })
    ]);

    expect(summary?.state).toBe("ready");
    expect(summary?.totalImprovementMs).toBe(300);
  });

  it("adds only positive improvements and ignores slower, tied, or missing rows", () => {
    const summary = buildHomeMeetComparisonSummary([
      buildMeet({
        id: "march",
        program: "swimming",
        title: "2026年3月",
        heldOn: "2026-03-01T00:00:00.000Z",
        createdAt: "2026-03-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "a1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25mクロール",
            distanceM: 25,
            timeMs: 15_100
          }),
          buildResult({
            athleteId: "a2",
            fullName: "佐藤花子",
            gender: "female",
            eventTitle: "25m背泳ぎ",
            distanceM: 25,
            timeMs: 10_300
          }),
          buildResult({
            athleteId: "a3",
            fullName: "鈴木一郎",
            gender: "male",
            eventTitle: "25m平泳ぎ",
            distanceM: 25,
            timeMs: 22_500
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
        id: "sep",
        program: "swimming",
        title: "2025年9月",
        heldOn: "2025-09-01T00:00:00.000Z",
        createdAt: "2025-09-02T00:00:00.000Z",
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
      })
    ]);

    expect(summary?.state).toBe("ready");
    expect(summary?.totalImprovementMs).toBe(13_000);
  });

  it("sums positive improvements across multiple matching events", () => {
    const summary = buildHomeMeetComparisonSummary([
      buildMeet({
        id: "march",
        program: "swimming",
        title: "2026年3月",
        heldOn: "2026-03-01T00:00:00.000Z",
        createdAt: "2026-03-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "a1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25mクロール",
            distanceM: 25,
            timeMs: 17_700
          }),
          buildResult({
            athleteId: "a1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "50mクロール",
            distanceM: 50,
            timeMs: 38_200
          }),
          buildResult({
            athleteId: "a2",
            fullName: "佐藤花子",
            gender: "female",
            eventTitle: "25m背泳ぎ",
            distanceM: 25,
            timeMs: 20_000
          })
        ]
      }),
      buildMeet({
        id: "sep",
        program: "swimming",
        title: "2025年9月",
        heldOn: "2025-09-01T00:00:00.000Z",
        createdAt: "2025-09-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "b1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "25mクロール",
            distanceM: 25,
            timeMs: 17_900
          }),
          buildResult({
            athleteId: "b1",
            fullName: "山田太郎",
            gender: "male",
            eventTitle: "50mクロール",
            distanceM: 50,
            timeMs: 38_700
          }),
          buildResult({
            athleteId: "b2",
            fullName: "佐藤花子",
            gender: "female",
            eventTitle: "25m背泳ぎ",
            distanceM: 25,
            timeMs: 20_300
          })
        ]
      })
    ]);

    expect(summary?.state).toBe("ready");
    expect(summary?.totalImprovementMs).toBe(1_000);
  });

  it("uses the fastest record when duplicate comparison keys appear across meets in the same month", () => {
    const summary = buildHomeMeetComparisonSummary([
      buildMeet({
        id: "march-sun",
        program: "swimming",
        title: "2026年3月日曜",
        heldOn: "2026-03-08T00:00:00.000Z",
        createdAt: "2026-03-08T08:00:00.000Z",
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
        id: "march-sat",
        program: "swimming",
        title: "2026年3月土曜",
        heldOn: "2026-03-07T00:00:00.000Z",
        createdAt: "2026-03-07T08:00:00.000Z",
        results: [
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
        id: "sep",
        program: "swimming",
        title: "2025年9月",
        heldOn: "2025-09-01T00:00:00.000Z",
        createdAt: "2025-09-02T00:00:00.000Z",
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

    expect(summary?.state).toBe("ready");
    expect(summary?.totalImprovementMs).toBe(300);
  });

  it("returns fallback states for one month only and for two months without overlap", () => {
    const oneMonthSummary = buildHomeMeetComparisonSummary([
      buildMeet({
        id: "march-sun",
        program: "swimming",
        title: "2026年3月日曜",
        heldOn: "2026-03-08T00:00:00.000Z",
        createdAt: "2026-03-08T08:00:00.000Z",
        results: []
      }),
      buildMeet({
        id: "march-sat",
        program: "swimming",
        title: "2026年3月土曜",
        heldOn: "2026-03-07T00:00:00.000Z",
        createdAt: "2026-03-07T08:00:00.000Z",
        results: []
      })
    ]);

    const noOverlapSummary = buildHomeMeetComparisonSummary([
      buildMeet({
        id: "march",
        program: "swimming",
        title: "2026年3月",
        heldOn: "2026-03-01T00:00:00.000Z",
        createdAt: "2026-03-02T00:00:00.000Z",
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
        id: "sep",
        program: "swimming",
        title: "2025年9月",
        heldOn: "2025-09-01T00:00:00.000Z",
        createdAt: "2025-09-02T00:00:00.000Z",
        results: [
          buildResult({
            athleteId: "b1",
            fullName: "佐藤花子",
            gender: "female",
            eventTitle: "25m背泳ぎ",
            distanceM: 25,
            timeMs: 20_300
          })
        ]
      })
    ]);

    expect(oneMonthSummary?.state).toBe("waiting-next-meet");
    expect(oneMonthSummary?.currentMeet.title).toBe("2026年3月");
    expect(oneMonthSummary?.previousMeet).toBeNull();
    expect(noOverlapSummary?.state).toBe("not-comparable");
  });
});
