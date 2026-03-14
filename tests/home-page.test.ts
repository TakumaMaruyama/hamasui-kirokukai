import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeMeetComparisonCard } from "../lib/home-meet-summary";

const mockState = vi.hoisted(() => ({
  publishWindow: null as {
    publishFrom: Date | null;
    publishUntil: Date | null;
    announcement: string | null;
  } | null,
  cards: null as HomeMeetComparisonCard[] | null
}));

vi.mock("next/link", () => ({
  default: (props: any) => React.createElement("a", props, props.children)
}));

vi.mock("../app/search-form", () => ({
  default: () => React.createElement("div", null, "Mock SearchForm")
}));

vi.mock("@/lib/display-time", () => ({
  formatImprovementTotal: (value: number) => `${value}ms`
}));

vi.mock("@/lib/publish", () => ({
  formatPublishRange: () => "公開期限は未設定です"
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    publishWindow: {
      findUnique: vi.fn(async () => mockState.publishWindow)
    }
  }
}));

vi.mock("@/lib/home-meet-summary", () => ({
  getHomeMeetComparisonCards: vi.fn(async () => mockState.cards)
}));

import HomePage from "../app/page";

function walkNode(node: unknown, visitor: (value: any) => void) {
  if (node === null || typeof node === "undefined" || typeof node === "boolean") {
    return;
  }

  if (typeof node === "string" || typeof node === "number") {
    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      walkNode(child, visitor);
    }
    return;
  }

  if (typeof node === "object" && "props" in (node as any)) {
    visitor(node);
    walkNode((node as any).props?.children, visitor);
  }
}

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

function collectElementsByClassName(root: unknown, className: string): any[] {
  const elements: any[] = [];

  walkNode(root, (value) => {
    const classes = String(value.props?.className ?? "")
      .split(/\s+/)
      .filter(Boolean);

    if (classes.includes(className)) {
      elements.push(value);
    }
  });

  return elements;
}

describe("HomePage", () => {
  beforeEach(() => {
    mockState.publishWindow = null;
    mockState.cards = null;
  });

  it("renders two ready month comparison cards", async () => {
    mockState.cards = [
      {
        slotLabel: "今回",
        state: "ready",
        currentMeet: {
          id: "current",
          title: "2026年3月",
          heldOn: new Date("2026-03-08T00:00:00.000Z"),
          participantCount: 12,
          resultCount: 24
        },
        previousMeet: {
          id: "previous",
          title: "2025年9月",
          heldOn: new Date("2025-09-30T00:00:00.000Z"),
          participantCount: 10,
          resultCount: 20
        },
        totalImprovementMs: 13_000
      },
      {
        slotLabel: "前回の前回比",
        state: "ready",
        currentMeet: {
          id: "previous",
          title: "2025年9月",
          heldOn: new Date("2025-09-30T00:00:00.000Z"),
          participantCount: 10,
          resultCount: 20
        },
        previousMeet: {
          id: "older",
          title: "2025年7月",
          heldOn: new Date("2025-07-31T00:00:00.000Z"),
          participantCount: 8,
          resultCount: 14
        },
        totalImprovementMs: 2_400
      }
    ];

    const root = await HomePage();
    const texts = collectTextNodes(root).join("\n");
    const compactText = texts.replace(/\s+/g, "");

    expect(texts).toContain("みんなの前回比");
    expect(texts).toContain("今回");
    expect(texts).toContain("前回の前回比");
    expect(texts).toContain("2026年3月");
    expect(texts).toContain("2025年9月");
    expect(texts).toContain("2025年7月");
    expect(compactText).toContain("みんなで前より13000msタイムアップ");
    expect(compactText).toContain("みんなで前より2400msタイムアップ");
    expect(compactText).toContain("24記録");
    expect(compactText).toContain("20記録");
    expect(compactText).toContain("14記録");
    expect(compactText).not.toContain("12人");
    expect(compactText).not.toContain("10人");
    expect(compactText).not.toContain("8人");
    expect(texts).not.toContain("1つ前");
    expect(texts).not.toContain("2026年3月日曜");
    expect(texts).not.toContain("2026年3月土曜");
    expect(texts).not.toContain("今回の開催月と前回の開催月を、同じ子・同じ種目の月内ベストで比べています。");
    expect(texts).not.toContain("同じ子・同じ種目が両方の開催月にあるものだけを比較しています。");
    expect(compactText).not.toContain("回分");

    expect(collectElementsByClassName(root, "home-progress-card")).toHaveLength(2);
    expect(collectElementsByClassName(root, "home-progress-meet")).toHaveLength(4);
  });

  it("renders a waiting-older-month second card with the previous month filled in", async () => {
    mockState.cards = [
      {
        slotLabel: "今回",
        state: "ready",
        currentMeet: {
          id: "current",
          title: "2026年3月",
          heldOn: new Date("2026-03-08T00:00:00.000Z"),
          participantCount: 12,
          resultCount: 24
        },
        previousMeet: {
          id: "previous",
          title: "2025年9月",
          heldOn: new Date("2025-09-30T00:00:00.000Z"),
          participantCount: 10,
          resultCount: 20
        },
        totalImprovementMs: 13_000
      },
      {
        slotLabel: "前回の前回比",
        state: "waiting-older-month",
        currentMeet: {
          id: "previous",
          title: "2025年9月",
          heldOn: new Date("2025-09-30T00:00:00.000Z"),
          participantCount: 10,
          resultCount: 20
        },
        previousMeet: null,
        totalImprovementMs: 0
      }
    ];

    const root = await HomePage();
    const texts = collectTextNodes(root).join("\n");
    const compactText = texts.replace(/\s+/g, "");

    expect(texts).toContain("前回の前回比");
    expect(texts).toContain("さらに前の開催月が入ると表示");
    expect(texts).toContain("2025年9月");
    expect(texts).toContain("まだありません");
    expect(texts).toContain("前回の前回比を準備中");
    expect(compactText).toContain("20記録");
    expect(compactText).not.toContain("10人");
    expect(collectElementsByClassName(root, "home-progress-card")).toHaveLength(2);
    expect(collectElementsByClassName(root, "home-progress-meet")).toHaveLength(4);
  });

  it("renders waiting-next-meet and unavailable states without obsolete summary stats", async () => {
    mockState.cards = [
      {
        slotLabel: "今回",
        state: "waiting-next-meet",
        currentMeet: {
          id: "current",
          title: "2026年3月",
          heldOn: new Date("2026-03-08T00:00:00.000Z"),
          participantCount: 12,
          resultCount: 24
        },
        previousMeet: null,
        totalImprovementMs: 0
      },
      {
        slotLabel: "前回の前回比",
        state: "unavailable",
        currentMeet: null,
        previousMeet: null,
        totalImprovementMs: 0
      }
    ];

    const root = await HomePage();
    const texts = collectTextNodes(root).join("\n");
    const compactText = texts.replace(/\s+/g, "");

    expect(texts).toContain("次回から前回比を表示");
    expect(texts).toContain("さらに前の開催月が入ると表示");
    expect(texts).toContain("2026年3月");
    expect(texts).toContain("まだありません");
    expect(texts).toContain("次の開催月から比較できます");
    expect(compactText).toContain("24記録");
    expect(compactText).not.toContain("12人");
    expect(texts).not.toContain("比較対象");
    expect(texts).not.toContain("更新した記録");
    expect(texts).not.toContain("更新した子");
    expect(collectElementsByClassName(root, "home-progress-card")).toHaveLength(2);
    expect(collectElementsByClassName(root, "home-progress-meet")).toHaveLength(2);
  });
});
