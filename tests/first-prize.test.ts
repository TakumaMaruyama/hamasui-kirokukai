import { describe, expect, it } from "vitest";
import { buildFirstPrizeAwards, formatFirstPrizeGenderLabel, type FirstPrizeSourceRow } from "../lib/first-prize";

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
