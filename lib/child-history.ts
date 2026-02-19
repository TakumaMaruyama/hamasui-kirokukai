import type { Gender } from "@prisma/client";
import { nameSearchKey } from "./search-request";

export type ChildAthleteIdentity = {
  fullName: string;
  grade: number;
  gender: Gender;
};

export type ChildSearchResult = {
  fullName: string;
  gender: Gender;
  grades: number[];
};

type HeldOnResult = {
  meet: {
    heldOn: Date;
  };
};

export type SchoolYearGroup<T extends HeldOnResult> = {
  schoolYear: number;
  results: T[];
};

const GENDER_ORDER: Record<Gender, number> = {
  male: 0,
  female: 1,
  other: 2
};

function toChildKey(input: { fullName: string; gender: Gender }): string {
  return `${nameSearchKey(input.fullName)}:${input.gender}`;
}

function sortByHeldOnDesc<T extends HeldOnResult>(a: T, b: T): number {
  return b.meet.heldOn.getTime() - a.meet.heldOn.getTime();
}

export function groupAthletesByChild(athletes: ChildAthleteIdentity[]): ChildSearchResult[] {
  const grouped = new Map<string, { fullName: string; gender: Gender; grades: Set<number> }>();

  for (const athlete of athletes) {
    const key = toChildKey(athlete);
    if (!grouped.has(key)) {
      grouped.set(key, {
        fullName: athlete.fullName,
        gender: athlete.gender,
        grades: new Set<number>()
      });
    }

    grouped.get(key)!.grades.add(athlete.grade);
  }

  return Array.from(grouped.values())
    .map((group) => ({
      fullName: group.fullName,
      gender: group.gender,
      grades: Array.from(group.grades).sort((a, b) => a - b)
    }))
    .sort((a, b) => {
      const nameOrder = a.fullName.localeCompare(b.fullName, "ja");
      if (nameOrder !== 0) {
        return nameOrder;
      }

      return GENDER_ORDER[a.gender] - GENDER_ORDER[b.gender];
    });
}

export function toSchoolYear(heldOn: Date): number {
  const year = heldOn.getUTCFullYear();
  const month = heldOn.getUTCMonth() + 1;
  return month >= 4 ? year : year - 1;
}

export function groupResultsBySchoolYear<T extends HeldOnResult>(
  results: T[]
): SchoolYearGroup<T>[] {
  const grouped = new Map<number, T[]>();

  for (const result of results) {
    const schoolYear = toSchoolYear(result.meet.heldOn);
    if (!grouped.has(schoolYear)) {
      grouped.set(schoolYear, []);
    }
    grouped.get(schoolYear)!.push(result);
  }

  return Array.from(grouped.entries())
    .map(([schoolYear, entries]) => ({
      schoolYear,
      results: [...entries].sort(sortByHeldOnDesc)
    }))
    .sort((a, b) => b.schoolYear - a.schoolYear);
}
