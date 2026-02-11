import fs from "node:fs";
import path from "node:path";
import { Athlete, Event, Meet, Result } from "@prisma/client";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { RankingGroup } from "./ranking-report";

const FONT_FAMILY = "NotoSansJP";
const NOTO_SANS_JP_FONT_URL = "https://fonts.gstatic.com/ea/notosansjapanese/v6/NotoSansJP-Regular.otf";
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const RECORD_TEMPLATE_FILE = "record-certificate.png";
const FIRST_PRIZE_TEMPLATE_FILE = "first-prize-certificate.png";
const TEMPLATE_DIRECTORY = path.join(process.cwd(), "public", "pdf-templates");

const templateCache = new Map<string, string | null>();
let fontRegistered = false;

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

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
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

function buildRecordLines(results: Array<Result & { event: Event }>) {
  const visibleResults = results.slice(0, 6);
  const eventLines = visibleResults.map((result) => result.event.title);
  const timeLines = visibleResults.map((result) => `${result.timeText} (${result.rank}位)`);

  if (results.length > visibleResults.length) {
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
  recordMeetTitle: {
    position: "absolute",
    top: 76,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 24
  },
  recordNameValue: {
    position: "absolute",
    top: 250,
    left: 120,
    width: 260,
    fontSize: 30
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
  recordFooter: {
    position: "absolute",
    top: 740,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 16
  },
  prizeName: {
    position: "absolute",
    top: 360,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 54
  },
  prizeEvent: {
    position: "absolute",
    top: 448,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 32
  },
  prizeTime: {
    position: "absolute",
    top: 504,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 30
  },
  prizeMeta: {
    position: "absolute",
    top: 696,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 20,
    lineHeight: 1.5
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
  meet,
  results,
  templateDataUri
}: {
  athlete: Athlete;
  meet: Meet;
  results: Array<Result & { event: Event }>;
  templateDataUri: string;
}): ReactElement {
  const lines = buildRecordLines(results);

  return (
    <Document>
      <Page size="A4" style={styles.templatePage}>
        <Image style={styles.templateBackground} src={templateDataUri} />
        <Text style={styles.recordMeetTitle}>{meet.title}</Text>
        <Text style={styles.recordNameValue}>{athlete.fullName}</Text>
        <Text style={styles.recordGradeValue}>{athlete.grade}年</Text>
        <Text style={styles.recordEventValue}>{lines.events}</Text>
        <Text style={styles.recordTimeValue}>{lines.times}</Text>
        <Text style={styles.recordFooter}>
          {`開催日 ${formatDate(meet.heldOn)}\nはまだスイミングスクール`}
        </Text>
      </Page>
    </Document>
  );
}

function buildRecordFallbackDocument({
  athlete,
  meet,
  results
}: {
  athlete: Athlete;
  meet: Meet;
  results: Array<Result & { event: Event }>;
}): ReactElement {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{meet.title} 記録証</Text>
        <Text style={styles.meta}>氏名: {athlete.fullName}</Text>
        <Text style={styles.meta}>
          学年: {athlete.grade}年 / 性別: {genderLabel(athlete.gender)}
        </Text>
        <Text style={styles.meta}>開催日: {formatDate(meet.heldOn)}</Text>

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.cell, styles.cellEvent, styles.headerCell]}>種目</Text>
            <Text style={[styles.cell, styles.cellTime, styles.headerCell]}>記録</Text>
            <Text style={[styles.cell, styles.cellRank, styles.headerCell]}>順位</Text>
          </View>
          {results.map((result, index) => (
            <View key={`${result.id}-${index}`} style={index === results.length - 1 ? [styles.row, styles.rowLast] : styles.row}>
              <Text style={[styles.cell, styles.cellEvent]}>{result.event.title}</Text>
              <Text style={[styles.cell, styles.cellTime]}>{result.timeText}</Text>
              <Text style={[styles.cell, styles.cellRank]}>{result.rank}位</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

function buildFirstPrizeTemplateDocument({
  athlete,
  meet,
  result,
  templateDataUri
}: {
  athlete: Athlete;
  meet: Meet;
  result: Result & { event: Event };
  templateDataUri: string;
}): ReactElement {
  return (
    <Document>
      <Page size="A4" style={styles.templatePage}>
        <Image style={styles.templateBackground} src={templateDataUri} />
        <Text style={styles.prizeName}>{athlete.fullName}</Text>
        <Text style={styles.prizeEvent}>{result.event.title}</Text>
        <Text style={styles.prizeTime}>記録 {result.timeText}</Text>
        <Text style={styles.prizeMeta}>
          {`${meet.title}\n開催日 ${formatDate(meet.heldOn)}\nはまだスイミングスクール`}
        </Text>
      </Page>
    </Document>
  );
}

function buildFirstPrizeFallbackDocument({
  athlete,
  meet,
  result
}: {
  athlete: Athlete;
  meet: Meet;
  result: Result & { event: Event };
}): ReactElement {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>賞状</Text>
        <Text style={styles.meta}>{meet.title}</Text>
        <Text style={styles.meta}>{result.event.title}</Text>
        <Text style={styles.meta}>{result.rank}位</Text>
        <Text style={styles.meta}>{athlete.fullName} 様</Text>
        <Text style={styles.meta}>記録: {result.timeText}</Text>
      </Page>
    </Document>
  );
}

export async function renderRecordPdf({
  athlete,
  meet,
  results
}: {
  athlete: Athlete;
  meet: Meet;
  results: Array<Result & { event: Event }>;
}): Promise<Buffer> {
  const templateDataUri = getTemplateDataUri(RECORD_TEMPLATE_FILE);
  if (templateDataUri) {
    return renderPdfDocument(buildRecordTemplateDocument({ athlete, meet, results, templateDataUri }));
  }

  return renderPdfDocument(buildRecordFallbackDocument({ athlete, meet, results }));
}

export async function renderCertificatePdf({
  athlete,
  meet,
  result
}: {
  athlete: Athlete;
  meet: Meet;
  result: Result & { event: Event };
}): Promise<Buffer> {
  const templateDataUri = getTemplateDataUri(FIRST_PRIZE_TEMPLATE_FILE);
  if (templateDataUri) {
    return renderPdfDocument(buildFirstPrizeTemplateDocument({ athlete, meet, result, templateDataUri }));
  }

  return renderPdfDocument(buildFirstPrizeFallbackDocument({ athlete, meet, result }));
}

export async function renderRankingPdf({
  meet,
  groups
}: {
  meet: Meet;
  groups: RankingGroup[];
}): Promise<Buffer> {
  return renderPdfDocument(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{meet.title} ランキング</Text>
        <Text style={styles.meta}>開催日: {formatDate(meet.heldOn)}</Text>
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
