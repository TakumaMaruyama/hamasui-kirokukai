import { describe, expect, it } from "vitest";
import { parseSearchRequestInput } from "../lib/search-request";
import { SEARCH_CONSENT_VERSION } from "../lib/search-consent";

describe("search request validation", () => {
  it("accepts valid payload", () => {
    const parsed = parseSearchRequestInput({
      fullName: "  山田   太郎 ",
      consentAccepted: true,
      consentVersion: SEARCH_CONSENT_VERSION
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    expect(parsed.value.fullName).toBe("山田 太郎");
    expect(parsed.value.consentAccepted).toBe(true);
    expect(parsed.value.consentVersion).toBe(SEARCH_CONSENT_VERSION);
  });

  it("rejects when consent is not accepted", () => {
    const parsed = parseSearchRequestInput({
      fullName: "山田 太郎",
      consentAccepted: false,
      consentVersion: SEARCH_CONSENT_VERSION
    });

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }

    expect(parsed.message).toMatch(/同意チェック/);
  });

  it("rejects when consent version mismatches", () => {
    const parsed = parseSearchRequestInput({
      fullName: "山田 太郎",
      consentAccepted: true,
      consentVersion: "v0"
    });

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }

    expect(parsed.message).toMatch(/再度同意/);
  });

  it("rejects when full name is blank", () => {
    const parsed = parseSearchRequestInput({
      fullName: "   ",
      consentAccepted: true,
      consentVersion: SEARCH_CONSENT_VERSION
    });

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }

    expect(parsed.message).toBe("入力が不正です");
  });
});
