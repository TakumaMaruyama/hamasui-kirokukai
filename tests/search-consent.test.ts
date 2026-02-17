import { describe, expect, it } from "vitest";
import { SEARCH_CONSENT_ITEMS, SEARCH_CONSENT_VERSION } from "../lib/search-consent";

describe("search consent constants", () => {
  it("defines consent version", () => {
    expect(SEARCH_CONSENT_VERSION).toBe("v1");
  });

  it("defines three consent items in fixed order", () => {
    expect(SEARCH_CONSENT_ITEMS).toEqual([
      "利用目的: 本人・保護者による記録確認のみ",
      "禁止事項: 第三者の無断検索、収集、転載",
      "ログ記録: IP/User-Agent/検索日時は必ず記録され、履歴として保存されます"
    ]);
  });
});
