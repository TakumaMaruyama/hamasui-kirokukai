import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RankingGroup } from "../lib/ranking-report";
import { renderRankingPdf } from "../lib/pdf";

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

describe("renderRankingPdf", () => {
  beforeEach(() => {
    mockState.lastDocument = null;
  });

  it("renders general-course titles and formats times in japanese document style", async () => {
    const groups: RankingGroup[] = [
      {
        eventId: "event-1",
        eventTitle: "25mクロール",
        grade: 5,
        gender: "male",
        entries: [
          {
            rank: 1,
            fullName: "最速 太郎",
            displayName: "最速 太郎",
            timeText: "18.00"
          },
          {
            rank: 2,
            fullName: "持久 花子",
            displayName: "持久 花子",
            timeText: "1:05.32"
          }
        ]
      }
    ];

    await renderRankingPdf({
      periodLabel: "2025年9月 一般コース",
      groups
    });

    const root = mockState.lastDocument as any;
    const textContent = collectTextNodes(root).join("");

    expect(textContent).toContain("2025年9月 一般コース ランキング");
    expect(textContent).toContain("18秒00");
    expect(textContent).toContain("1分5秒32");
  });
});
