import fs from "node:fs";
import path from "node:path";
import { Gender } from "@prisma/client";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import React, { type ReactElement } from "react";
import sharp from "sharp";
import type { ChallengeEventRankingGroup, RankingEntry, RankingGroup } from "./ranking-report";
import { buildChallengeRankingTableRows, type ChallengeRankingTableRow } from "./challenge-ranking-layout";
import { formatTimeForDocument } from "./display-time";
import { formatGradeLabel, formatGradeShortLabel } from "./grade";
import { paginateRankingGroups } from "./ranking-pagination";

const FONT_FAMILY = "NotoSansJP";
const NOTO_SANS_JP_FONT_URL = "https://fonts.gstatic.com/ea/notosansjapanese/v6/NotoSansJP-Regular.otf";
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const A5_WIDTH = 419.53;
const A5_HEIGHT = 595.28;
const CERTIFICATE_PAGE_SIZE = "A5";
const FIRST_PRIZE_TEMPLATE_NAME = "first-prize-certificate";
const TEMPLATE_DIRECTORY = path.join(process.cwd(), "public", "pdf-templates");
const TEMPLATE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;
const TEMPLATE_RECOMMENDED_WIDTH = 1748;
const TEMPLATE_RECOMMENDED_HEIGHT = 2480;
const TEMPLATE_EMBED_WIDTH = 1240;
const TEMPLATE_EMBED_HEIGHT = 1754;
const TEMPLATE_DIRECT_FILE_BYTES_LIMIT = 350 * 1024;
const TEMPLATE_JPEG_QUALITY = 82;
const MAX_RECORD_TABLE_ROWS = 3;

const templateCache = new Map<string, { dataUri: string; filePath: string; mtimeMs: number }>();
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

type RecordLayoutVariant = "swimming" | "school";

type RecordTableRow = {
  kind: "filled";
  entry: RecordPdfEntry;
} | {
  kind: "empty";
};

type RecordDisplayModel = {
  tableRows: RecordTableRow[];
  footerText: string;
  headerSubtitle: string | null;
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

function buildDataUri(mimeType: string, buffer: Buffer): string {
  const base64 = buffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

function resolveTemplatePath(templateName: string): string | null {
  for (const extension of TEMPLATE_EXTENSIONS) {
    const filePath = path.join(TEMPLATE_DIRECTORY, `${templateName}${extension}`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

async function buildOptimizedTemplateDataUri(filePath: string): Promise<string> {
  const originalBuffer = fs.readFileSync(filePath);
  const mimeType = getMimeType(filePath);

  const metadata = await sharp(originalBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const shouldOptimize = mimeType === "image/webp"
    || originalBuffer.byteLength > TEMPLATE_DIRECT_FILE_BYTES_LIMIT
    || width > TEMPLATE_RECOMMENDED_WIDTH
    || height > TEMPLATE_RECOMMENDED_HEIGHT;

  if (!shouldOptimize) {
    return buildDataUri(mimeType, originalBuffer);
  }

  const optimizedBuffer = await sharp(originalBuffer)
    .rotate()
    .resize({
      width: TEMPLATE_EMBED_WIDTH,
      height: TEMPLATE_EMBED_HEIGHT,
      fit: "inside",
      withoutEnlargement: true
    })
    .flatten({ background: "#ffffff" })
    .jpeg({
      quality: TEMPLATE_JPEG_QUALITY,
      mozjpeg: true,
      chromaSubsampling: "4:4:4"
    })
    .toBuffer();

  return buildDataUri("image/jpeg", optimizedBuffer);
}

async function getTemplateDataUri(templateName: string): Promise<string | null> {
  const filePath = resolveTemplatePath(templateName);
  if (!filePath) {
    templateCache.delete(templateName);
    return null;
  }

  const mtimeMs = fs.statSync(filePath).mtimeMs;
  const cached = templateCache.get(templateName);
  if (cached && cached.filePath === filePath && cached.mtimeMs === mtimeMs) {
    return cached.dataUri;
  }

  try {
    const dataUri = await buildOptimizedTemplateDataUri(filePath);
    templateCache.set(templateName, { dataUri, filePath, mtimeMs });
    return dataUri;
  } catch (error) {
    templateCache.delete(templateName);
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to load PDF template ${path.basename(filePath)}: ${message}`);
    return null;
  }
}

function buildRecordDisplayModel({
  variant,
  entries,
  issueLabel
}: {
  variant: RecordLayoutVariant;
  entries: RecordPdfEntry[];
  issueLabel?: string;
}): RecordDisplayModel {
  const tableRows: RecordTableRow[] = entries
    .slice(0, MAX_RECORD_TABLE_ROWS)
    .map((entry) => ({
      kind: "filled",
      entry
    }));

  while (tableRows.length < MAX_RECORD_TABLE_ROWS) {
    tableRows.push({ kind: "empty" });
  }

  return {
    tableRows,
    footerText: variant === "swimming" && issueLabel ? `発行年月 ${issueLabel}` : "学校委託コース記録証",
    headerSubtitle: variant === "swimming" ? null : "学校委託コース"
  };
}

function resolveRecordNameFontSize(fullName: string): 24 | 21 | 18 {
  const normalizedLength = fullName.replace(/\s+/g, "").length;

  if (normalizedLength >= 14) {
    return 18;
  }

  if (normalizedLength >= 10) {
    return 21;
  }

  return 24;
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
  challengeTableRowNewRecord: {
    backgroundColor: "#fff7d6"
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
  challengeCellNameWithNew: {
    lineHeight: 1.3
  },
  challengeCellTime: {
    width: "33%",
    textAlign: "center"
  },
  challengeCellTimeWithMonth: {
    lineHeight: 1.3
  },
  challengeHeaderText: {
    fontSize: 10,
    fontWeight: 700
  },
  challengeLegend: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: 700,
    color: "#4a2f00",
    backgroundColor: "#fff2b3",
    borderWidth: 1,
    borderColor: "#e2b400",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    textAlign: "center"
  },
  challengeLegendNew: {
    color: "#d10000"
  },
  challengeNewMarker: {
    color: "#d10000",
    fontSize: 8,
    fontWeight: 700
  },
  challengeRecordMonthLabel: {
    color: "#6b7280",
    fontSize: 8
  },
  empty: {
    marginTop: 24,
    textAlign: "center",
    color: "#666666"
  },
  templatePage: {
    position: "relative",
    width: A5_WIDTH,
    height: A5_HEIGHT,
    fontFamily: FONT_FAMILY
  },
  templateBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    width: A5_WIDTH,
    height: A5_HEIGHT
  },
  templateFlowSpacer: {
    width: 1,
    height: A5_HEIGHT
  },
  recordPage: {
    position: "relative",
    width: A5_WIDTH,
    height: A5_HEIGHT,
    fontFamily: FONT_FAMILY,
    backgroundColor: "#ffffff",
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 30
  },
  recordCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#3b82d6",
    borderRadius: 20
  },
  recordHeaderBand: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomWidth: 1.5,
    borderBottomColor: "#cfe8fb",
    paddingTop: 16,
    paddingBottom: 18,
    paddingHorizontal: 20,
    alignItems: "center"
  },
  recordHeaderPill: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#8cc7f2",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 16,
    marginBottom: 8
  },
  recordHeaderEyebrow: {
    fontSize: 10,
    fontWeight: 700,
    color: "#2470aa",
    letterSpacing: 0
  },
  recordHeaderTitle: {
    fontSize: 25,
    fontWeight: 700,
    color: "#12385b",
    marginBottom: 3
  },
  recordHeaderSubtitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#456886"
  },
  recordBody: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 18,
    paddingHorizontal: 22
  },
  recordInfoRow: {
    flexDirection: "row",
    marginBottom: 16
  },
  recordInfoNameCard: {
    flex: 1,
    marginRight: 12,
    backgroundColor: "#f4fbff",
    borderWidth: 1.5,
    borderColor: "#8cc7f2",
    borderRadius: 14,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 14
  },
  recordInfoGradeCard: {
    width: 106,
    backgroundColor: "#f4fbff",
    borderWidth: 1.5,
    borderColor: "#8cc7f2",
    borderRadius: 14,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  recordInfoLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: "#456886",
    marginBottom: 4
  },
  recordInfoKanaValue: {
    fontSize: 9,
    color: "#35546f",
    lineHeight: 1.35,
    marginBottom: 8
  },
  recordInfoNameValue: {
    fontWeight: 700,
    color: "#12385b",
    lineHeight: 1.15
  },
  recordInfoGradeValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "#12385b",
    textAlign: "center",
    lineHeight: 1.2
  },
  recordTableSectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#12385b",
    marginBottom: 8
  },
  recordTableWrap: {
    backgroundColor: "#8cc7f2",
    borderRadius: 12,
    padding: 1.5,
    overflow: "hidden"
  },
  recordTableHeader: {
    flexDirection: "row",
    backgroundColor: "#4aa7e8",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10
  },
  recordTableHeaderCell: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 11,
    fontWeight: 700,
    color: "#ffffff"
  },
  recordTableHeaderEvent: {
    width: "62%"
  },
  recordTableHeaderTime: {
    width: "38%",
    textAlign: "right"
  },
  recordTableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#cfe8fb",
    height: 42
  },
  recordTableRowLast: {
    borderBottomWidth: 1,
    borderBottomColor: "#8cc7f2"
  },
  recordTableCell: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    justifyContent: "center"
  },
  recordTableCellEvent: {
    width: "62%",
    borderRightWidth: 1,
    borderRightColor: "#cfe8fb"
  },
  recordTableCellTime: {
    width: "38%"
  },
  recordTableEventText: {
    fontSize: 12,
    color: "#12385b",
    lineHeight: 1.35
  },
  recordTableTimeText: {
    fontSize: 12,
    fontWeight: 700,
    color: "#12385b",
    textAlign: "right"
  },
  recordTableNote: {
    marginTop: 8,
    fontSize: 9,
    color: "#456886"
  },
  recordFooterSpacer: {
    flexGrow: 1
  },
  recordFooterPill: {
    alignSelf: "center",
    backgroundColor: "#e6f4ff",
    borderWidth: 1,
    borderColor: "#8cc7f2",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 16,
    marginTop: 14
  },
  recordFooterText: {
    fontSize: 11,
    fontWeight: 700,
    color: "#12385b",
    textAlign: "center"
  },
  prizeName: {
    position: "absolute",
    top: 258,
    left: 0,
    width: A5_WIDTH,
    textAlign: "center",
    fontSize: 38
  },
  prizeNameKana: {
    position: "absolute",
    top: 239,
    left: 0,
    width: A5_WIDTH,
    textAlign: "center",
    fontSize: 14
  },
  prizeEvent: {
    position: "absolute",
    top: 345,
    left: 0,
    width: A5_WIDTH,
    textAlign: "center",
    fontSize: 22,
    lineHeight: 1.32
  },
  prizeTime: {
    position: "absolute",
    top: 407,
    left: 0,
    width: A5_WIDTH,
    textAlign: "center",
    fontSize: 20,
    lineHeight: 1.32
  },
  prizeMeta: {
    position: "absolute",
    top: 314,
    left: 0,
    width: A5_WIDTH,
    textAlign: "center",
    fontSize: 16
  },
  prizeAwardMeta: {
    position: "absolute",
    top: 314,
    left: 0,
    width: A5_WIDTH,
    textAlign: "center",
    fontSize: 16
  },
  prizeAwardEvent: {
    position: "absolute",
    top: 368,
    left: 0,
    width: A5_WIDTH,
    textAlign: "center",
    fontSize: 20
  },
  prizeAwardTime: {
    position: "absolute",
    top: 420,
    left: 0,
    width: A5_WIDTH,
    textAlign: "center",
    fontSize: 18
  },
  prizeIssueLabel: {
    position: "absolute",
    top: 503,
    left: 0,
    width: A5_WIDTH,
    textAlign: "center",
    fontSize: 14
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

  return entry.displayName || entry.fullName;
}

function renderChallengeLegendText(legend: string): ReactElement {
  const marker = "NEW";
  const markerIndex = legend.indexOf(marker);

  if (markerIndex < 0) {
    return <Text style={styles.challengeLegend}>{legend}</Text>;
  }

  const before = legend.slice(0, markerIndex);
  const after = legend.slice(markerIndex + marker.length);

  return (
    <Text style={styles.challengeLegend}>
      {before}
      <Text style={styles.challengeLegendNew}>{marker}</Text>
      {after}
    </Text>
  );
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
  const hasRecordMonth = entries.some((row) => Boolean(row.entry?.recordMonthLabel));

  return (
    <View style={[styles.challengeGenderTable, tableStyle]}>
      <View style={[styles.challengeTableRow, { backgroundColor: palette.background }]}>
        <Text style={[styles.challengeCell, styles.challengeCellRank, styles.challengeHeaderText, { color: palette.text }]}>{gradeLabel}</Text>
        <Text style={[styles.challengeCell, styles.challengeCellName, styles.challengeHeaderText, { color: palette.text }]}>氏名</Text>
        <Text style={[styles.challengeCell, styles.challengeCellTime, styles.challengeHeaderText, { color: palette.text }]}>
          {hasRecordMonth ? "タイム・年月" : "タイム"}
        </Text>
      </View>
      {entries.map((entry, index) => (
        <View
          key={`${keyPrefix}-${index}`}
          style={[
            styles.challengeTableRow,
            ...(index === entries.length - 1 ? [styles.challengeTableRowLast] : []),
            ...(entry.entry?.isNewRecordInTargetMonth ? [styles.challengeTableRowNewRecord] : [])
          ]}
        >
          <Text style={[styles.challengeCell, styles.challengeCellRank]}>{entry.rankLabel}</Text>
          <Text
            style={
              entry.entry?.isNewRecordInTargetMonth
                ? [styles.challengeCell, styles.challengeCellName, styles.challengeCellNameWithNew]
                : [styles.challengeCell, styles.challengeCellName]
            }
          >
            {formatChallengeEntryName(entry.entry)}
            {entry.entry?.isNewRecordInTargetMonth ? <Text style={styles.challengeNewMarker}>{"\n"}NEW</Text> : null}
          </Text>
          <Text style={hasRecordMonth ? [styles.challengeCell, styles.challengeCellTime, styles.challengeCellTimeWithMonth] : [styles.challengeCell, styles.challengeCellTime]}>
            {entry.entry ? formatTimeForDocument({ timeText: entry.entry.timeText }) : ""}
            {entry.entry?.recordMonthLabel ? <Text style={styles.challengeRecordMonthLabel}>{"\n"}{entry.entry.recordMonthLabel}</Text> : null}
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

function buildReadableRecordDocument({
  variant,
  athlete,
  entries,
  issueLabel
}: {
  variant: RecordLayoutVariant;
  athlete: PdfAthlete;
  entries: RecordPdfEntry[];
  issueLabel?: string;
}): ReactElement {
  const nameKana = athlete.fullNameKana?.trim() || athlete.fullName;
  const nameFontSize = resolveRecordNameFontSize(athlete.fullName);
  const display = buildRecordDisplayModel({ variant, entries, issueLabel });

  return (
    <Document>
      <Page size={CERTIFICATE_PAGE_SIZE} style={styles.recordPage} wrap={false}>
        <View style={styles.recordCard}>
          <View style={styles.recordHeaderBand}>
            <View style={styles.recordHeaderPill}>
              <Text style={styles.recordHeaderEyebrow}>はまスイ記録会</Text>
            </View>
            <Text style={styles.recordHeaderTitle}>記録証</Text>
            {display.headerSubtitle ? <Text style={styles.recordHeaderSubtitle}>{display.headerSubtitle}</Text> : null}
          </View>

          <View style={styles.recordBody}>
            <View style={styles.recordInfoRow}>
              <View style={styles.recordInfoNameCard}>
                <Text style={styles.recordInfoKanaValue}>{nameKana}</Text>
                <Text style={[styles.recordInfoNameValue, { fontSize: nameFontSize }]}>{athlete.fullName}</Text>
              </View>

              <View style={styles.recordInfoGradeCard}>
                <Text style={styles.recordInfoLabel}>学年</Text>
                <Text style={styles.recordInfoGradeValue}>{formatGradeLabel(athlete.grade)}</Text>
              </View>
            </View>

            <Text style={styles.recordTableSectionTitle}>今回の記録</Text>
            <View style={styles.recordTableWrap}>
              <View style={styles.recordTableHeader}>
                <Text style={[styles.recordTableHeaderCell, styles.recordTableHeaderEvent]}>種目</Text>
                <Text style={[styles.recordTableHeaderCell, styles.recordTableHeaderTime]}>記録</Text>
              </View>

              {display.tableRows.map((row, index) => (
                <View
                  key={row.kind === "filled" ? `${row.entry.eventTitle}-${row.entry.timeText}-${index}` : `empty-row-${index}`}
                  style={[
                    styles.recordTableRow,
                    ...(index === display.tableRows.length - 1 ? [styles.recordTableRowLast] : []),
                    { backgroundColor: index % 2 === 0 ? "#ffffff" : "#f4fbff" }
                  ]}
                >
                  <View style={[styles.recordTableCell, styles.recordTableCellEvent]}>
                    <Text style={styles.recordTableEventText}>{row.kind === "filled" ? row.entry.eventTitle : ""}</Text>
                  </View>
                  <View style={[styles.recordTableCell, styles.recordTableCellTime]}>
                    <Text style={styles.recordTableTimeText}>
                      {row.kind === "filled"
                        ? formatTimeForDocument({ timeText: row.entry.timeText, timeMs: row.entry.timeMs })
                        : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.recordFooterSpacer} />
            <View style={styles.recordFooterPill}>
              <Text style={styles.recordFooterText}>{display.footerText}</Text>
            </View>
          </View>
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
      <Page size={CERTIFICATE_PAGE_SIZE} style={styles.templatePage} wrap={false}>
        <View style={styles.templateFlowSpacer} />
        <Image fixed style={styles.templateBackground} src={templateDataUri} />
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
      <Page size={CERTIFICATE_PAGE_SIZE} style={styles.page} wrap={false}>
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
      <Page size={CERTIFICATE_PAGE_SIZE} style={styles.templatePage} wrap={false}>
        <View style={styles.templateFlowSpacer} />
        <Image fixed style={styles.templateBackground} src={templateDataUri} />
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
      <Page size={CERTIFICATE_PAGE_SIZE} style={styles.page} wrap={false}>
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
  return renderPdfDocument(buildReadableRecordDocument({ variant: "school", athlete, entries }));
}

export async function renderRecordCertificatePdf(input: RecordCertificatePdfInput): Promise<Buffer> {
  return renderPdfDocument(buildReadableRecordDocument({ variant: "swimming", ...input }));
}

export async function renderCertificatePdf({
  athlete,
  entries
}: {
  athlete: PdfAthlete;
  entries: CertificatePdfEntry[];
}): Promise<Buffer> {
  const templateDataUri = await getTemplateDataUri(FIRST_PRIZE_TEMPLATE_NAME);
  if (templateDataUri) {
    return renderPdfDocument(buildFirstPrizeTemplateDocument({ athlete, entries, templateDataUri }));
  }

  return renderPdfDocument(buildFirstPrizeFallbackDocument({ athlete, entries }));
}

export async function renderFirstPrizeAwardPdf(input: FirstPrizeAwardPdfInput): Promise<Buffer> {
  const templateDataUri = await getTemplateDataUri(FIRST_PRIZE_TEMPLATE_NAME);
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
            {highlightLegend ? renderChallengeLegendText(highlightLegend) : null}
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
