import { describe, expect, it } from "vitest";
import { formatMeetLabel, formatMeetMonthLabel, formatMeetTitle, parseMeetTitleContext } from "../lib/meet-context";

describe("meet context", () => {
  it("formats title with unified weekday", () => {
    expect(formatMeetTitle({ year: 2026, month: 2, weekday: "木曜" })).toBe("2026年2月木曜");
    expect(formatMeetTitle({ year: 2026, month: 2 })).toBe("2026年2月");
  });

  it("parses both 木曜 and 木曜日 titles", () => {
    expect(parseMeetTitleContext("2026年2月木曜")).toEqual({
      year: 2026,
      month: 2,
      weekday: "木曜"
    });

    expect(parseMeetTitleContext("2026年2月木曜日")).toEqual({
      year: 2026,
      month: 2,
      weekday: "木曜"
    });

    expect(parseMeetTitleContext("2026年2月木曜（2）")).toEqual({
      year: 2026,
      month: 2,
      weekday: "木曜"
    });

    expect(parseMeetTitleContext("2026年2月")).toEqual({
      year: 2026,
      month: 2
    });

    expect(parseMeetTitleContext("2026年2月（2）")).toEqual({
      year: 2026,
      month: 2
    });
  });

  it("formats meet label from title context", () => {
    expect(
      formatMeetLabel({
        title: "2026年2月木曜日",
        heldOn: new Date("2026-02-01T00:00:00.000Z")
      })
    ).toBe("2026年2月 木曜");

    expect(
      formatMeetLabel({
        title: "2026年2月木曜日（2）",
        heldOn: new Date("2026-02-01T00:00:00.000Z")
      })
    ).toBe("2026年2月 木曜 （2）");

    expect(
      formatMeetLabel({
        title: "2026年2月（2）",
        heldOn: new Date("2026-02-01T00:00:00.000Z")
      })
    ).toBe("2026年2月 （2）");
  });

  it("formats user-facing meet month labels without suffix", () => {
    expect(
      formatMeetMonthLabel({
        title: "2026年2月木曜日（2）",
        heldOn: new Date("2026-02-01T00:00:00.000Z")
      })
    ).toBe("2026年2月");

    expect(
      formatMeetMonthLabel({
        title: "任意タイトル",
        heldOn: new Date("2026-02-15T00:00:00.000Z")
      })
    ).toBe("2026年2月");
  });
});
