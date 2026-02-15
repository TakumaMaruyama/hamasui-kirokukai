import { describe, expect, it } from "vitest";
import { formatElementaryFirstGradeLabel, formatGradeLabel, formatGradeShortLabel } from "../lib/grade";

describe("grade label formatting", () => {
  it("formats preschool labels", () => {
    expect(formatGradeLabel(0)).toBe("年少々");
    expect(formatGradeLabel(1)).toBe("年少");
    expect(formatGradeLabel(2)).toBe("年中");
    expect(formatGradeLabel(3)).toBe("年長");
  });

  it("formats elementary and middle school labels", () => {
    expect(formatGradeLabel(4)).toBe("小学1年生");
    expect(formatGradeLabel(9)).toBe("小学6年生");
    expect(formatGradeLabel(10)).toBe("中学1年生");
    expect(formatGradeLabel(12)).toBe("中学3年生");
  });

  it("formats short labels for certificate templates", () => {
    expect(formatGradeShortLabel(2)).toBe("年中");
    expect(formatGradeShortLabel(4)).toBe("小1");
    expect(formatGradeShortLabel(10)).toBe("中1");
  });

  it("supports elementary-first labels for public search display", () => {
    expect(formatElementaryFirstGradeLabel(5)).toBe("小学5年生");
    expect(formatElementaryFirstGradeLabel(6)).toBe("小学6年生");
    expect(formatElementaryFirstGradeLabel(10)).toBe("中学1年生");
  });
});
