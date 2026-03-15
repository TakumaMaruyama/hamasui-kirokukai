import { type RecordCertificate, buildRecordCertificates, type RecordCertificateSourceRow } from "./record-certificate";
import { parseMeetTitleContext, WEEKDAY_VALUES } from "./meet-context";

export const UNKNOWN_WEEKDAY_FOLDER_NAME = "曜日なし";

export type SwimmingRecordOutput = RecordCertificate & {
  outputPath: string;
};

const WEEKDAY_FOLDER_ORDER = [...WEEKDAY_VALUES, UNKNOWN_WEEKDAY_FOLDER_NAME] as const;
const WEEKDAY_FOLDER_ORDER_MAP = new Map(
  WEEKDAY_FOLDER_ORDER.map((folderName, index) => [folderName, index])
);

function resolveWeekdayFolderName(title?: string | null): string {
  const weekday = title ? parseMeetTitleContext(title)?.weekday : undefined;
  return weekday ?? UNKNOWN_WEEKDAY_FOLDER_NAME;
}

export function buildSwimmingRecordOutputs(
  rows: RecordCertificateSourceRow[],
  options?: {
    year?: number;
    month?: number;
    groupByWeekdayFolders?: boolean;
  }
): SwimmingRecordOutput[] {
  const certificateOptions =
    typeof options?.year === "number" && typeof options?.month === "number"
      ? { year: options.year, month: options.month }
      : undefined;

  if (!options?.groupByWeekdayFolders) {
    return buildRecordCertificates(rows, certificateOptions).map((certificate) => ({
      ...certificate,
      outputPath: certificate.fileName
    }));
  }

  const rowsByFolder = new Map<string, RecordCertificateSourceRow[]>();

  for (const row of rows) {
    const folderName = resolveWeekdayFolderName(row.meet.title);
    const existing = rowsByFolder.get(folderName);
    if (existing) {
      existing.push(row);
      continue;
    }

    rowsByFolder.set(folderName, [row]);
  }

  return Array.from(rowsByFolder.entries())
    .sort(([left], [right]) => {
      const leftOrder = WEEKDAY_FOLDER_ORDER_MAP.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = WEEKDAY_FOLDER_ORDER_MAP.get(right) ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.localeCompare(right, "ja");
    })
    .flatMap(([folderName, folderRows]) =>
      buildRecordCertificates(folderRows, certificateOptions).map((certificate) => ({
        ...certificate,
        outputPath: `${folderName}/${certificate.fileName}`
      }))
    );
}
