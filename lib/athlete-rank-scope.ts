import type { Gender } from "@prisma/client";
import { formatGradeShortLabel } from "./grade";

export type AthleteRankScopeLabels = {
  profileScopeLabel: string;
  monthlyClassHeader: string;
  monthlyOverallHeader: string;
  allTimeClassHeader: string;
};

function toGenderLabel(gender: Gender): string {
  if (gender === "male") {
    return "男子";
  }

  if (gender === "female") {
    return "女子";
  }

  return "その他";
}

export function buildAthleteRankScopeLabels(input: { grade: number; gender: Gender }): AthleteRankScopeLabels {
  const gradeLabel = formatGradeShortLabel(input.grade);
  const genderLabel = toGenderLabel(input.gender);
  const profileScopeLabel = `${gradeLabel}${genderLabel}`;

  return {
    profileScopeLabel,
    monthlyClassHeader: `同学年・同性別（${profileScopeLabel}）`,
    monthlyOverallHeader: `性別内（${genderLabel}・学年混合）`,
    allTimeClassHeader: `同学年・同性別（${profileScopeLabel}）`
  };
}
