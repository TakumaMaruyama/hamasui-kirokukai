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
});
