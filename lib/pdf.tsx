import fs from "node:fs";
import path from "node:path";
import { Athlete } from "@prisma/client";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { RankingGroup } from "./ranking-report";
import { formatTimeForDocument } from "./display-time";

const FONT_FAMILY = "NotoSansJP";
const NOTO_SANS_JP_FONT_URL = "https://fonts.gstatic.com/ea/notosansjapanese/v6/NotoSansJP-Regular.otf";
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const RECORD_TEMPLATE_FILE = "record-certificate.png";
const FIRST_PRIZE_TEMPLATE_FILE = "first-prize-certificate.png";
const TEMPLATE_DIRECTORY = path.join(process.cwd(), "public", "pdf-templates");

const templateCache = new Map<string, string | null>();
let fontRegistered = false;

export type RecordPdfEntry = {
  eventTitle: string;
  timeText: string;
  timeMs?: number;
};

export type CertificatePdfEntry = {
  eventTitle: string;
  timeText: string;
  timeMs?: number;
};

function ensureFontRegistered() {
  if (fontRegistered) {
    return;
  }

  Font.register({
    family: FONT_FAMILY,
    src: NOTO_SANS_JP_FONT_URL
  });

  fontRegistered = true;
}

function genderLabel(gender: "male" | "female" | "other"): string {
  if (gender === "male") {
    return "男子";
  }

  if (gender === "female") {
    return "女子";
  }

  return "その他";
}

function getMimeType(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  return "application/octet-stream";
}

function getTemplateDataUri(fileName: string): string | null {
  const cached = templateCache.get(fileName);
  if (typeof cached !== "undefined") {
    return cached;
  }

  const filePath = path.join(TEMPLATE_DIRECTORY, fileName);
  if (!fs.existsSync(filePath)) {
    templateCache.set(fileName, null);
    return null;
  }

  const mimeType = getMimeType(fileName);
  const base64 = fs.readFileSync(filePath).toString("base64");
  const dataUri = `data:${mimeType};base64,${base64}`;

  templateCache.set(fileName, dataUri);
  return dataUri;
}

function buildRecordLines(entries: RecordPdfEntry[]) {
  const visibleEntries = entries.slice(0, 6);
  const eventLines = visibleEntries.map((entry) => entry.eventTitle);
  const timeLines = visibleEntries.map((entry) => formatTimeForDocument({ timeText: entry.timeText, timeMs: entry.timeMs }));

  if (entries.length > visibleEntries.length) {
    eventLines.push("...");
    timeLines.push("...");
  }

  return {
    events: eventLines.join("\n"),
    times: timeLines.join("\n")
  };
}

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    padding: 32
  },
  title: {
    fontSize: 20,
    textAlign: "center",
    marginBottom: 12
  },
  meta: {
    marginBottom: 4
  },
  table: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#cccccc"
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#cccccc"
  },
  rowLast: {
    borderBottomWidth: 0
  },
  cell: {
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  cellEvent: {
    width: "50%"
  },
  cellTime: {
    width: "25%"
  },
  cellRank: {
    width: "25%"
  },
  headerCell: {
    backgroundColor: "#f5f5f5",
    fontWeight: 700
  },
  rankingGroup: {
    marginTop: 14
  },
  rankingGroupTitle: {
    fontSize: 13,
    marginBottom: 6
  },
  empty: {
    marginTop: 24,
    textAlign: "center",
    color: "#666666"
  },
  templatePage: {
    position: "relative",
    width: A4_WIDTH,
    height: A4_HEIGHT,
    fontFamily: FONT_FAMILY
  },
  templateBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    width: A4_WIDTH,
    height: A4_HEIGHT
  },
  recordNameValue: {
    position: "absolute",
    top: 250,
    left: 120,
    width: 260,
    fontSize: 30
  },
  recordNameKanaValue: {
    position: "absolute",
    top: 226,
    left: 120,
    width: 260,
    fontSize: 14
  },
  recordGradeValue: {
    position: "absolute",
    top: 250,
    left: 392,
    width: 96,
    textAlign: "center",
    fontSize: 30
  },
  recordEventValue: {
    position: "absolute",
    top: 358,
    left: 154,
    width: 210,
    fontSize: 20,
    lineHeight: 1.5
  },
  recordTimeValue: {
    position: "absolute",
    top: 358,
    left: 364,
    width: 188,
    fontSize: 20,
    lineHeight: 1.5
  },
  prizeName: {
    position: "absolute",
    top: 360,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 54
  },
  prizeNameKana: {
    position: "absolute",
    top: 332,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 20
  },
  prizeEvent: {
    position: "absolute",
    top: 484,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 30,
    lineHeight: 1.4
  },
  prizeTime: {
    position: "absolute",
    top: 564,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 28,
    lineHeight: 1.4
  },
  prizeMeta: {
    position: "absolute",
    top: 438,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 24
  }
});

async function renderPdfDocument(document: ReactElement): Promise<Buffer> {
  ensureFontRegistered();

  try {
    return await renderToBuffer(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/font|fetch|network/i.test(message)) {
      throw new Error("PDF生成に失敗しました。フォント取得に失敗した可能性があります。ネットワーク接続を確認してください。");
    }
    throw error;
  }
}

function buildRecordTemplateDocument({
  athlete,
  entries,
  templateDataUri
}: {
  athlete: Athlete;
  entries: RecordPdfEntry[];
  templateDataUri: string;
}): ReactElement {
  const lines = buildRecordLines(entries);
  const nameKana = athlete.fullNameKana?.trim() || athlete.fullName;

  return (
    <Document>
      <Page size="A4" style={styles.templatePage}>
        <Image style={styles.templateBackground} src={templateDataUri} />
        <Text style={styles.recordNameKanaValue}>{nameKana}</Text>
        <Text style={styles.recordNameValue}>{athlete.fullName}</Text>
        <Text style={styles.recordGradeValue}>{athlete.grade}年</Text>
        <Text style={styles.recordEventValue}>{lines.events}</Text>
        <Text style={styles.recordTimeValue}>{lines.times}</Text>
      </Page>
    </Document>
  );
}

function buildRecordFallbackDocument({
  athlete,
  entries
}: {
  athlete: Athlete;
  entries: RecordPdfEntry[];
}): ReactElement {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>記録証</Text>
        <Text style={styles.meta}>ふりがな: {athlete.fullNameKana || athlete.fullName}</Text>
        <Text style={styles.meta}>氏名: {athlete.fullName}</Text>
        <Text style={styles.meta}>学年: {athlete.grade}年</Text>

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.cell, styles.cellEvent, styles.headerCell]}>種目</Text>
            <Text style={[styles.cell, styles.cellTime, styles.headerCell]}>記録</Text>
          </View>
          {entries.map((entry, index) => (
            <View key={`${entry.eventTitle}-${entry.timeText}-${index}`} style={index === entries.length - 1 ? [styles.row, styles.rowLast] : styles.row}>
              <Text style={[styles.cell, styles.cellEvent]}>{entry.eventTitle}</Text>
              <Text style={[styles.cell, styles.cellTime]}>{formatTimeForDocument({ timeText: entry.timeText, timeMs: entry.timeMs })}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

function buildFirstPrizeTemplateDocument({
  athlete,
  entries,
  templateDataUri
}: {
  athlete: Athlete;
  entries: CertificatePdfEntry[];
  templateDataUri: string;
}): ReactElement {
  const visibleEntries = entries.slice(0, 5);
  const eventLines = visibleEntries.map((entry) => entry.eventTitle).join("\n");
  const timeLines = visibleEntries
    .map((entry) => formatTimeForDocument({ timeText: entry.timeText, timeMs: entry.timeMs }))
    .join("\n");
  const nameKana = athlete.fullNameKana?.trim() || athlete.fullName;

  return (
    <Document>
      <Page size="A4" style={styles.templatePage}>
        <Image style={styles.templateBackground} src={templateDataUri} />
        <Text style={styles.prizeNameKana}>{nameKana}</Text>
        <Text style={styles.prizeName}>{athlete.fullName}</Text>
        <Text style={styles.prizeMeta}>{`${athlete.grade}年 / ${genderLabel(athlete.gender)}`}</Text>
        <Text style={styles.prizeEvent}>{eventLines}</Text>
        <Text style={styles.prizeTime}>{timeLines}</Text>
      </Page>
    </Document>
  );
}

function buildFirstPrizeFallbackDocument({
  athlete,
  entries
}: {
  athlete: Athlete;
  entries: CertificatePdfEntry[];
}): ReactElement {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>賞状</Text>
        <Text style={styles.meta}>ふりがな: {athlete.fullNameKana || athlete.fullName}</Text>
        <Text style={styles.meta}>氏名: {athlete.fullName}</Text>
        <Text style={styles.meta}>
          学年: {athlete.grade}年 / 性別: {genderLabel(athlete.gender)}
        </Text>

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.cell, styles.cellEvent, styles.headerCell]}>種目</Text>
            <Text style={[styles.cell, styles.cellTime, styles.headerCell]}>記録</Text>
          </View>
          {entries.map((entry, index) => (
            <View key={`${entry.eventTitle}-${entry.timeText}-${index}`} style={index === entries.length - 1 ? [styles.row, styles.rowLast] : styles.row}>
              <Text style={[styles.cell, styles.cellEvent]}>{entry.eventTitle}</Text>
              <Text style={[styles.cell, styles.cellTime]}>{formatTimeForDocument({ timeText: entry.timeText, timeMs: entry.timeMs })}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export async function renderRecordPdf({
  athlete,
  entries
}: {
  athlete: Athlete;
  entries: RecordPdfEntry[];
}): Promise<Buffer> {
  const templateDataUri = getTemplateDataUri(RECORD_TEMPLATE_FILE);
  if (templateDataUri) {
    return renderPdfDocument(buildRecordTemplateDocument({ athlete, entries, templateDataUri }));
  }

  return renderPdfDocument(buildRecordFallbackDocument({ athlete, entries }));
}

export async function renderCertificatePdf({
  athlete,
  entries
}: {
  athlete: Athlete;
  entries: CertificatePdfEntry[];
}): Promise<Buffer> {
  const templateDataUri = getTemplateDataUri(FIRST_PRIZE_TEMPLATE_FILE);
  if (templateDataUri) {
    return renderPdfDocument(buildFirstPrizeTemplateDocument({ athlete, entries, templateDataUri }));
  }

  return renderPdfDocument(buildFirstPrizeFallbackDocument({ athlete, entries }));
}

export async function renderRankingPdf({
  periodLabel,
  groups
}: {
  periodLabel: string;
  groups: RankingGroup[];
}): Promise<Buffer> {
  return renderPdfDocument(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{periodLabel} ランキング</Text>
        {groups.length === 0 ? (
          <Text style={styles.empty}>ランキング対象（1〜3位）のデータがありません。</Text>
        ) : (
          groups.map((group) => (
            <View key={group.eventId} style={styles.rankingGroup} wrap={false}>
              <Text style={styles.rankingGroupTitle}>
                {group.eventTitle} / {group.grade}年 / {genderLabel(group.gender)}
              </Text>
              <View style={styles.table}>
                <View style={styles.row}>
                  <Text style={[styles.cell, styles.cellRank, styles.headerCell]}>順位</Text>
                  <Text style={[styles.cell, styles.cellEvent, styles.headerCell]}>氏名</Text>
                  <Text style={[styles.cell, styles.cellTime, styles.headerCell]}>記録</Text>
                </View>
                {group.entries.map((entry, index) => (
                  <View
                    key={`${group.eventId}-${entry.fullName}-${index}`}
                    style={index === group.entries.length - 1 ? [styles.row, styles.rowLast] : styles.row}
                  >
                    <Text style={[styles.cell, styles.cellRank]}>{entry.rank}位</Text>
                    <Text style={[styles.cell, styles.cellEvent]}>{entry.fullName}</Text>
                    <Text style={[styles.cell, styles.cellTime]}>{entry.timeText}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </Page>
    </Document>
  );
}
