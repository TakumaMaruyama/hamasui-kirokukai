import { describe, expect, it } from "vitest";
import {
  groupAthletesByChild,
  groupResultsBySchoolYear,
  toSchoolYear
} from "../lib/child-history";

describe("child history helpers", () => {
  it("groups same child by normalized full name + gender and unique grades", () => {
    const grouped = groupAthletesByChild([
      { fullName: "山田 太郎", grade: 5, gender: "male" },
      { fullName: "山田　太郎", grade: 6, gender: "male" },
      { fullName: "山田 太郎", grade: 5, gender: "male" }
    ]);

    expect(grouped).toEqual([
      {
        fullName: "山田 太郎",
        gender: "male",
        grades: [5, 6]
      }
    ]);
  });

  it("does not merge same name when gender differs", () => {
    const grouped = groupAthletesByChild([
      { fullName: "佐藤 花", grade: 4, gender: "female" },
      { fullName: "佐藤 花", grade: 4, gender: "male" }
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toEqual({
      fullName: "佐藤 花",
      gender: "male",
      grades: [4]
    });
    expect(grouped[1]).toEqual({
      fullName: "佐藤 花",
      gender: "female",
      grades: [4]
    });
  });

  it("computes school year using April as boundary", () => {
    expect(toSchoolYear(new Date("2025-03-31T00:00:00.000Z"))).toBe(2024);
    expect(toSchoolYear(new Date("2025-04-01T00:00:00.000Z"))).toBe(2025);
  });

  it("groups results by school year in descending order", () => {
    const grouped = groupResultsBySchoolYear([
      {
        id: "r-2024-05",
        meet: { heldOn: new Date("2024-05-10T00:00:00.000Z") }
      },
      {
        id: "r-2025-01",
        meet: { heldOn: new Date("2025-01-10T00:00:00.000Z") }
      },
      {
        id: "r-2025-04",
        meet: { heldOn: new Date("2025-04-10T00:00:00.000Z") }
      }
    ]);

    expect(grouped.map((group) => group.schoolYear)).toEqual([2025, 2024]);
    expect(grouped[0].results.map((result) => result.id)).toEqual(["r-2025-04"]);
    expect(grouped[1].results.map((result) => result.id)).toEqual(["r-2025-01", "r-2024-05"]);
  });
});
