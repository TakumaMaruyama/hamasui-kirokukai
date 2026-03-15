function toAsciiFallbackFileName(fileName: string): string {
  const cleaned = fileName
    .replace(/[^\x20-\x7E]+/g, "_")
    .replace(/["\\]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "download.pdf";
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export function buildAttachmentContentDisposition(fileName: string, fallbackFileName?: string): string {
  const fallback = toAsciiFallbackFileName(fallbackFileName ?? fileName);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeRfc5987Value(fileName)}`;
}
