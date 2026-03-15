import { describe, expect, it } from "vitest";
import {
  buildFirstPrizeAwards,
  formatFirstPrizeGenderLabel,
  selectMonthlyFirstPrizeRows,
  type FirstPrizeSourceRow,
  type MonthlyFirstPrizeSourceRow
} from "../lib/first-prize";

function buildRow(partial: Partial<FirstPrizeSourceRow> = {}): FirstPrizeSourceRow {
  return {
    athlete: {
      fullName: "徳重 湊仁",
      fullNameKana: "とくしげ みなと",
      grade: 1,
      gender: "male",
      ...partial.athlete
    },
    event: {
      title: "15m板キック",
      ...partial.event
    },
    timeText: "2分1秒77",
    timeMs: 121_770,
    meet: {
      heldOn: new Date("2025-09-10T00:00:00.000Z"),
      ...partial.meet
    }
  };
}

function buildMonthlyRow(partial: Partial<MonthlyFirstPrizeSourceRow> = {}): MonthlyFirstPrizeSourceRow {
  const athlete = {
    fullName: "徳重 湊仁",
    fullNameKana: "とくしげ みなと",
    grade: 1,
    gender: "male" as const,
    ...partial.athlete
  };
  const event = {
    title: "15m板キック",
    distanceM: 15,
    style: "kick",
    grade: 1,
    gender: "male" as const,
    ...partial.event
  };
  const meet = {
    heldOn: new Date("2025-09-10T00:00:00.000Z"),
    ...partial.meet
  };
  const { athlete: _athlete, event: _event, meet: _meet, ...rest } = partial;

  return {
    id: "result-1",
    athlete,
    event,
    timeText: "2分1秒77",
    timeMs: 121_770,
    meet,
    ...rest
  };
}

describe("formatFirstPrizeGenderLabel", () => {
  it("returns japanese gender labels", () => {
    expect(formatFirstPrizeGenderLabel("male")).toBe("男子");
    expect(formatFirstPrizeGenderLabel("female")).toBe("女子");
    expect(formatFirstPrizeGenderLabel("other")).toBe("その他");
  });
});

describe("buildFirstPrizeAwards", () => {
  it("builds one award per row (tie should create multiple files)", () => {
    const awards = buildFirstPrizeAwards([
      buildRow({ athlete: { fullName: "徳重 湊仁" } }),
      buildRow({ athlete: { fullName: "宮之下 虎太朗" } })
    ]);

    expect(awards).toHaveLength(2);
    expect(awards.map((award) => award.athlete.fullName)).toEqual(["徳重 湊仁", "宮之下 虎太朗"]);
  });

  it("falls back kana to full name when kana is missing", () => {
    const awards = buildFirstPrizeAwards([buildRow({ athlete: { fullNameKana: null } })]);
    expect(awards[0]?.athlete.fullNameKana).toBe("徳重 湊仁");
  });

  it("uses provided year/month as issue label when month filter exists", () => {
    const awards = buildFirstPrizeAwards([buildRow()], { year: 2026, month: 2 });
    expect(awards[0]?.issueLabel).toBe("2026年2月");
    expect(awards[0]?.fileName).toContain("2026年2月");
  });

  it("uses meet heldOn for issue label when month filter is absent", () => {
    const awards = buildFirstPrizeAwards([buildRow({ meet: { heldOn: new Date("2025-11-01T00:00:00.000Z") } })]);
    expect(awards[0]?.issueLabel).toBe("2025年11月");
  });

  it("ensures unique filenames even when base names collide", () => {
    const source = buildRow();
    const awards = buildFirstPrizeAwards([source, source]);

    expect(awards).toHaveLength(2);
    expect(awards[0]?.fileName).not.toBe(awards[1]?.fileName);
  });
});

describe("selectMonthlyFirstPrizeRows", () => {
  it("keeps only monthly first place per event class", () => {
    const selected = selectMonthlyFirstPrizeRows([
      buildMonthlyRow({
        id: "winner",
        athlete: { fullName: "最速 男子", grade: 5, gender: "male" },
        event: { grade: 5, gender: "male" },
        timeText: "20.00",
        timeMs: 20_000
      }),
      buildMonthlyRow({
        id: "loser",
        athlete: { fullName: "次点 男子", grade: 5, gender: "male" },
        event: { grade: 5, gender: "male" },
        timeText: "21.00",
        timeMs: 21_000
      }),
      buildMonthlyRow({
        id: "female-winner",
        athlete: { fullName: "最速 女子", grade: 5, gender: "female" },
        event: { grade: 5, gender: "female" },
        timeText: "19.00",
        timeMs: 19_000
      })
    ]);

    expect(selected.map((row) => row.athlete.fullName)).toEqual(["最速 男子", "最速 女子"]);
  });

  it("keeps only the best row for the same swimmer within a month", () => {
    const selected = selectMonthlyFirstPrizeRows([
      buildMonthlyRow({
        id: "slow",
        athlete: { fullName: "徳重 湊仁" },
        timeText: "21.00",
        timeMs: 21_000,
        meet: { heldOn: new Date("2025-09-01T00:00:00.000Z") }
      }),
      buildMonthlyRow({
        id: "fast",
        athlete: { fullName: "徳重 湊仁" },
        timeText: "20.00",
        timeMs: 20_000,
        meet: { heldOn: new Date("2025-09-20T00:00:00.000Z") }
      })
    ]);

    expect(selected).toHaveLength(1);
    expect(selected[0]?.timeText).toBe("20.00");
  });

  it("keeps all swimmers tied for monthly first", () => {
    const selected = selectMonthlyFirstPrizeRows([
      buildMonthlyRow({
        id: "tie-1",
        athlete: { fullName: "同タイA", grade: 4, gender: "male" },
        event: { grade: 4, gender: "male" },
        timeText: "18.00",
        timeMs: 18_000
      }),
      buildMonthlyRow({
        id: "tie-2",
        athlete: { fullName: "同タイB", grade: 4, gender: "male" },
        event: { grade: 4, gender: "male" },
        timeText: "18.00",
        timeMs: 18_000
      }),
      buildMonthlyRow({
        id: "third",
        athlete: { fullName: "3位", grade: 4, gender: "male" },
        event: { grade: 4, gender: "male" },
        timeText: "19.00",
        timeMs: 19_000
      })
    ]);

    expect(selected.map((row) => row.athlete.fullName)).toEqual(["同タイA", "同タイB"]);
  });
});
