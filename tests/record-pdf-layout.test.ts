import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRecordCertificatePdf, renderRecordPdf } from "../lib/pdf";

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

describe("record PDF layout", () => {
  beforeEach(() => {
    mockState.lastDocument = null;
  });

  it("renders readable swimming record labels without image templates", async () => {
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

    const texts = collectTextNodes(root).join("\n");
    expect(texts).toContain("記録証");
    expect(texts).toContain("一般コース");
    expect(texts).toContain("ふりがな");
    expect(texts).toContain("氏名");
    expect(texts).toContain("学年");
    expect(texts).toContain("今回のベスト記録");
    expect(texts).toContain("種目");
    expect(texts).toContain("記録");
    expect(texts).toContain("発行年月 2025年9月");
    expect(texts).toContain("窪園 彩希");
    expect(texts).toContain("くぼその さき");
    expect(texts).not.toContain("...");
    expect(collectNodeTypes(root)).not.toContain("Image");
  });

  it("renders school record footer without issue label text", async () => {
    await renderRecordPdf({
      athlete: {
        fullName: "窪園 彩希",
        fullNameKana: "くぼその さき",
        grade: 8,
        gender: "female"
      },
      entries: [{ eventTitle: "15mクロール", timeText: "12.96" }]
    });

    const texts = collectTextNodes(mockState.lastDocument).join("\n");
    expect(texts).toContain("学校委託コース");
    expect(texts).toContain("学校委託コース記録証");
    expect(texts).not.toContain("発行年月");
  });

  it("limits visible rows to six and shows an overflow note", async () => {
    await renderRecordCertificatePdf({
      athlete: {
        fullName: "窪園 彩希",
        fullNameKana: "くぼその さき",
        grade: 8,
        gender: "female"
      },
      entries: Array.from({ length: 7 }, (_, index) => ({
        eventTitle: `${index + 1}種目`,
        timeText: `${index + 10}.00`
      })),
      issueLabel: "2025年9月"
    });

    const texts = collectTextNodes(mockState.lastDocument).join("\n");
    expect(texts).toContain("1種目");
    expect(texts).toContain("6種目");
    expect(texts).not.toContain("7種目\n");
    expect(texts).toContain("※ 7種目以上あるため6件まで表示しています。");
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
});
