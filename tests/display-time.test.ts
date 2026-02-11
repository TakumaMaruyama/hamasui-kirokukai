import { describe, expect, it } from "vitest";
import { formatTimeForDocument } from "../lib/display-time";

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
