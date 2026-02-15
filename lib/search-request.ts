import { z } from "zod";
import { SEARCH_CONSENT_VERSION } from "./search-consent";

const schema = z.object({
  fullName: z.string(),
  consentAccepted: z.boolean(),
  consentVersion: z.string()
});

export function normalizeFullName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function nameSearchKey(value: string): string {
  return normalizeFullName(value).replace(/\s/g, "");
}

export type SearchRequestPayload = {
  fullName: string;
  consentAccepted: boolean;
  consentVersion: string;
};

export function parseSearchRequestInput(
  input: unknown
): { ok: true; value: SearchRequestPayload } | { ok: false; message: string } {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "入力が不正です" };
  }

  const normalizedFullName = normalizeFullName(parsed.data.fullName);
  if (!normalizedFullName) {
    return { ok: false, message: "入力が不正です" };
  }

  if (parsed.data.consentAccepted !== true) {
    return { ok: false, message: "検索には同意チェックが必要です" };
  }

  if (parsed.data.consentVersion !== SEARCH_CONSENT_VERSION) {
    return { ok: false, message: "同意内容が更新されました。再度同意してください" };
  }

  return {
    ok: true,
    value: {
      fullName: normalizedFullName,
      consentAccepted: true,
      consentVersion: parsed.data.consentVersion
    }
  };
}
