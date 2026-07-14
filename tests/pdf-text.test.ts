import { describe, expect, it } from "vitest";
import { normalizePdfText } from "../lib/pdf-text";

describe("normalizePdfText", () => {
  it("falls back from the unsupported supplementary-plane yoshida glyph", () => {
    expect(normalizePdfText("𠮷田 光毅")).toBe("吉田 光毅");
  });

  it("keeps ordinary PDF text unchanged", () => {
    expect(normalizePdfText("吉田 光毅")).toBe("吉田 光毅");
  });
});
