import { describe, expect, it } from "vitest";
import { parseTimeToMs } from "@/lib/time";

describe("parseTimeToMs", () => {
  it("parses minutes and seconds", () => {
    expect(parseTimeToMs("1:02.34")).toBe(62_340);
  });

  it("parses seconds only", () => {
    expect(parseTimeToMs("45.1")).toBe(45_100);
  });
});
