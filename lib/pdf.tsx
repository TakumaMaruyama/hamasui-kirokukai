import fs from "node:fs";
import path from "node:path";
import { Gender } from "@prisma/client";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { ChallengeEventRankingGroup, RankingEntry, RankingGroup } from "./ranking-report";
import { buildChallengeRankingTableRows, type ChallengeRankingTableRow } from "./challenge-ranking-layout";
import { formatTimeForDocument } from "./display-time";
import { formatGradeLabel, formatGradeShortLabel } from "./grade";
import { paginateRankingGroups } from "./ranking-pagination";

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

export type FirstPrizeAwardPdfInput = {
  athlete: PdfAthlete;
  eventTitle: string;
  timeText: string;
  timeMs?: number;
  issueLabel: string;
};

export type RecordCertificatePdfInput = {
  athlete: PdfAthlete;
  entries: RecordPdfEntry[];
  issueLabel: string;
};

type PdfAthlete = {
  fullName: string;
  fullNameKana?: string | null;
  grade: number;
  gender: Gender;
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
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 6,
    padding: 8
  },
  rankingGroupTitle: {
    fontSize: 13,
    marginBottom: 6
  },
  challengeEventSection: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#252933",
    borderRadius: 8,
    padding: 10
  },
  challengeEventTitle: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 8
  },
  challengeGradeSection: {
    marginTop: 8
  },
  challengeGradeColumns: {
    flexDirection: "row"
  },
  challengeGenderTable: {
    width: "50%",
    borderWidth: 1,
    borderColor: "#252933"
  },
  challengeGenderTableLeft: {
    marginRight: 4
  },
  challengeGenderTableRight: {
    marginLeft: 4
  },
  challengeTableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#252933"
  },
  challengeTableRowLast: {
    borderBottomWidth: 0
  },
  challengeCell: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 10
  },
  challengeCellRank: {
    width: "17%",
    textAlign: "center"
  },
  challengeCellName: {
    width: "50%"
  },
  challengeCellTime: {
    width: "33%",
    textAlign: "center"
  },
  challengeHeaderText: {
    fontSize: 10,
    fontWeight: 700
  },
  challengeLegend: {
    marginBottom: 8,
    fontSize: 10,
    color: "#555555"
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
  recordGradeLabelValue: {
    position: "absolute",
    top: 250,
    left: 330,
    width: 190,
    textAlign: "left",
    fontSize: 20
  },
  recordIssueLabelValue: {
    position: "absolute",
    top: 700,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 18
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
  },
  prizeAwardMeta: {
    position: "absolute",
    top: 470,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 22
  },
  prizeAwardEvent: {
    position: "absolute",
    top: 530,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 26
  },
  prizeAwardTime: {
    position: "absolute",
    top: 590,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 24
  },
  prizeIssueLabel: {
    position: "absolute",
    top: 700,
    left: 0,
    width: A4_WIDTH,
    textAlign: "center",
    fontSize: 18
  }
});

function rankingPalette(gender: Gender): { border: string; header: string; title: string } {
  if (gender === "male") {
    return {
      border: "#7aa9ff",
      header: "#eaf2ff",
      title: "#1f4fa7"
    };
  }

  if (gender === "female") {
    return {
      border: "#f2a8c6",
      header: "#ffeff6",
      title: "#b23870"
    };
  }

  return {
    border: "#c3c7d4",
    header: "#f5f6fa",
    title: "#4d5564"
  };
}

function challengeHeaderPalette(side: "male" | "female"): { background: string; text: string } {
  if (side === "male") {
    return {
      background: "#b9ddf0",
      text: "#103c5d"
    };
  }

  return {
    background: "#f1c9d2",
    text: "#6b2738"
  };
}

function buildChallengeGradeLabel(grade: number): string {
  return formatGradeShortLabel(grade);
}

function formatChallengeEntryName(entry: RankingEntry | null): string {
  if (!entry) {
    return "";
  }

  const name = entry.displayName || entry.fullName;
  if (entry.isNewRecordInTargetMonth) {
    return `★${name}`;
  }

  return name;
}

function buildChallengeGenderTable({
  side,
  gradeLabel,
  entries,
  keyPrefix,
  tableStyle
}: {
  side: "male" | "female";
  gradeLabel: string;
  entries: ChallengeRankingTableRow[];
  keyPrefix: string;
  tableStyle: any;
}): ReactElement {
  const palette = challengeHeaderPalette(side);

  return (
    <View style={[styles.challengeGenderTable, tableStyle]}>
      <View style={[styles.challengeTableRow, { backgroundColor: palette.background }]}>
        <Text style={[styles.challengeCell, styles.challengeCellRank, styles.challengeHeaderText, { color: palette.text }]}>{gradeLabel}</Text>
        <Text style={[styles.challengeCell, styles.challengeCellName, styles.challengeHeaderText, { color: palette.text }]}>氏名</Text>
        <Text style={[styles.challengeCell, styles.challengeCellTime, styles.challengeHeaderText, { color: palette.text }]}>タイム</Text>
      </View>
      {entries.map((entry, index) => (
        <View
          key={`${keyPrefix}-${index}`}
          style={index === entries.length - 1 ? [styles.challengeTableRow, styles.challengeTableRowLast] : styles.challengeTableRow}
        >
          <Text style={[styles.challengeCell, styles.challengeCellRank]}>{entry.rankLabel}</Text>
          <Text style={[styles.challengeCell, styles.challengeCellName]}>{formatChallengeEntryName(entry.entry)}</Text>
          <Text style={[styles.challengeCell, styles.challengeCellTime]}>
            {entry.entry ? formatTimeForDocument({ timeText: entry.entry.timeText }) : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}

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
  athlete: PdfAthlete;
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
        <Text style={styles.recordGradeValue}>{formatGradeShortLabel(athlete.grade)}</Text>
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
  athlete: PdfAthlete;
  entries: RecordPdfEntry[];
}): ReactElement {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>記録証</Text>
        <Text style={styles.meta}>ふりがな: {athlete.fullNameKana || athlete.fullName}</Text>
        <Text style={styles.meta}>氏名: {athlete.fullName}</Text>
        <Text style={styles.meta}>学年: {formatGradeLabel(athlete.grade)}</Text>

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

function buildRecordCertificateTemplateDocument({
  athlete,
  entries,
  issueLabel,
  templateDataUri
}: RecordCertificatePdfInput & { templateDataUri: string }): ReactElement {
  const lines = buildRecordLines(entries);
  const nameKana = athlete.fullNameKana?.trim() || athlete.fullName;

  return (
    <Document>
      <Page size="A4" style={styles.templatePage}>
        <Image style={styles.templateBackground} src={templateDataUri} />
        <Text style={styles.recordNameKanaValue}>{nameKana}</Text>
        <Text style={styles.recordNameValue}>{athlete.fullName}</Text>
        <Text style={styles.recordGradeLabelValue}>{formatGradeLabel(athlete.grade)}</Text>
        <Text style={styles.recordEventValue}>{lines.events}</Text>
        <Text style={styles.recordTimeValue}>{lines.times}</Text>
        <Text style={styles.recordIssueLabelValue}>{issueLabel}</Text>
      </Page>
    </Document>
  );
}

function buildRecordCertificateFallbackDocument({
  athlete,
  entries,
  issueLabel
}: RecordCertificatePdfInput): ReactElement {
  const nameKana = athlete.fullNameKana?.trim() || athlete.fullName;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>記録証</Text>
        <Text style={styles.meta}>ふりがな: {nameKana}</Text>
        <Text style={styles.meta}>氏名: {athlete.fullName}</Text>
        <Text style={styles.meta}>学年: {formatGradeLabel(athlete.grade)}</Text>
        <Text style={styles.meta}>年月: {issueLabel}</Text>
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.cell, styles.cellEvent, styles.headerCell]}>種目</Text>
            <Text style={[styles.cell, styles.cellTime, styles.headerCell]}>記録</Text>
          </View>
          {entries.map((entry, index) => (
            <View
              key={`${entry.eventTitle}-${entry.timeText}-${index}`}
              style={index === entries.length - 1 ? [styles.row, styles.rowLast] : styles.row}
            >
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
  athlete: PdfAthlete;
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
        <Text style={styles.prizeMeta}>{`${formatGradeLabel(athlete.grade)} / ${genderLabel(athlete.gender)}`}</Text>
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
  athlete: PdfAthlete;
  entries: CertificatePdfEntry[];
}): ReactElement {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>賞状</Text>
        <Text style={styles.meta}>ふりがな: {athlete.fullNameKana || athlete.fullName}</Text>
        <Text style={styles.meta}>氏名: {athlete.fullName}</Text>
        <Text style={styles.meta}>
          学年: {formatGradeLabel(athlete.grade)} / 性別: {genderLabel(athlete.gender)}
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

function buildFirstPrizeAwardTemplateDocument({
  athlete,
  eventTitle,
  timeText,
  timeMs,
  issueLabel,
  templateDataUri
}: FirstPrizeAwardPdfInput & { templateDataUri: string }): ReactElement {
  return (
    <Document>
      <Page size="A4" style={styles.templatePage}>
        <Image style={styles.templateBackground} src={templateDataUri} />
        <Text style={styles.prizeNameKana}>{athlete.fullNameKana?.trim() || athlete.fullName}</Text>
        <Text style={styles.prizeName}>{athlete.fullName}</Text>
        <Text style={styles.prizeAwardMeta}>{`${formatGradeLabel(athlete.grade)} ${genderLabel(athlete.gender)}`}</Text>
        <Text style={styles.prizeAwardEvent}>{eventTitle}</Text>
        <Text style={styles.prizeAwardTime}>記録 {formatTimeForDocument({ timeText, timeMs })}</Text>
        <Text style={styles.prizeIssueLabel}>{issueLabel}</Text>
      </Page>
    </Document>
  );
}

function buildFirstPrizeAwardFallbackDocument({
  athlete,
  eventTitle,
  timeText,
  timeMs,
  issueLabel
}: FirstPrizeAwardPdfInput): ReactElement {
  const nameKana = athlete.fullNameKana?.trim() || athlete.fullName;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>第1位 賞状</Text>
        <Text style={styles.meta}>ふりがな: {nameKana}</Text>
        <Text style={styles.meta}>氏名: {athlete.fullName}</Text>
        <Text style={styles.meta}>
          学年・性別: {formatGradeLabel(athlete.grade)} {genderLabel(athlete.gender)}
        </Text>
        <Text style={styles.meta}>種目: {eventTitle}</Text>
        <Text style={styles.meta}>記録: {formatTimeForDocument({ timeText, timeMs })}</Text>
        <Text style={styles.meta}>発行年月: {issueLabel}</Text>
      </Page>
    </Document>
  );
}

export async function renderRecordPdf({
  athlete,
  entries
}: {
  athlete: PdfAthlete;
  entries: RecordPdfEntry[];
}): Promise<Buffer> {
  const templateDataUri = getTemplateDataUri(RECORD_TEMPLATE_FILE);
  if (templateDataUri) {
    return renderPdfDocument(buildRecordTemplateDocument({ athlete, entries, templateDataUri }));
  }

  return renderPdfDocument(buildRecordFallbackDocument({ athlete, entries }));
}

export async function renderRecordCertificatePdf(input: RecordCertificatePdfInput): Promise<Buffer> {
  const templateDataUri = getTemplateDataUri(RECORD_TEMPLATE_FILE);
  if (templateDataUri) {
    return renderPdfDocument(buildRecordCertificateTemplateDocument({ ...input, templateDataUri }));
  }

  return renderPdfDocument(buildRecordCertificateFallbackDocument(input));
}

export async function renderCertificatePdf({
  athlete,
  entries
}: {
  athlete: PdfAthlete;
  entries: CertificatePdfEntry[];
}): Promise<Buffer> {
  const templateDataUri = getTemplateDataUri(FIRST_PRIZE_TEMPLATE_FILE);
  if (templateDataUri) {
    return renderPdfDocument(buildFirstPrizeTemplateDocument({ athlete, entries, templateDataUri }));
  }

  return renderPdfDocument(buildFirstPrizeFallbackDocument({ athlete, entries }));
}

export async function renderFirstPrizeAwardPdf(input: FirstPrizeAwardPdfInput): Promise<Buffer> {
  const templateDataUri = getTemplateDataUri(FIRST_PRIZE_TEMPLATE_FILE);
  if (templateDataUri) {
    return renderPdfDocument(buildFirstPrizeAwardTemplateDocument({ ...input, templateDataUri }));
  }

  return renderPdfDocument(buildFirstPrizeAwardFallbackDocument(input));
}

export async function renderRankingPdf({
  periodLabel,
  groups
}: {
  periodLabel: string;
  groups: RankingGroup[];
}): Promise<Buffer> {
  const pages = paginateRankingGroups(groups);

  return renderPdfDocument(
    <Document>
      {groups.length === 0 ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>{periodLabel} ランキング</Text>
          <Text style={styles.empty}>ランキング対象データがありません。</Text>
        </Page>
      ) : (
        pages.map((page, pageIndex) => (
          <Page key={`${periodLabel}-${pageIndex}`} size="A4" style={styles.page}>
            <Text style={styles.title}>
              {periodLabel} ランキング
              {pages.length > 1 ? ` (${pageIndex + 1}/${pages.length})` : ""}
            </Text>
            {page.blocks.map((block) => {
              const palette = rankingPalette(block.gender);
              const continuationLabel =
                block.chunkCount > 1 ? `（続き ${block.chunkIndex}/${block.chunkCount}）` : "";

              return (
                <View
                  key={`${block.eventId}-${block.chunkIndex}`}
                  style={[styles.rankingGroup, { borderColor: palette.border }]}
                  wrap={false}
                >
                  <Text style={[styles.rankingGroupTitle, { color: palette.title }]}>
                    {block.eventTitle} / {formatGradeLabel(block.grade)} / {genderLabel(block.gender)}
                    {continuationLabel}
                  </Text>
                  <View style={[styles.table, { borderColor: palette.border }]}>
                    <View style={[styles.row, { borderColor: palette.border }]}>
                      <Text style={[styles.cell, styles.cellRank, styles.headerCell, { backgroundColor: palette.header }]}>順位</Text>
                      <Text style={[styles.cell, styles.cellEvent, styles.headerCell, { backgroundColor: palette.header }]}>氏名</Text>
                      <Text style={[styles.cell, styles.cellTime, styles.headerCell, { backgroundColor: palette.header }]}>記録</Text>
                    </View>
                    {block.entries.map((entry, index) => (
                      <View
                        key={`${block.eventId}-${block.chunkIndex}-${entry.fullName}-${index}`}
                        style={
                          index === block.entries.length - 1
                            ? [styles.row, { borderColor: palette.border }, styles.rowLast]
                            : [styles.row, { borderColor: palette.border }]
                        }
                      >
                        <Text style={[styles.cell, styles.cellRank]}>{entry.rank}位</Text>
                        <Text style={[styles.cell, styles.cellEvent]}>{entry.displayName || entry.fullName}</Text>
                        <Text style={[styles.cell, styles.cellTime]}>{entry.timeText}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </Page>
        ))
      )}
    </Document>
  );
}

export async function renderChallengeRankingPdf({
  periodLabel,
  groups,
  highlightLegend,
  rankRange
}: {
  periodLabel: string;
  groups: ChallengeEventRankingGroup[];
  highlightLegend?: string;
  rankRange?: { min: number; max: number };
}): Promise<Buffer> {
  const minRank = Math.max(1, Math.floor(rankRange?.min ?? 1));
  const maxRank = Math.max(minRank, Math.floor(rankRange?.max ?? 3));

  return renderPdfDocument(
    <Document>
      {groups.length === 0 ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>{periodLabel} ランキング</Text>
          <Text style={styles.empty}>ランキング対象データがありません。</Text>
        </Page>
      ) : (
        groups.map((eventGroup, index) => (
          <Page key={`${periodLabel}-${eventGroup.eventTitle}-${index}`} size="A4" style={styles.page}>
            <Text style={styles.title}>
              {periodLabel} ランキング
              {groups.length > 1 ? ` (${index + 1}/${groups.length})` : ""}
            </Text>
            {highlightLegend ? <Text style={styles.challengeLegend}>{highlightLegend}</Text> : null}
            <View key={eventGroup.eventTitle} style={styles.challengeEventSection}>
              <Text style={styles.challengeEventTitle}>{eventGroup.eventTitle}</Text>
              {eventGroup.gradeGroups.map((gradeGroup) => {
                const maleRows = buildChallengeRankingTableRows(gradeGroup.maleEntries, { minRank, maxRank });
                const femaleRows = buildChallengeRankingTableRows(gradeGroup.femaleEntries, { minRank, maxRank });
                const gradeLabel = buildChallengeGradeLabel(gradeGroup.grade);

                return (
                  <View key={`${eventGroup.eventTitle}-${gradeGroup.grade}`} style={styles.challengeGradeSection} wrap={false}>
                    <View style={styles.challengeGradeColumns}>
                      {buildChallengeGenderTable({
                        side: "male",
                        gradeLabel,
                        entries: maleRows,
                        keyPrefix: `${eventGroup.eventTitle}-${gradeGroup.grade}-male`,
                        tableStyle: styles.challengeGenderTableLeft
                      })}
                      {buildChallengeGenderTable({
                        side: "female",
                        gradeLabel,
                        entries: femaleRows,
                        keyPrefix: `${eventGroup.eventTitle}-${gradeGroup.grade}-female`,
                        tableStyle: styles.challengeGenderTableRight
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          </Page>
        ))
      )}
    </Document>
  );
}
