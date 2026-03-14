import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeMeetComparisonSummary } from "../lib/home-meet-summary";

const mockState = vi.hoisted(() => ({
  publishWindow: null as {
    publishFrom: Date | null;
    publishUntil: Date | null;
    announcement: string | null;
  } | null,
  summary: null as HomeMeetComparisonSummary | null
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
  getHomeMeetComparisonSummary: vi.fn(async () => mockState.summary)
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
    mockState.summary = null;
  });

  it("renders one latest-vs-previous summary and does not show chained previous cards", async () => {
    mockState.summary = {
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
      totalImprovementMs: 300,
      comparedEntryCount: 4,
      improvedEntryCount: 1,
      improvedChildCount: 1
    };

    const root = await HomePage();
    const texts = collectTextNodes(root).join("\n");
    const compactText = texts.replace(/\s+/g, "");

    expect(texts).toContain("みんなの前回比");
    expect(texts).toContain("今回");
    expect(texts).toContain("前回");
    expect(texts).not.toContain("1つ前");
    expect(texts).toContain("2026年3月");
    expect(texts).toContain("2025年9月");
    expect(compactText).not.toContain("回分");
    expect(texts).toContain("比較対象");
    expect(texts).toContain("更新した記録");
    expect(texts).toContain("更新した子");

    const meetPanels = collectElementsByClassName(root, "home-progress-meet");
    expect(meetPanels).toHaveLength(2);
    expect(collectElementsByClassName(root, "home-progress-card")).toHaveLength(1);
  });
});
