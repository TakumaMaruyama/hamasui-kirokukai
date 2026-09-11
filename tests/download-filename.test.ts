import { describe, expect, it } from "vitest";
import { getDownloadFilename } from "../lib/download-filename";

describe("getDownloadFilename", () => {
  it("prefers a UTF-8 filename* over the ASCII fallback", () => {
    expect(
      getDownloadFilename(
        "attachment; filename=swimming_records.pdf; filename*=UTF-8''2025%E5%B9%B49%E6%9C%88_%E8%A8%98%E9%8C%B2%E8%A8%BC.pdf"
      )
    ).toBe("2025年9月_記録証.pdf");
  });

  it("uses filename when filename* is absent or invalid", () => {
    expect(getDownloadFilename('attachment; filename="ranking.pdf"')).toBe("ranking.pdf");
    expect(getDownloadFilename("attachment; filename*=UTF-8''%E0%A4", "fallback.pdf")).toBe("fallback.pdf");
  });

  it("removes path characters and control characters from a response filename", () => {
    expect(getDownloadFilename('attachment; filename="../a/b\\c.pdf"')).toBe(".._a_b_c.pdf");
  });
});
