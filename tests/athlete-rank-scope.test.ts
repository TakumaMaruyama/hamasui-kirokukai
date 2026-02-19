import { describe, expect, it } from "vitest";
import {
  buildAthleteRankScopeLabels,
  buildChildHistoryRankScopeLabels
} from "../lib/athlete-rank-scope";

describe("athlete rank scope labels", () => {
  it("builds labels for elementary female athletes", () => {
    const labels = buildAthleteRankScopeLabels({ grade: 8, gender: "female" });

    expect(labels.profileScopeLabel).toBe("小5女子");
    expect(labels.monthlyClassHeader).toBe("小5女子");
    expect(labels.monthlyOverallHeader).toBe("女子・全学年");
    expect(labels.allTimeClassHeader).toBe("小5女子");
  });

  it("builds labels for middle school male athletes", () => {
    const labels = buildAthleteRankScopeLabels({ grade: 10, gender: "male" });

    expect(labels.profileScopeLabel).toBe("中1男子");
    expect(labels.monthlyClassHeader).toBe("中1男子");
    expect(labels.monthlyOverallHeader).toBe("男子・全学年");
  });

  it("builds labels for other gender without empty text", () => {
    const labels = buildAthleteRankScopeLabels({ grade: 8, gender: "other" });

    expect(labels.profileScopeLabel).toBe("小5その他");
    expect(labels.monthlyOverallHeader).toBe("その他・全学年");
  });

  it("uses short grade labels at boundaries", () => {
    const preschool = buildAthleteRankScopeLabels({ grade: 0, gender: "female" });
    const elementary = buildAthleteRankScopeLabels({ grade: 4, gender: "female" });
    const high = buildAthleteRankScopeLabels({ grade: 13, gender: "male" });

    expect(preschool.profileScopeLabel).toBe("年少々女子");
    expect(elementary.profileScopeLabel).toBe("小1女子");
    expect(high.profileScopeLabel).toBe("高1男子");
  });

  it("builds child history labels without fixed grade", () => {
    const female = buildChildHistoryRankScopeLabels({ gender: "female" });
    const male = buildChildHistoryRankScopeLabels({ gender: "male" });

    expect(female.monthlyClassHeader).toBe("同学年・同性別");
    expect(female.monthlyOverallHeader).toBe("女子・全学年");
    expect(female.allTimeClassHeader).toBe("同学年・同性別");
    expect(male.monthlyOverallHeader).toBe("男子・全学年");
  });
});
