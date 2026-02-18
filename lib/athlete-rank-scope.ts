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
    monthlyClassHeader: "学年・性別",
    monthlyOverallHeader: `${genderLabel}・全学年`,
    allTimeClassHeader: "学年・性別"
  };
}
