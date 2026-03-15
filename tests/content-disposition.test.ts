import { describe, expect, it } from "vitest";
import { buildAttachmentContentDisposition } from "../lib/content-disposition";

describe("buildAttachmentContentDisposition", () => {
  it("keeps header ASCII-safe while preserving utf-8 filename metadata", () => {
    expect(buildAttachmentContentDisposition("2025年9月_記録証.pdf", "swimming_records.pdf")).toBe(
      "attachment; filename=\"swimming_records.pdf\"; filename*=UTF-8''2025%E5%B9%B49%E6%9C%88_%E8%A8%98%E9%8C%B2%E8%A8%BC.pdf"
    );
  });
});
