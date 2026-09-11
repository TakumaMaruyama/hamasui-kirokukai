const DEFAULT_FILENAME = "download.pdf";

function sanitizeDownloadFilename(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|\u0000-\u001F\u007F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+$/, "");

  return cleaned || fallback;
}

function decodeFilenameStar(value: string): string | null {
  const match = value.match(/^([^']*)'[^']*'(.*)$/);
  if (!match || !/^utf-8$/i.test(match[1])) {
    return null;
  }

  try {
    return decodeURIComponent(match[2]);
  } catch {
    return null;
  }
}

/**
 * Selects a browser-safe filename from an attachment response. RFC 5987
 * `filename*` takes precedence so Japanese server-side filenames survive.
 */
export function getDownloadFilename(
  contentDisposition: string | null,
  fallbackFilename = DEFAULT_FILENAME
): string {
  const fallback = sanitizeDownloadFilename(fallbackFilename, DEFAULT_FILENAME);
  if (!contentDisposition) {
    return fallback;
  }

  const encoded = contentDisposition.match(/(?:^|;)\s*filename\*\s*=\s*([^;]+)/i)?.[1]?.trim();
  if (encoded) {
    const decoded = decodeFilenameStar(encoded.replace(/^"|"$/g, ""));
    if (decoded) {
      return sanitizeDownloadFilename(decoded, fallback);
    }
  }

  const quoted = contentDisposition.match(/(?:^|;)\s*filename\s*=\s*"([^"]*)"/i)?.[1];
  const unquoted = contentDisposition.match(/(?:^|;)\s*filename\s*=\s*([^;\s]+)/i)?.[1];
  return sanitizeDownloadFilename(quoted ?? unquoted ?? fallback, fallback);
}
