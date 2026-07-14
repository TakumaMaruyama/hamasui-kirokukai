export const SCHOOL_ABSENCE_MARKER = "a";

// Event.title is required by the current database schema. Absentees do not
// have an event to display, so a private sentinel is stored instead of
// inventing a user-facing event name.
export const SCHOOL_ABSENCE_EVENT_TITLE = "__school_absence__";

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

export function toSchoolEventDisplayTitle(value: string): string {
  return value === SCHOOL_ABSENCE_EVENT_TITLE ? "" : value;
}
