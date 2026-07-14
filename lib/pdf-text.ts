const PDF_UNSAFE_CHARACTER_FALLBACKS: ReadonlyArray<readonly [RegExp, string]> = [
  // The bundled font contains this glyph, but @react-pdf/pdfkit corrupts
  // supplementary-plane CJK characters while embedding the PDF subset.
  // Keep source data unchanged and fall back only at PDF-render time.
  [/𠮷/gu, "吉"]
];

export function normalizePdfText(value: string): string {
  return PDF_UNSAFE_CHARACTER_FALLBACKS.reduce(
    (normalized, [pattern, replacement]) => normalized.replace(pattern, replacement),
    value
  );
}
