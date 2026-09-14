import { describe, expect, it } from "vitest";
import { renderChallengeRankingPdf } from "../lib/pdf";
import { RANKING_OUTPUT_GRADE_SEQUENCE } from "../lib/grade";
import type { ChallengeEventRankingGroup, RankingEntry } from "../lib/ranking-report";

function entry(name: string): RankingEntry {
  return {
    rank: 1,
    fullName: name,
    displayName: name,
    timeText: "18.00",
    recordMonthLabel: "2026年3月",
    isNewRecordInTargetMonth: true
  };
}

function fullEvent(eventTitle = "15m板キック"): ChallengeEventRankingGroup {
  return {
    eventTitle,
    gradeGroups: RANKING_OUTPUT_GRADE_SEQUENCE.map((grade) => ({
      grade,
      maleEntries: [entry(`確認 太郎${grade}`)],
      femaleEntries: [entry(`確認 花子${grade}`)]
    }))
  };
}

function pageCount(buffer: Buffer): number {
  // React-PDF writes uncompressed page dictionaries. Count the generated PDF's
  // physical pages, including automatic overflow, rather than React Page nodes.
  const pdf = buffer.toString("latin1");
  expect(pdf.startsWith("%PDF-")).toBe(true);
  return [...pdf.matchAll(/\/Type\s*\/Page\b/g)].length;
}

const historicalOptions = {
  periodLabel: "2026年3月 歴代1位記録一覧",
  highlightLegend: "NEW はこの月に新しく歴代1位になった記録",
  rankRange: { min: 1, max: 1 },
  layout: "historical" as const
};

describe("historical PDF physical pagination", () => {
  it("fits all ten grades on one A4 page per event without changing the default layout", async () => {
    const groups = [fullEvent(), fullEvent("30mクロール")];
    const compact = await renderChallengeRankingPdf({ ...historicalOptions, groups });
    expect(pageCount(compact)).toBe(2);

    const { layout: _layout, ...defaultOptions } = historicalOptions;
    const standard = await renderChallengeRankingPdf({ ...defaultOptions, groups });
    expect(pageCount(standard)).toBe(4);
  }, 20000);

  it("fits ties, a wrapping name, missing records, and NEW markers on one page", async () => {
    const group = fullEvent();
    group.gradeGroups[1]!.maleEntries = [];
    group.gradeGroups[2]!.maleEntries = [];
    group.gradeGroups[2]!.femaleEntries = [];
    group.gradeGroups[6]!.femaleEntries.push(entry("同記録 花子"));
    group.gradeGroups[8]!.maleEntries = [entry("とてもながいみょうじ ながいなまえ")];

    const buffer = await renderChallengeRankingPdf({ ...historicalOptions, groups: [group] });
    expect(pageCount(buffer)).toBe(1);
  }, 20000);

  it("allows continuation pages when many tied records exceed a page", async () => {
    const group = fullEvent();
    for (const grade of group.gradeGroups) {
      grade.maleEntries = Array.from({ length: 4 }, (_, i) => entry(`同記録${grade.grade} 選手${i}`));
    }
    const buffer = await renderChallengeRankingPdf({ ...historicalOptions, groups: [group] });
    expect(pageCount(buffer)).toBeGreaterThan(1);
  }, 20000);
});
