export const SCHOOL_ABSENCE_MARKER = "a";

// Result.timeMs is required by the existing schema. School absences are kept as
// results so that a certificate can still be generated, and use a negative
// value that can never be confused with a valid swimming time.
export const SCHOOL_ABSENCE_TIME_MS = -1;

export function isSchoolAbsenceTimeText(value: string | null | undefined): boolean {
  return value?.normalize("NFKC").trim().toLowerCase() === SCHOOL_ABSENCE_MARKER;
}

export function normalizeSchoolTimeText(value: string): string {
  return isSchoolAbsenceTimeText(value) ? SCHOOL_ABSENCE_MARKER : value.trim();
}

export function isSchoolAbsenceResult(input: {
  timeText: string;
  timeMs?: number;
}): boolean {
  return isSchoolAbsenceTimeText(input.timeText);
}
