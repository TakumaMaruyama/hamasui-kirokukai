type SearchLogError = unknown;

export function isMissingSearchLogConsentVersionColumnError(error: SearchLogError): boolean {
  const message = error instanceof Error ? error.message : "";
  return /SearchLog\.consentVersion|column .*consentVersion.* does not exist/i.test(message);
}
