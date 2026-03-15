import { describe, expect, it } from "vitest";
import { buildSwimmingRecordOutputs, UNKNOWN_WEEKDAY_FOLDER_NAME } from "../lib/swimming-record-output";
import type { RecordCertificateSourceRow } from "../lib/record-certificate";

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
    timeMs: 11_680,
    meet: {
      heldOn: new Date("2025-09-01T00:00:00.000Z"),
      title: "2025年9月土曜",
      ...partial.meet
    },
    ...partial
  };
}

describe("buildSwimmingRecordOutputs", () => {
  it("keeps flat file output when weekday folders are disabled", () => {
    const outputs = buildSwimmingRecordOutputs([buildRow()], {
      year: 2025,
      month: 9,
      groupByWeekdayFolders: false
    });

    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.outputPath).toBe("宮之下 虎太朗_2025年9月_record.pdf");
  });

  it("keeps the best time per event and groups same-weekday rows into one certificate", () => {
    const outputs = buildSwimmingRecordOutputs(
      [
        buildRow({
          eventId: "event-1",
          timeText: "11秒80",
          timeMs: 11_800,
          meet: { heldOn: new Date("2025-09-01T00:00:00.000Z"), title: "2025年9月土曜" }
        }),
        buildRow({
          eventId: "event-1",
          timeText: "11秒68",
          timeMs: 11_680,
          meet: { heldOn: new Date("2025-09-10T00:00:00.000Z"), title: "2025年9月土曜（2）" }
        }),
        buildRow({
          eventId: "event-2",
          event: { title: "30mクロール" },
          timeText: "25秒40",
          timeMs: 25_400,
          meet: { heldOn: new Date("2025-09-10T00:00:00.000Z"), title: "2025年9月土曜（2）" }
        })
      ],
      {
        year: 2025,
        month: 9,
        groupByWeekdayFolders: true
      }
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.outputPath).toBe("土曜/宮之下 虎太朗_2025年9月_record.pdf");
    expect(outputs[0]?.entries.map((entry) => entry.eventTitle)).toEqual(["15mクロール", "30mクロール"]);
    expect(outputs[0]?.entries[0]?.timeText).toBe("11秒68");
  });

  it("splits different weekdays into separate folder outputs", () => {
    const outputs = buildSwimmingRecordOutputs(
      [
        buildRow({
          meet: { heldOn: new Date("2025-09-01T00:00:00.000Z"), title: "2025年9月月曜" }
        }),
        buildRow({
          athleteId: "athlete-2",
          athlete: {
            fullName: "横手 翔太朗",
            fullNameKana: "よこて しょうたろう",
            grade: 9,
            gender: "male"
          },
          meet: { heldOn: new Date("2025-09-02T00:00:00.000Z"), title: "2025年9月日曜" }
        }),
        buildRow({
          athleteId: "athlete-3",
          athlete: {
            fullName: "曜日なし 太郎",
            fullNameKana: "ようびなし たろう",
            grade: 9,
            gender: "male"
          },
          meet: { heldOn: new Date("2025-09-03T00:00:00.000Z"), title: "2025年9月" }
        })
      ],
      {
        year: 2025,
        month: 9,
        groupByWeekdayFolders: true
      }
    );

    expect(outputs.map((output) => output.outputPath)).toEqual([
      "月曜/宮之下 虎太朗_2025年9月_record.pdf",
      "日曜/横手 翔太朗_2025年9月_record.pdf",
      `${UNKNOWN_WEEKDAY_FOLDER_NAME}/曜日なし 太郎_2025年9月_record.pdf`
    ]);
  });
});
