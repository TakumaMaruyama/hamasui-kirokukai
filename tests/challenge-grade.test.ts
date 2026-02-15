import { describe, expect, it } from "vitest";
import {
  CHALLENGE_GRADE_MAX,
  CHALLENGE_GRADE_MIN,
  filterChallengeGradeRows,
  isChallengeGrade
} from "../lib/challenge-grade";

describe("challenge grade filter", () => {
  it("accepts lower and upper bounds", () => {
    expect(isChallengeGrade(String(CHALLENGE_GRADE_MIN))).toBe(true);
    expect(isChallengeGrade(String(CHALLENGE_GRADE_MAX))).toBe(true);
  });

  it("rejects out-of-range and invalid values", () => {
    expect(isChallengeGrade("0")).toBe(false);
    expect(isChallengeGrade(String(CHALLENGE_GRADE_MAX + 1))).toBe(false);
    expect(isChallengeGrade("年中")).toBe(false);
    expect(isChallengeGrade("")).toBe(false);
  });

  it("returns accepted rows and skipped count", () => {
    const rows = [
      { id: "a", grade: "1" },
      { id: "b", grade: "15" },
      { id: "c", grade: "0" },
      { id: "d", grade: "16" },
      { id: "e", grade: "x" }
    ];

    const result = filterChallengeGradeRows(rows);

    expect(result.acceptedRows.map((row) => row.id)).toEqual(["a", "b"]);
    expect(result.skippedCount).toBe(3);
  });

  it("handles all rows skipped", () => {
    const result = filterChallengeGradeRows([
      { grade: "0" },
      { grade: "20" }
    ]);

    expect(result.acceptedRows).toHaveLength(0);
    expect(result.skippedCount).toBe(2);
  });
});
