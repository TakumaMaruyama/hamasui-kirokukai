import React, { type ReactNode } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { describe, expect, it, vi } from "vitest";

type LayoutNode = {
  style?: { flexDirection?: string; borderLeftWidth?: number; borderRightWidth?: number; borderTopWidth?: number; borderBottomWidth?: number };
  box?: { top: number; left: number; width: number; height: number };
  children?: LayoutNode[];
};

const rendererState = vi.hoisted(() => ({
  document: null as React.ReactElement<DocumentProps> | null,
  layout: null as LayoutNode | null
}));

vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>();

  return {
    ...actual,
    renderToBuffer: async (document: React.ReactElement<DocumentProps>) => {
      rendererState.document = document;
      return actual.renderToBuffer(React.cloneElement(document, {
        onRender: (props: unknown) => {
          // Capture the real renderer's computed boxes, including text wrapping.
          rendererState.layout = (props as { _INTERNAL__LAYOUT__DATA_: LayoutNode })._INTERNAL__LAYOUT__DATA_;
        }
      }));
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

function expectAlignedBorders() {
  let pairedTables = 0;
  const walk = (node: LayoutNode) => {
    const children = node.children ?? [];
    if (node.style?.flexDirection === "row" && children.length === 2 && children.every(
      (child) => child.style?.borderLeftWidth === 1 && child.style?.borderRightWidth === 1
    )) {
      pairedTables += 1;
      const borders = children.map((table) => {
        const top = table.box!.top;
        const positions = [top + table.box!.height];
        if (table.style?.borderTopWidth) positions.push(top);
        for (const row of table.children ?? []) {
          if (row.style?.borderBottomWidth) positions.push(top + row.box!.top + row.box!.height);
        }
        return positions.sort((a, b) => a - b);
      });
      expect(borders[0]).toHaveLength(borders[1].length);
      borders[0].forEach((position, i) => expect(position).toBeCloseTo(borders[1][i], 3));
    }
    children.forEach(walk);
  };
  expect(rendererState.layout).not.toBeNull();
  walk(rendererState.layout!);
  expect(pairedTables).toBeGreaterThan(0);
}

describe("challenge PDF all-ranks document", () => {
  it("draws matching borders for 3 vs 0, 1 vs 3, and 5 vs 2 participants", async () => {
    const counts = [[3, 0], [1, 3], [5, 2], [0, 0]];
    await renderChallengeRankingPdf({
      periodLabel: "2026年9月 チャレンジコース", rankRange: "all",
      groups: [{ eventTitle: "15mクロール", gradeGroups: counts.map(([male, female], i) => ({
        grade: 9 + i,
        maleEntries: Array.from({ length: male }, (_, j) => entry(j + 1, `男子${i}-${j}`)),
        femaleEntries: Array.from({ length: female }, (_, j) => entry(j + 1, `女子${i}-${j}`))
      })) }]
    });
    expectAlignedBorders();
    const names = collectText(rendererState.document);
    expect(names.filter((text) => /^(男子|女子)\d-\d$/.test(text))).toHaveLength(14);
    // Padding adds rules, never fictitious ranks or participants.
    expect(names.filter((text) => /^\d位$/.test(text))).toHaveLength(14);
  });

  it("keeps matching borders when long names alternate sides across continuation pages", async () => {
    const maleEntries = Array.from({ length: 13 }, (_, i) => entry(i + 1, `男${i}${i % 2 === 0 ? "長".repeat(78) : "短"}`));
    const femaleEntries = Array.from({ length: 4 }, (_, i) => entry(i < 2 ? 1 : i, `女${i}${i % 2 ? "長".repeat(78) : "短"}`));
    const buffer = await renderChallengeRankingPdf({
      periodLabel: "2026年9月 チャレンジコース", rankRange: "all",
      groups: [{ eventTitle: "15mクロール", gradeGroups: [{ grade: 9, maleEntries, femaleEntries }] }]
    });
    expectAlignedBorders();
    expect(pageCount(buffer)).toBeGreaterThan(1);
    const text = collectText(rendererState.document).map((value) => value.replace(/\n/g, ""));
    for (const row of [...maleEntries, ...femaleEntries]) expect(text).toContain(row.fullName);
  });

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
