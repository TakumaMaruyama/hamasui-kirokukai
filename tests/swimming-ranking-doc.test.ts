import { describe, expect, it } from "vitest";
import { buildSwimmingRankingDocumentMeta } from "../lib/swimming-ranking-doc";

describe("buildSwimmingRankingDocumentMeta", () => {
  it("labels swimming rankings as general course in the title and file name", () => {
    expect(buildSwimmingRankingDocumentMeta(2025, 9)).toEqual({
      periodLabel: "2025年9月 一般コース",
      fileName: "2025年9月 一般コース_ranking.pdf"
    });
  });
});
