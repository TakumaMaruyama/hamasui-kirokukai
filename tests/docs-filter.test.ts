import { describe, expect, it } from "vitest";
import { buildMeetWhere, parseDocsFilterInput } from "../lib/docs-filter";

describe("docs filter", () => {
  it("accepts empty filter", () => {
    const parsed = parseDocsFilterInput({});
    expect(parsed.ok).toBe(true);

    if (!parsed.ok) {
      return;
    }

    expect(parsed.value.hasMonthFilter).toBe(false);
    expect(parsed.value.fullName).toBeUndefined();
  });

  it("accepts year/month/weekday and creates month range", () => {
    const parsed = parseDocsFilterInput({
      year: "2025",
      month: "9",
      weekday: "水曜"
    });
    expect(parsed.ok).toBe(true);

    if (!parsed.ok) {
      return;
    }

    expect(parsed.value.year).toBe(2025);
    expect(parsed.value.month).toBe(9);
    expect(parsed.value.weekday).toBe("水曜");
    expect(parsed.value.monthStart?.toISOString()).toBe("2025-09-01T00:00:00.000Z");
    expect(parsed.value.monthEnd?.toISOString()).toBe("2025-10-01T00:00:00.000Z");
  });

  it("normalizes full name and requires year/month", () => {
    const invalid = parseDocsFilterInput({
      fullName: "  山田   太郎 "
    });
    expect(invalid.ok).toBe(false);

    const valid = parseDocsFilterInput({
      year: 2025,
      month: 9,
      fullName: "  山田   太郎 "
    });
    expect(valid.ok).toBe(true);

    if (!valid.ok) {
      return;
    }

    expect(valid.value.fullName).toBe("山田 太郎");
  });

  it("builds meet where by program and filters", () => {
    const parsed = parseDocsFilterInput({
      year: 2025,
      month: 9,
      weekday: "水曜"
    });
    expect(parsed.ok).toBe(true);

    if (!parsed.ok) {
      return;
    }

    const where = buildMeetWhere("swimming", parsed.value);
    expect(where).toEqual({
      program: "swimming",
      heldOn: {
        gte: new Date("2025-09-01T00:00:00.000Z"),
        lt: new Date("2025-10-01T00:00:00.000Z")
      },
      title: {
        contains: "水曜"
      }
    });
  });

  it("builds meet where for challenge program", () => {
    const parsed = parseDocsFilterInput({
      year: 2026,
      month: 2
    });
    expect(parsed.ok).toBe(true);

    if (!parsed.ok) {
      return;
    }

    const where = buildMeetWhere("challenge", parsed.value);
    expect(where).toEqual({
      program: "challenge",
      heldOn: {
        gte: new Date("2026-02-01T00:00:00.000Z"),
        lt: new Date("2026-03-01T00:00:00.000Z")
      }
    });
  });
});
