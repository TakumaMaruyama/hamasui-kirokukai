import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderFirstPrizeAwardPdf } from "../lib/pdf";

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

function collectNodeTypes(node: unknown): string[] {
  const types: string[] = [];

  walkNode(node, (value) => {
    if (typeof value.type === "string") {
      types.push(value.type);
    }
  });

  return types;
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((accumulator, entry) => ({
      ...accumulator,
      ...flattenStyle(entry)
    }), {});
  }

  if (style && typeof style === "object") {
    return style as Record<string, unknown>;
  }

  return {};
}

function findTextElement(root: unknown, matcher: (text: string) => boolean): any | null {
  let found: any | null = null;

  walkNode(root, (value) => {
    if (found || value.type !== "Text") {
      return;
    }

    const text = collectTextNodes(value).join("");
    if (matcher(text)) {
      found = value;
    }
  });

  return found;
}

describe("first prize award PDF layout", () => {
  beforeEach(() => {
    mockState.lastDocument = null;
  });

  it("renders an image-backed award with all required fields", async () => {
    await renderFirstPrizeAwardPdf({
      athlete: {
        fullName: "徳重 湊仁",
        fullNameKana: "とくしげ みなと",
        grade: 4,
        gender: "male"
      },
      eventTitle: "15m板キック",
      timeText: "2分1秒77",
      timeMs: 121_770,
      issueLabel: "2026年2月"
    });

    const root = mockState.lastDocument as any;
    expect(root).toBeTruthy();
    expect(root.type).toBe("Document");
    expect(collectNodeTypes(root)).toContain("Image");

    const texts = collectTextNodes(root).join("");
    expect(texts).toContain("徳重 湊仁");
    expect(texts).toContain("とくしげ みなと");
    expect(texts).toContain("小学1年生 男子");
    expect(texts).toContain("15m板キック");
    expect(texts).toContain("記録 2分1秒77");
    expect(texts).toContain("2026年2月");
    expect(texts).toContain("はまだスイミングスクール");
  });

  it("reduces the name font size for moderately long names", async () => {
    const longName = "あいうえおかきくけ";

    await renderFirstPrizeAwardPdf({
      athlete: {
        fullName: longName,
        fullNameKana: "かな",
        grade: 5,
        gender: "female"
      },
      eventTitle: "15mクロール",
      timeText: "12.96",
      timeMs: 12_960,
      issueLabel: "2025年9月"
    });

    const root = mockState.lastDocument as any;
    const nameElement = findTextElement(root, (text) => text.includes(longName));
    expect(nameElement).toBeTruthy();
    expect(flattenStyle(nameElement.props.style).fontSize).toBe(32);
  });

  it("reduces the name font size further for very long names", async () => {
    const veryLongName = "あいうえおかきくけこさし";

    await renderFirstPrizeAwardPdf({
      athlete: {
        fullName: veryLongName,
        fullNameKana: "かな",
        grade: 6,
        gender: "male"
      },
      eventTitle: "30mクロール",
      timeText: "28.46",
      timeMs: 28_460,
      issueLabel: "2025年10月"
    });

    const root = mockState.lastDocument as any;
    const nameElement = findTextElement(root, (text) => text.includes(veryLongName));
    expect(nameElement).toBeTruthy();
    expect(flattenStyle(nameElement.props.style).fontSize).toBe(28);
  });

  it("reduces the event font size for long event titles", async () => {
    const longEventTitle = "とても長い種目名クロール大会";

    await renderFirstPrizeAwardPdf({
      athlete: {
        fullName: "窪園 彩希",
        fullNameKana: "くぼその さき",
        grade: 8,
        gender: "female"
      },
      eventTitle: longEventTitle,
      timeText: "28.46",
      timeMs: 28_460,
      issueLabel: "2025年11月"
    });

    const root = mockState.lastDocument as any;
    const eventElement = findTextElement(root, (text) => text.includes(longEventTitle));
    expect(eventElement).toBeTruthy();
    expect(flattenStyle(eventElement.props.style).fontSize).toBe(17);
    expect(flattenStyle(eventElement.props.style).lineHeight).toBe(1.3);
  });

  it("keeps the default larger font sizes for shorter name and event values", async () => {
    await renderFirstPrizeAwardPdf({
      athlete: {
        fullName: "横手 翔太朗",
        fullNameKana: "よこて しょうたろう",
        grade: 9,
        gender: "male"
      },
      eventTitle: "30mクロール",
      timeText: "29.49",
      timeMs: 29_490,
      issueLabel: "2025年9月"
    });

    const root = mockState.lastDocument as any;
    const nameElement = findTextElement(root, (text) => text.includes("横手 翔太朗"));
    const kanaElement = findTextElement(root, (text) => text.includes("よこて しょうたろう"));
    const metaElement = findTextElement(root, (text) => text.includes("小学6年生 男子"));
    const eventElement = findTextElement(root, (text) => text.includes("30mクロール"));
    const timeElement = findTextElement(root, (text) => text.includes("記録 29.49"));
    const issueElement = findTextElement(root, (text) => text.includes("2025年9月"));
    const issuerElement = findTextElement(root, (text) => text.includes("はまだスイミングスクール"));

    expect(nameElement).toBeTruthy();
    expect(kanaElement).toBeTruthy();
    expect(metaElement).toBeTruthy();
    expect(eventElement).toBeTruthy();
    expect(timeElement).toBeTruthy();
    expect(issueElement).toBeTruthy();
    expect(issuerElement).toBeTruthy();
    expect(flattenStyle(nameElement.props.style).fontSize).toBe(36);
    expect(flattenStyle(kanaElement.props.style).color).toBe("#111827");
    expect(flattenStyle(metaElement.props.style).fontSize).toBe(19);
    expect(flattenStyle(metaElement.props.style).color).toBe("#111827");
    expect(flattenStyle(metaElement.props.style).lineHeight).toBe(1.3);
    expect(flattenStyle(eventElement.props.style).fontSize).toBe(19);
    expect(flattenStyle(eventElement.props.style).color).toBe("#111827");
    expect(flattenStyle(eventElement.props.style).lineHeight).toBe(1.3);
    expect(flattenStyle(timeElement.props.style).fontSize).toBe(19);
    expect(flattenStyle(timeElement.props.style).color).toBe("#111827");
    expect(flattenStyle(timeElement.props.style).lineHeight).toBe(1.3);
    expect(flattenStyle(issueElement.props.style).fontSize).toBe(14);
    expect(flattenStyle(issueElement.props.style).color).toBe("#111827");
    expect(flattenStyle(issuerElement.props.style).fontSize).toBe(11);
    expect(flattenStyle(issuerElement.props.style).color).toBe("#111827");
  });
});
