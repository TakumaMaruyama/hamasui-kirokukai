import { describe, expect, it } from "vitest";
import { parseCsv } from "../lib/csv";

describe("parseCsv", () => {
  it("parses UTF-8 BOM CSV", () => {
    const content =
      "\uFEFFmeet_title,held_on,full_name,grade,gender,event_title,style,distance_m,lane,time_text\n" +
      "第1回記録会,2024-06-01,山田太郎,4,male,50m自由形,free,50,2,0:35.12";

    const rows = parseCsv(content);

    expect(rows).toHaveLength(1);
    expect(rows[0].meet_title).toBe("第1回記録会");
    expect(rows[0].full_name).toBe("山田太郎");
  });

  it("maps Japanese headers to canonical keys", () => {
    const content =
      "記録会名称,開催日,氏名,学年,性別,種目名,泳法,距離,レーン,記録\n" +
      "学校委託記録会,2024-05-15,高橋次郎,5,male,50m平泳ぎ,breast,50,3,0:42.88";

    const rows = parseCsv(content);

    expect(rows).toHaveLength(1);
    expect(rows[0].meet_title).toBe("学校委託記録会");
    expect(rows[0].held_on).toBe("2024-05-15");
    expect(rows[0].distance_m).toBe("50");
  });

  it("throws when required columns are missing", () => {
    const content =
      "meet_title,held_on,full_name,grade,gender,event_title,distance_m,time_text\n" +
      "第1回記録会,2024-06-01,山田太郎,4,male,50m自由形,50,0:35.12";

    expect(() => parseCsv(content)).toThrow(/必須列が不足しています/);
  });

  it("normalizes legacy roster CSV using file name metadata", () => {
    const content =
      "種目,組,コース,名前,性別,ふりがな,学年,タイム,備考,,,種目,,性別\n" +
      "15ｍ板キック,1,,満留　一智,男,みつどめ　いち,年中,65.29,,,,15ｍ板キック,,男\n" +
      "15ｍ板キック,5,,,男,,3,,,,,年少々,,\n";

    const rows = parseCsv(content, { fileName: "25.09名簿 - 月.csv" });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      meet_title: "25.09名簿 - 月",
      held_on: "2025-09-01",
      full_name: "満留 一智",
      full_name_kana: "みつどめ いち",
      grade: "2",
      gender: "male",
      event_title: "15ｍ板キック",
      style: "kick",
      distance_m: "15",
      time_text: "65.29"
    });
  });

  it("normalizes legacy roster CSV using year/month/weekday context", () => {
    const content =
      "種目,組,コース,名前,性別,ふりがな,学年,タイム,備考\n" +
      "15ｍ板キック,1,,満留　一智,男,みつどめ　いち,年中,65.29,\n";

    const rows = parseCsv(content, {
      meetContext: { year: 2026, month: 2, weekday: "木曜" }
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      meet_title: "2026年2月木曜",
      held_on: "2026-02-01",
      full_name: "満留 一智",
      grade: "2",
      gender: "male"
    });
  });

  it("normalizes legacy roster CSV using year/month context without weekday", () => {
    const content =
      "種目,組,コース,名前,性別,ふりがな,学年,タイム,備考\n" +
      "15ｍ板キック,1,,満留　一智,男,みつどめ　いち,年中,65.29,\n";

    const rows = parseCsv(content, {
      meetContext: { year: 2026, month: 2 }
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      meet_title: "2026年2月",
      held_on: "2026-02-01",
      full_name: "満留 一智",
      grade: "2",
      gender: "male"
    });
  });

  it("normalizes elementary and middle school grades without overlap", () => {
    const content =
      "種目,組,コース,名前,性別,ふりがな,学年,タイム,備考\n" +
      "25mクロール,1,,小学生 太郎,男,しょうがくせい たろう,小2,45.00,\n" +
      "25mクロール,1,,中学生 花子,女,ちゅうがくせい はなこ,中学3年生,43.00,\n";

    const rows = parseCsv(content, {
      meetContext: { year: 2026, month: 2, weekday: "木曜" }
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.grade).toBe("5");
    expect(rows[1]?.grade).toBe("12");
  });

  it("normalizes numeric elementary grades in legacy roster CSV to canonical grades", () => {
    const content =
      "種目,組,コース,名前,性別,ふりがな,学年,タイム,備考\n" +
      "25mクロール,1,,小学生 太郎,男,しょうがくせい たろう,5,45.00,\n";

    const rows = parseCsv(content, {
      meetContext: { year: 2026, month: 2, weekday: "木曜" }
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.grade).toBe("8");
  });

  it("skips absentees when name exists but event is empty", () => {
    const content =
      "種目,組,コース,名前,性別,ふりがな,学年,タイム,備考\n" +
      ",1,,満留　一智,男,みつどめ　いち,年中,65.29,\n" +
      "15ｍ板キック,1,,横手 岳,男,よこて がく,年長,36.32,\n";

    const rows = parseCsv(content, {
      meetContext: { year: 2026, month: 2, weekday: "木曜" }
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe("横手 岳");
  });

  it("skips absentees when name exists but time is empty", () => {
    const content =
      "種目,組,コース,名前,性別,ふりがな,学年,タイム,備考\n" +
      "15ｍ板キック,1,,満留　一智,男,みつどめ　いち,年中,,\n" +
      "15ｍ板キック,1,,横手 岳,男,よこて がく,年長,36.32,\n";

    const rows = parseCsv(content, {
      meetContext: { year: 2026, month: 2, weekday: "木曜" }
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe("横手 岳");
  });

  it("skips rows when name is empty even if time exists", () => {
    const content =
      "種目,組,コース,名前,性別,ふりがな,学年,タイム,備考\n" +
      "15ｍ板キック,1,,,男,,1,19.46,\n" +
      "15ｍ板キック,1,,横手 岳,男,よこて がく,年長,36.32,\n";

    const rows = parseCsv(content, {
      meetContext: { year: 2026, month: 2, weekday: "木曜" }
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe("横手 岳");
  });
});
