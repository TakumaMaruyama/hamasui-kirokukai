export const CHALLENGE_GRADE_MIN = 1;
export const CHALLENGE_GRADE_MAX = 15;

type GradeRow = {
  grade: string;
};

export function isChallengeGrade(rawGrade: string): boolean {
  const value = Number(rawGrade.trim());

  if (!Number.isInteger(value)) {
    return false;
  }

  return value >= CHALLENGE_GRADE_MIN && value <= CHALLENGE_GRADE_MAX;
}

export function filterChallengeGradeRows<T extends GradeRow>(rows: T[]): {
  acceptedRows: T[];
  skippedCount: number;
} {
  const acceptedRows = rows.filter((row) => isChallengeGrade(row.grade));

  return {
    acceptedRows,
    skippedCount: rows.length - acceptedRows.length
  };
}
