import React, { type ReactNode } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { describe, expect, it, vi } from "vitest";

const rendererState = vi.hoisted(() => ({
  document: null as React.ReactElement<DocumentProps> | null
}));

vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>();

  return {
    ...actual,
    renderToBuffer: async (document: React.ReactElement<DocumentProps>) => {
      rendererState.document = document;
      return actual.renderToBuffer(document);
    }
  };
});

import { renderChallengeRankingPdf } from "../lib/pdf";
import { RANKING_OUTPUT_GRADE_SEQUENCE } from "../lib/grade";
import type { ChallengeEventRankingGroup, RankingEntry } from "../lib/ranking-report";

function entry(rank: number, fullName: string): RankingEntry {
  return {
    rank,
    fullName,
    displayName: fullName,
    timeText: `20.${String(rank).padStart(2, "0")}`
  };
}

function collectText(node: ReactNode): string[] {
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectText);
  }

  if (React.isValidElement<{ children?: ReactNode }>(node)) {
    return collectText(node.props.children);
  }

  return [];
}

function pageCount(buffer: Buffer): number {
  const pdf = buffer.toString("latin1");
  expect(pdf.startsWith("%PDF-")).toBe(true);
  return [...pdf.matchAll(/\/Type\s*\/Page\b/g)].length;
}

describe("challenge PDF all-ranks document", () => {
  it("draws every long-name entry and preserves tied ranks without blank rank rows", async () => {
    const largeMaleField = Array.from({ length: 48 }, (_, index) =>
      entry(index < 2 ? 1 : index + 1, `${String(index + 1).padStart(2, "0")}${"長".repeat(78)}`)
    );
    const tiedFemaleField = [
      entry(1, "女子同率首位 一郎"),
      entry(1, "女子同率首位 二郎"),
      entry(3, "女子3位")
    ];
    const group: ChallengeEventRankingGroup = {
      eventTitle: "15m板キック",
      gradeGroups: RANKING_OUTPUT_GRADE_SEQUENCE.map((grade) => ({
        grade,
        maleEntries: grade === RANKING_OUTPUT_GRADE_SEQUENCE[0] ? largeMaleField : [],
        femaleEntries: grade === RANKING_OUTPUT_GRADE_SEQUENCE[1] ? tiedFemaleField : []
      }))
    };

    const buffer = await renderChallengeRankingPdf({
      periodLabel: "2026年9月 チャレンジコース",
      groups: [group],
      rankRange: "all"
    });

    const textNodes = collectText(rendererState.document);
    const text = textNodes.join("\n");
    for (const expected of [...largeMaleField, ...tiedFemaleField]) {
      expect(textNodes.map((node) => node.replace(/\n/g, ""))).toContain(expected.fullName);
      expect(text).toContain(`${expected.rank}位`);
    }
    expect(textNodes).not.toContain("2位");
    expect(pageCount(buffer)).toBeGreaterThan(1);
  });
});
