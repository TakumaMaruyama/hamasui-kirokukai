import { describe, expect, it } from "vitest";
import {
  buildRecordCertificates,
  toRecordCertificateDisplayEntries,
  type RecordCertificateSourceRow
} from "../lib/record-certificate";

function buildRow(partial: Partial<RecordCertificateSourceRow> = {}): RecordCertificateSourceRow {
  return {
    athleteId: "athlete-1",
    eventId: "event-1",
    athlete: {
      fullName: "宮之下 虎太朗",
      fullNameKana: "みやのした こたろう",
      grade: 12,
      gender: "male",
      ...partial.athlete
    },
    event: {
      title: "15mクロール",
      ...partial.event
    },
    timeText: "11秒68",
    timeMs: 11680,
    meet: {
      heldOn: new Date("2025-09-01T00:00:00.000Z"),
      ...partial.meet
    },
    ...partial
  };
}

describe("buildRecordCertificates", () => {
  it("groups rows by athlete and keeps best row per event", () => {
    const certificates = buildRecordCertificates([
      buildRow({
        athleteId: "athlete-1",
        eventId: "event-1",
        event: { title: "15mクロール" },
        timeText: "11秒80",
        timeMs: 11800
      }),
      buildRow({
        athleteId: "athlete-1",
        eventId: "event-1",
        event: { title: "15mクロール" },
        timeText: "11秒68",
        timeMs: 11680
      }),
      buildRow({
        athleteId: "athlete-1",
        eventId: "event-2",
        event: { title: "30mクロール" },
        timeText: "25秒40",
        timeMs: 25400
      })
    ]);

    expect(certificates).toHaveLength(1);
    expect(certificates[0]?.entries).toHaveLength(2);
    expect(certificates[0]?.entries.map((entry) => entry.eventTitle)).toEqual(["15mクロール", "30mクロール"]);
    expect(certificates[0]?.entries[0]?.timeText).toBe("11秒68");
  });

  it("falls back kana to full name when kana is missing", () => {
    const certificates = buildRecordCertificates([
      buildRow({
        athlete: {
          fullName: "宮之下 虎太朗",
          fullNameKana: null,
          grade: 12,
          gender: "male"
        }
      })
    ]);

    expect(certificates[0]?.athlete.fullNameKana).toBe("宮之下 虎太朗");
  });

  it("uses provided year/month as issue label when month filter exists", () => {
    const certificates = buildRecordCertificates([buildRow()], { year: 2026, month: 2 });
    expect(certificates[0]?.issueLabel).toBe("2026年2月");
    expect(certificates[0]?.fileName).toContain("2026年2月");
  });

  it("uses meet heldOn for issue label when month filter is absent", () => {
    const certificates = buildRecordCertificates([
      buildRow({
        meet: {
          heldOn: new Date("2025-11-01T00:00:00.000Z")
        }
      })
    ]);
    expect(certificates[0]?.issueLabel).toBe("2025年11月");
  });

  it("ensures unique filenames even when base names collide", () => {
    const source = buildRow();
    const certificates = buildRecordCertificates([
      source,
      {
        ...source,
        athleteId: "athlete-2"
      }
    ]);

    expect(certificates).toHaveLength(2);
    expect(certificates[0]?.fileName).not.toBe(certificates[1]?.fileName);
  });
});

describe("toRecordCertificateDisplayEntries", () => {
  it("limits rows to 6 and appends ellipsis row", () => {
    const input = Array.from({ length: 7 }, (_, index) => ({
      eventTitle: `${index + 1}種目`,
      timeText: `${index + 1}秒`,
      timeMs: (index + 1) * 1000
    }));

    const displayed = toRecordCertificateDisplayEntries(input);
    expect(displayed).toHaveLength(7);
    expect(displayed[6]?.eventTitle).toBe("...");
    expect(displayed[6]?.timeText).toBe("...");
  });
});
