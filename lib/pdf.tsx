import { Athlete, Event, Meet, Result } from "@prisma/client";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { RankingGroup } from "./ranking-report";

const FONT_FAMILY = "NotoSansJP";
const NOTO_SANS_JP_FONT_URL = "https://fonts.gstatic.com/ea/notosansjapanese/v6/NotoSansJP-Regular.otf";

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
  certificatePage: {
    fontFamily: FONT_FAMILY,
    padding: 60,
    textAlign: "center"
  },
  certificateTitle: {
    fontSize: 36,
    marginBottom: 36
  },
  certificateLine: {
    fontSize: 16,
    marginBottom: 12
  },
  certificateName: {
    fontSize: 26,
    marginVertical: 20
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

export async function renderRecordPdf({
  athlete,
  meet,
  results
}: {
  athlete: Athlete;
  meet: Meet;
  results: Array<Result & { event: Event }>;
}): Promise<Buffer> {
  return renderPdfDocument(
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

export async function renderCertificatePdf({
  athlete,
  meet,
  result
}: {
  athlete: Athlete;
  meet: Meet;
  result: Result & { event: Event };
}): Promise<Buffer> {
  return renderPdfDocument(
    <Document>
      <Page size="A4" style={styles.certificatePage}>
        <Text style={styles.certificateTitle}>賞状</Text>
        <Text style={styles.certificateLine}>{meet.title}</Text>
        <Text style={styles.certificateLine}>{result.event.title}</Text>
        <Text style={styles.certificateLine}>{result.rank}位</Text>
        <Text style={styles.certificateName}>{athlete.fullName} 様</Text>
        <Text style={styles.certificateLine}>記録: {result.timeText}</Text>
      </Page>
    </Document>
  );
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
