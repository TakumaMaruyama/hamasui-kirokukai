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
  it("selects the latest two swimming meets and ignores other programs", () => {
    const summary = buildHomeMeetComparisonSummary([
      buildMeet({
        id: "school-newer",
        program: "school",
        title: "学校委託",
        heldOn: "2025-10-01T00:00:00.000Z",
        createdAt: "2025-10-02T00:00:00.000Z",
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

    expect(summary).not.toBeNull();
    expect(summary?.currentMeet.id).toBe("swim-current");
    expect(summary?.previousMeet?.id).toBe("swim-previous");
    expect(summary?.state).toBe("ready");
  });

  it("ignores the third latest meet even when it has comparable rows", () => {
    const summary = buildHomeMeetComparisonSummary([
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
            fullName: "佐藤花子",
            gender: "female",
            eventTitle: "25m背泳ぎ",
            distanceM: 25,
            timeMs: 20_300
          })
        ]
      }),
      buildMeet({
        id: "older",
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

    expect(summary?.currentMeet.id).toBe("current");
    expect(summary?.previousMeet?.id).toBe("previous");
    expect(summary?.state).toBe("not-comparable");
    expect(summary?.comparedEntryCount).toBe(0);
  });

  it("uses createdAt as the tiebreaker when heldOn is the same", () => {
    const summary = buildHomeMeetComparisonSummary([
      buildMeet({
        id: "older-created",
        program: "swimming",
        title: "2025年3月 土曜",
        heldOn: "2025-03-01T00:00:00.000Z",
        createdAt: "2025-03-01T01:00:00.000Z",
        results: []
      }),
      buildMeet({
        id: "newer-created",
        program: "swimming",
        title: "2025年3月 日曜",
        heldOn: "2025-03-01T00:00:00.000Z",
        createdAt: "2025-03-01T02:00:00.000Z",
        results: []
      }),
      buildMeet({
        id: "oldest",
        program: "swimming",
        title: "2025年2月",
        heldOn: "2025-02-01T00:00:00.000Z",
        createdAt: "2025-02-02T00:00:00.000Z",
        results: []
      })
    ]);

    expect(summary?.currentMeet.id).toBe("newer-created");
    expect(summary?.previousMeet?.id).toBe("older-created");
  });

  it("matches rows across whitespace, school year changes, and full/half-width event text", () => {
    const summary = buildHomeMeetComparisonSummary([
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
      })
    ]);

    expect(summary?.comparedEntryCount).toBe(1);
    expect(summary?.totalImprovementMs).toBe(300);
    expect(summary?.improvedEntryCount).toBe(1);
    expect(summary?.improvedChildCount).toBe(1);
  });

  it("treats freestyle label variants as the same comparable event", () => {
    const summary = buildHomeMeetComparisonSummary([
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
        title: "2025年3月",
        heldOn: "2025-03-01T00:00:00.000Z",
        createdAt: "2025-03-02T00:00:00.000Z",
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
    expect(summary?.comparedEntryCount).toBe(1);
    expect(summary?.improvedEntryCount).toBe(1);
    expect(summary?.totalImprovementMs).toBe(300);
  });

  it("adds only positive improvements and ignores slower, tied, or missing rows", () => {
    const summary = buildHomeMeetComparisonSummary([
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
      })
    ]);

    expect(summary?.comparedEntryCount).toBe(3);
    expect(summary?.totalImprovementMs).toBe(300);
    expect(summary?.improvedEntryCount).toBe(1);
    expect(summary?.improvedChildCount).toBe(1);
  });

  it("counts a child once even when the child improves in multiple events", () => {
    const summary = buildHomeMeetComparisonSummary([
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

    expect(summary?.improvedEntryCount).toBe(3);
    expect(summary?.improvedChildCount).toBe(2);
  });

  it("uses the fastest record when duplicated comparison keys exist within the same meet", () => {
    const summary = buildHomeMeetComparisonSummary([
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
      })
    ]);

    expect(summary?.state).toBe("ready");
    expect(summary?.comparedEntryCount).toBe(1);
    expect(summary?.improvedEntryCount).toBe(1);
    expect(summary?.improvedChildCount).toBe(1);
    expect(summary?.totalImprovementMs).toBe(300);
  });

  it("returns fallback states for one meet and for two meets without overlap", () => {
    const oneMeetSummary = buildHomeMeetComparisonSummary([
      buildMeet({
        id: "current-only",
        program: "swimming",
        title: "2025年9月",
        heldOn: "2025-09-01T00:00:00.000Z",
        createdAt: "2025-09-02T00:00:00.000Z",
        results: []
      })
    ]);

    const noOverlapSummary = buildHomeMeetComparisonSummary([
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
            fullName: "佐藤花子",
            gender: "female",
            eventTitle: "25m背泳ぎ",
            distanceM: 25,
            timeMs: 20_300
          })
        ]
      })
    ]);

    expect(oneMeetSummary?.state).toBe("waiting-next-meet");
    expect(oneMeetSummary?.previousMeet).toBeNull();
    expect(noOverlapSummary?.state).toBe("not-comparable");
    expect(noOverlapSummary?.comparedEntryCount).toBe(0);
  });
});
