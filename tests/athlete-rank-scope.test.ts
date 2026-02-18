import { describe, expect, it } from "vitest";
import { buildAthleteRankScopeLabels } from "../lib/athlete-rank-scope";

describe("athlete rank scope labels", () => {
  it("builds labels for elementary female athletes", () => {
    const labels = buildAthleteRankScopeLabels({ grade: 8, gender: "female" });

    expect(labels.profileScopeLabel).toBe("小5女子");
    expect(labels.monthlyClassHeader).toContain("小5女子");
    expect(labels.monthlyOverallHeader).toBe("性別内（女子・学年混合）");
    expect(labels.allTimeClassHeader).toContain("小5女子");
    expect(labels.guideRows).toEqual([
      "月内 × 小5女子内",
      "月内 × 女子内（学年混合）",
      "歴代 × 小5女子内"
    ]);
  });

  it("builds labels for middle school male athletes", () => {
    const labels = buildAthleteRankScopeLabels({ grade: 10, gender: "male" });

    expect(labels.profileScopeLabel).toBe("中1男子");
    expect(labels.monthlyClassHeader).toBe("同学年・同性別（中1男子）");
    expect(labels.monthlyOverallHeader).toBe("性別内（男子・学年混合）");
  });

  it("builds labels for other gender without empty text", () => {
    const labels = buildAthleteRankScopeLabels({ grade: 8, gender: "other" });

    expect(labels.profileScopeLabel).toBe("小5その他");
    expect(labels.monthlyOverallHeader).toBe("性別内（その他・学年混合）");
    expect(labels.guideRows[1]).toBe("月内 × その他内（学年混合）");
  });

  it("uses short grade labels at boundaries", () => {
    const preschool = buildAthleteRankScopeLabels({ grade: 0, gender: "female" });
    const elementary = buildAthleteRankScopeLabels({ grade: 4, gender: "female" });
    const high = buildAthleteRankScopeLabels({ grade: 13, gender: "male" });

    expect(preschool.profileScopeLabel).toBe("年少々女子");
    expect(elementary.profileScopeLabel).toBe("小1女子");
    expect(high.profileScopeLabel).toBe("高1男子");
  });
});
