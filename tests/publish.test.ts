import { describe, expect, it } from "vitest";
import { formatPublishRange, parsePublishDateInput, toDateInputValue } from "../lib/publish";

describe("publish helpers", () => {
  it("parses start date input as start-of-day UTC", () => {
    const parsed = parsePublishDateInput("2026-02-10", "start");

    expect(parsed?.toISOString()).toBe("2026-02-10T00:00:00.000Z");
  });

  it("parses end date input as end-of-day UTC", () => {
    const parsed = parsePublishDateInput("2026-02-10", "end");

    expect(parsed?.toISOString()).toBe("2026-02-10T23:59:59.999Z");
  });

  it("returns null for empty input", () => {
    expect(parsePublishDateInput("", "start")).toBeNull();
    expect(parsePublishDateInput("", "end")).toBeNull();
  });

  it("formats publish range for UI", () => {
    const from = new Date("2026-02-01T00:00:00.000Z");
    const until = new Date("2026-02-10T23:59:59.999Z");

    expect(toDateInputValue(from)).toBe("2026-02-01");
    expect(toDateInputValue(until)).toBe("2026-02-10");
    expect(formatPublishRange(from, until)).toBe("公開期限は2月1日～2月10日です");
    expect(formatPublishRange(from, null)).toBe("公開期限は2月1日からです");
    expect(formatPublishRange(null, until)).toBe("公開期限は2月10日までです");
    expect(formatPublishRange(null, null)).toBe("公開期限は未設定です");
  });
});
