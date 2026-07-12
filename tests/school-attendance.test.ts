import { describe, expect, it } from "vitest";
import {
  isSchoolAbsenceResult,
  isSchoolAbsenceTimeText,
  normalizeSchoolTimeText,
  SCHOOL_ABSENCE_TIME_MS
} from "../lib/school-attendance";

describe("school attendance markers", () => {
  it.each(["a", "A", " a ", "Ａ", "ａ"])('treats "%s" as an absence', (value) => {
    expect(isSchoolAbsenceTimeText(value)).toBe(true);
    expect(normalizeSchoolTimeText(value)).toBe("a");
  });

  it("does not mistake an ordinary time for an absence", () => {
    expect(isSchoolAbsenceTimeText("45.12")).toBe(false);
    expect(isSchoolAbsenceResult({ timeText: "45.12", timeMs: SCHOOL_ABSENCE_TIME_MS })).toBe(false);
  });

  it("recognizes a stored absence by its explicit marker", () => {
    expect(isSchoolAbsenceResult({ timeText: "a", timeMs: SCHOOL_ABSENCE_TIME_MS })).toBe(true);
  });
});
