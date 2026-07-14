import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderRecordCertificatePdf,
  renderRecordCertificatesPdf,
  renderRecordPdf,
  renderSchoolRecordCertificatesPdf
} from "../lib/pdf";

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

function collectElementsByType(root: unknown, type: string): any[] {
  const elements: any[] = [];

  walkNode(root, (value) => {
    if (value.type === type) {
      elements.push(value);
    }
  });

  return elements;
}

function findFirstElementByType(root: unknown, type: string): any | null {
  return collectElementsByType(root, type)[0] ?? null;
}

function collectRecordRowViews(root: unknown): any[] {
  return collectElementsByType(root, "View").filter((element) => {
    const style = flattenStyle(element.props?.style);
    return style.flexDirection === "row" && style.borderTopWidth === 1 && style.borderTopColor === "#cfe8fb" && style.height === 42;
  });
}

function collectRecordDecorDots(root: unknown): any[] {
  return collectElementsByType(root, "View").filter((element) => {
    const style = flattenStyle(element.props?.style);
    return style.top === 18 && style.width === 5 && style.height === 5 && style.backgroundColor === "#facc15";
  });
}

function findRecordHeaderBand(root: unknown): any | null {
  return collectElementsByType(root, "View").find((element) => {
    const style = flattenStyle(element.props?.style);
    return style.borderTopLeftRadius === 18 && style.borderTopRightRadius === 18 && style.alignItems === "center";
  }) ?? null;
}

describe("record PDF layout", () => {
  beforeEach(() => {
    mockState.lastDocument = null;
  });

  it("renders swimming records in exactly four fixed rows", async () => {
    await renderRecordCertificatePdf({
      athlete: {
        fullName: "窪園 彩希",
        fullNameKana: "くぼその さき",
        grade: 8,
        gender: "female"
      },
      entries: [
        { eventTitle: "15mクロール", timeText: "12.96" },
        { eventTitle: "30mクロール", timeText: "28.46" }
      ],
      issueLabel: "2025年9月"
    });

    const root = mockState.lastDocument as any;
    expect(root).toBeTruthy();
    expect(root.type).toBe("Document");
    const rowViews = collectRecordRowViews(root);
    expect(rowViews).toHaveLength(4);
    expect(collectTextNodes(rowViews[0]).join("")).toContain("15mクロール");
    expect(collectTextNodes(rowViews[1]).join("")).toContain("30mクロール");
    expect(collectTextNodes(rowViews[2]).join("").trim()).toBe("");
    expect(collectTextNodes(rowViews[3]).join("").trim()).toBe("");

    const texts = collectTextNodes(root).join("\n");
    expect(texts).toContain("はまだスイミングスクール記録会");
    expect(texts).toContain("記録証");
    expect(texts).not.toContain("一般コース");
    expect(texts).not.toContain("ふりがな");
    expect(texts).not.toContain("氏名");
    expect(texts).toContain("学年");
    expect(texts).toContain("今回の記録");
    expect(texts).toContain("種目");
    expect(texts).toContain("記録");
    expect(texts).toContain("発行年月 2025年9月");
    expect(texts).toContain("窪園 彩希");
    expect(texts).toContain("くぼその さき");
    expect(texts).toContain("12秒96");
    expect(texts).toContain("28秒46");
    expect(texts).not.toContain("※ ");
    expect(collectNodeTypes(root)).not.toContain("Image");

    const pageElement = findFirstElementByType(root, "Page");
    expect(pageElement).toBeTruthy();
    expect(flattenStyle(pageElement.props.style).backgroundColor).toBe("#ffffff");

    const headerBand = findRecordHeaderBand(root);
    expect(headerBand).toBeTruthy();
    expect(flattenStyle(headerBand.props.style).backgroundColor).toBe("#ffffff");

    expect(collectRecordDecorDots(root)).toHaveLength(0);
  });

  it("renders the school encouragement message without referring to next year", async () => {
    await renderRecordPdf({
      athlete: {
        fullName: "窪園 彩希",
        fullNameKana: "くぼその さき",
        grade: 8,
        gender: "female"
      },
      entries: [{ eventTitle: "15mクロール", timeText: "12.96" }],
      issueLabel: "2026年7月"
    });

    const root = mockState.lastDocument as any;
    const rowViews = collectRecordRowViews(root);
    expect(rowViews).toHaveLength(4);
    expect(collectTextNodes(rowViews[0]).join("")).toContain("15mクロール");
    expect(collectTextNodes(rowViews[1]).join("").trim()).toBe("");
    expect(collectTextNodes(rowViews[2]).join("").trim()).toBe("");
    expect(collectTextNodes(rowViews[3]).join("").trim()).toBe("");

    const texts = collectTextNodes(root).join("\n");
    expect(texts).not.toContain("学校委託コース");
    expect(texts).toContain("水泳学習");
    expect(texts).toContain("よくがんばりました。");
    expect(texts).toContain("開催年月 2026年7月");
    expect(texts).not.toContain("来年");
    expect(texts).toContain("12秒96");
    expect(texts).not.toContain("発行年月");
  });

  it("uses a table-free school design for an absentee", async () => {
    await renderRecordPdf({
      athlete: {
        fullName: "山田 太郎",
        fullNameKana: "やまだ たろう",
        grade: 5,
        gender: "male"
      },
      entries: [{ eventTitle: "", timeText: "a", timeMs: -1 }],
      issueLabel: "2026年7月"
    });

    const texts = collectTextNodes(mockState.lastDocument).join("\n");
    expect(collectRecordRowViews(mockState.lastDocument)).toHaveLength(0);
    expect(texts).not.toContain("今回の記録");
    expect(texts).not.toContain("種目");
    expect(texts).not.toContain("記録\n");
    expect(texts).not.toContain("欠席");
    expect(texts).not.toContain("\na\n");
    expect(texts).toContain("水泳学習");
    expect(texts).toContain("よくがんばりました。");
    expect(texts).toContain("開催年月 2026年7月");
    expect(texts).not.toContain("来年");
  });

  it("combines all children from one school into one multi-page PDF", async () => {
    await renderSchoolRecordCertificatesPdf([
      {
        athlete: { fullName: "児童 一", grade: 5, gender: "male" },
        entries: [{ eventTitle: "けのび", timeText: "30.00" }],
        issueLabel: "2026年7月"
      },
      {
        athlete: { fullName: "児童 二", grade: 6, gender: "female" },
        entries: [{ eventTitle: "", timeText: "a", timeMs: -1 }],
        issueLabel: "2026年7月"
      }
    ]);

    expect(collectElementsByType(mockState.lastDocument, "Page")).toHaveLength(2);
    const texts = collectTextNodes(mockState.lastDocument).join("\n");
    expect(texts).toContain("児童 一");
    expect(texts).toContain("児童 二");
  });

  it("continues school records on another page instead of dropping a fifth event", async () => {
    await renderRecordPdf({
      athlete: {
        fullName: "五種目 太郎",
        fullNameKana: "ごしゅもく たろう",
        grade: 6,
        gender: "male"
      },
      entries: Array.from({ length: 5 }, (_, index) => ({
        eventTitle: `${index + 1}種目`,
        timeText: `${index + 10}.00`
      })),
      issueLabel: "2026年7月"
    });

    const root = mockState.lastDocument as any;
    expect(collectElementsByType(root, "Page")).toHaveLength(2);
    expect(collectRecordRowViews(root)).toHaveLength(8);
    expect(collectTextNodes(root).join("\n")).toContain("5種目");
  });

  it("keeps a long free-form school event name and reduces its font size", async () => {
    const longEventTitle = "先生が入力したとても長いけのびとバタ足のチャレンジ種目名";

    await renderRecordPdf({
      athlete: {
        fullName: "自由入力 太郎",
        fullNameKana: "じゆうにゅうりょく たろう",
        grade: 5,
        gender: "male"
      },
      entries: [{ eventTitle: longEventTitle, timeText: "45.00" }],
      issueLabel: "2026年7月"
    });

    const eventElement = findTextElement(mockState.lastDocument, (text) => text === longEventTitle);
    expect(eventElement).toBeTruthy();
    expect(flattenStyle(eventElement.props.style).fontSize).toBe(8);
  });

  it("renders four filled rows and silently truncates a fifth entry", async () => {
    await renderRecordCertificatePdf({
      athlete: {
        fullName: "窪園 彩希",
        fullNameKana: "くぼその さき",
        grade: 8,
        gender: "female"
      },
      entries: Array.from({ length: 5 }, (_, index) => ({
        eventTitle: `${index + 1}種目`,
        timeText: `${index + 10}.00`
      })),
      issueLabel: "2025年9月"
    });

    const root = mockState.lastDocument as any;
    const rowViews = collectRecordRowViews(root);
    expect(rowViews).toHaveLength(4);
    expect(rowViews.every((row) => collectTextNodes(row).join("").trim().length > 0)).toBe(true);

    const texts = collectTextNodes(root).join("\n");
    expect(texts).toContain("1種目");
    expect(texts).toContain("4種目");
    expect(texts).toContain("3種目");
    expect(texts).toContain("10秒00");
    expect(texts).toContain("13秒00");
    expect(texts).toContain("12秒00");
    expect(texts).not.toContain("5種目");
    expect(texts).not.toContain("※ ");
  });

  it("reduces the name font size for very long names", async () => {
    const longName = "浜水記録会 とても長い名前の児童";

    await renderRecordCertificatePdf({
      athlete: {
        fullName: longName,
        fullNameKana: "はますいきろくかい とてもながいなまえのじどう",
        grade: 8,
        gender: "female"
      },
      entries: [{ eventTitle: "15mクロール", timeText: "12.96" }],
      issueLabel: "2025年9月"
    });

    const root = mockState.lastDocument as any;
    const nameElement = findTextElement(root, (text) => text.includes(longName));
    expect(nameElement).toBeTruthy();
    expect(flattenStyle(nameElement.props.style).fontSize).toBe(18);
  });

  it("renders multiple record certificates into a single multi-page document", async () => {
    await renderRecordCertificatesPdf([
      {
        athlete: {
          fullName: "窪園 彩希",
          fullNameKana: "くぼその さき",
          grade: 8,
          gender: "female"
        },
        entries: [{ eventTitle: "15mクロール", timeText: "12.96" }],
        issueLabel: "2025年9月"
      },
      {
        athlete: {
          fullName: "横手 翔太朗",
          fullNameKana: "よこて しょうたろう",
          grade: 9,
          gender: "male"
        },
        entries: [{ eventTitle: "30mクロール", timeText: "29.49" }],
        issueLabel: "2025年9月"
      }
    ]);

    const root = mockState.lastDocument as any;
    expect(root).toBeTruthy();
    expect(root.type).toBe("Document");
    expect(collectElementsByType(root, "Page")).toHaveLength(2);

    const texts = collectTextNodes(root).join("\n");
    expect(texts).toContain("窪園 彩希");
    expect(texts).toContain("横手 翔太朗");
    expect(texts).toContain("12秒96");
    expect(texts).toContain("29秒49");
  });
});
