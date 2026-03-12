import { describe, expect, it } from "vitest";
import { formatImprovementTotal, formatTimeForDocument } from "../lib/display-time";

describe("formatTimeForDocument", () => {
  it("keeps 60 seconds or less as-is", () => {
    expect(formatTimeForDocument({ timeText: "59.87", timeMs: 59_870 })).toBe("59.87");
    expect(formatTimeForDocument({ timeText: "1:00.00", timeMs: 60_000 })).toBe("1:00.00");
  });

  it("formats above 60 seconds in minute/second style", () => {
    expect(formatTimeForDocument({ timeText: "1:05.32", timeMs: 65_320 })).toBe("1分5秒32");
    expect(formatTimeForDocument({ timeText: "2:03.00", timeMs: 123_000 })).toBe("2分3秒");
  });
});

describe("formatImprovementTotal", () => {
  it("formats under 60 seconds as decimal seconds", () => {
    expect(formatImprovementTotal(17_780)).toBe("17.78秒");
    expect(formatImprovementTotal(0)).toBe("0.00秒");
  });

  it("formats 60 seconds or more as decimal seconds", () => {
    expect(formatImprovementTotal(65_320)).toBe("65.32秒");
    expect(formatImprovementTotal(123_000)).toBe("123.00秒");
  });
});
