import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChallengeEventRankingGroup } from "../lib/ranking-report";
import { renderChallengeRankingPdf } from "../lib/pdf";

const mockState = vi.hoisted(() => ({
  lastDocument: null as any
}));

vi.mock("@react-pdf/renderer", () => ({
  Document: "Document",
  Page: "Page",
  Text: "Text",
  View: "View",
  Image: "Image",
  Font: {
    register: vi.fn()
  },
  StyleSheet: {
    create: (styles: unknown) => styles
  },
  renderToBuffer: vi.fn(async (document: unknown) => {
    mockState.lastDocument = document;
    return Buffer.from("mock-pdf");
  })
}));

describe("renderChallengeRankingPdf historical layout", () => {
  function collectTextNodes(node: unknown): string[] {
    const texts: string[] = [];

    const walk = (value: unknown) => {
      if (value === null || typeof value === "undefined" || typeof value === "boolean") {
        return;
      }

      if (typeof value === "string" || typeof value === "number") {
        texts.push(String(value));
        return;
      }

      if (Array.isArray(value)) {
        for (const child of value) {
          walk(child);
        }
        return;
      }

      if (typeof value === "object" && "props" in (value as any)) {
        walk((value as any).props?.children);
      }
    };

    walk(node);
    return texts;
  }

  beforeEach(() => {
    mockState.lastDocument = null;
  });

  it("creates one page per event group", async () => {
    const groups: ChallengeEventRankingGroup[] = [
      {
        eventTitle: "15m板キック",
        gradeGroups: [
          {
            grade: 1,
            maleEntries: [],
            femaleEntries: []
          }
        ]
      },
      {
        eventTitle: "15mクロール",
        gradeGroups: [
          {
            grade: 1,
            maleEntries: [],
            femaleEntries: []
          }
        ]
      }
    ];

    await renderChallengeRankingPdf({
      periodLabel: "2025年9月 歴代1位記録一覧",
      groups,
      rankRange: { min: 1, max: 1 }
    });

    const root = mockState.lastDocument as any;
    expect(root).toBeTruthy();
    expect(root.type).toBe("Document");

    const pages = React.Children.toArray(root.props.children) as any[];
    expect(pages).toHaveLength(groups.length);
    expect(pages.every((page) => page.type === "Page")).toBe(true);
  });

  it("renders NEW marker, legend text, and record year-month", async () => {
    const groups: ChallengeEventRankingGroup[] = [
      {
        eventTitle: "15mクロール",
        gradeGroups: [
          {
            grade: 3,
            maleEntries: [
              {
                rank: 1,
                fullName: "新記録者",
                displayName: "新記録者",
                timeText: "18.00",
                isNewRecordInTargetMonth: true,
                recordMonthLabel: "2025年9月"
              }
            ],
            femaleEntries: []
          }
        ]
      }
    ];

    await renderChallengeRankingPdf({
      periodLabel: "2025年9月 歴代1位記録一覧",
      groups,
      highlightLegend: "[NEW] はこの月に新しく歴代1位になった記録（今月1件）",
      rankRange: { min: 1, max: 1 }
    });

    const root = mockState.lastDocument as any;
    const texts = collectTextNodes(root);

    expect(texts.some((text) => text.includes("[NEW] はこの月に新しく歴代1位になった記録（今月1件）"))).toBe(true);
    expect(texts.some((text) => text.includes("[NEW] 新記録者"))).toBe(true);
    expect(texts.some((text) => text.includes("タイム・年月"))).toBe(true);
    expect(texts.some((text) => text.includes("2025年9月"))).toBe(true);
  });
});
