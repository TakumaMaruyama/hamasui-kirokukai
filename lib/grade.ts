export function formatGradeLabel(grade: number): string {
  if (grade === 0) {
    return "年少々";
  }

  if (grade === 1) {
    return "年少";
  }

  if (grade === 2) {
    return "年中";
  }

  if (grade === 3) {
    return "年長";
  }

  if (grade >= 4 && grade <= 9) {
    return `小学${grade - 3}年生`;
  }

  if (grade >= 10 && grade <= 12) {
    return `中学${grade - 9}年生`;
  }

  if (grade >= 13 && grade <= 15) {
    return `高校${grade - 12}年生`;
  }

  return `${grade}年`;
}

export function formatGradeShortLabel(grade: number): string {
  if (grade === 0) {
    return "年少々";
  }

  if (grade === 1) {
    return "年少";
  }

  if (grade === 2) {
    return "年中";
  }

  if (grade === 3) {
    return "年長";
  }

  if (grade >= 4 && grade <= 9) {
    return `小${grade - 3}`;
  }

  if (grade >= 10 && grade <= 12) {
    return `中${grade - 9}`;
  }

  if (grade >= 13 && grade <= 15) {
    return `高${grade - 12}`;
  }

  return `${grade}年`;
}

// Public-facing fallback label for data where elementary grades are stored as 1..6.
export function formatElementaryFirstGradeLabel(grade: number): string {
  if (grade >= 1 && grade <= 6) {
    return `小学${grade}年生`;
  }

  return formatGradeLabel(grade);
}
