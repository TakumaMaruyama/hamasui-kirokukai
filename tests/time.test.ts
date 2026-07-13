import { describe, expect, it } from "vitest";
import { parseTimeToMs } from "../lib/time";

describe("parseTimeToMs", () => {
  it("parses minutes and seconds", () => {
    expect(parseTimeToMs("1:02.34")).toBe(62_340);
  });

  it("parses seconds only", () => {
    expect(parseTimeToMs("45.1")).toBe(45_100);
    expect(parseTimeToMs("65.29")).toBe(65_290);
  });

  it("rejects negative and malformed times", () => {
    expect(() => parseTimeToMs("-0.001")).toThrow("Invalid time format");
    expect(() => parseTimeToMs("1:60.00")).toThrow("Invalid time format");
    expect(() => parseTimeToMs("1.2.3")).toThrow("Invalid time format");
  });
});
