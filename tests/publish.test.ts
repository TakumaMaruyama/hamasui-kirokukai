import { describe, expect, it } from "vitest";
import { formatPublishUntil, isPublicNow, parsePublishUntilInput, toDateInputValue } from "../lib/publish";

describe("publish helpers", () => {
  it("parses date input as end-of-day UTC", () => {
    const parsed = parsePublishUntilInput("2026-02-10");

    expect(parsed?.toISOString()).toBe("2026-02-10T23:59:59.999Z");
  });

  it("returns null for empty input", () => {
    expect(parsePublishUntilInput("")).toBeNull();
  });

  it("checks publication status against now", () => {
    const now = new Date("2026-02-10T12:00:00.000Z");
    const before = new Date("2026-02-10T11:59:59.000Z");
    const after = new Date("2026-02-10T12:00:01.000Z");

    expect(isPublicNow(before, now)).toBe(false);
    expect(isPublicNow(after, now)).toBe(true);
    expect(isPublicNow(null, now)).toBe(false);
  });

  it("formats publish date for UI", () => {
    const value = new Date("2026-02-10T23:59:59.999Z");
    expect(toDateInputValue(value)).toBe("2026-02-10");
    expect(formatPublishUntil(value)).toBe("2026-02-10");
    expect(formatPublishUntil(null)).toBe("未設定");
  });
});
