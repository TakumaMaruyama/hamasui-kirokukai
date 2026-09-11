import { notFound } from "next/navigation";
import type { Gender } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMeetMonthLabel } from "@/lib/meet-context";
import { formatPublishRange } from "@/lib/publish";
import { formatGradeShortLabel } from "@/lib/grade";
import {
  buildAthleteRankScopeLabels,
  buildChildHistoryRankScopeLabels
} from "@/lib/athlete-rank-scope";
import { groupResultsBySchoolYear } from "@/lib/child-history";
import { pickBestTimesByEventBase } from "@/lib/history-best-time";
import { nameSearchKey, normalizeFullName } from "@/lib/search-request";
import {
  assignAllTimeClassRankStatsUpToHeldOn,
  assignMonthlyOverallRankStats,
  assignMonthlyRankStats,
  type RankStat
} from "@/lib/monthly-rank";

type SearchParams = {
  fullName?: string | string[];
  gender?: string | string[];
};

type ResultWithMeetEventAthlete = {
  id: string;
  timeText: string;
  timeMs: number;
  rank: number;
  meet: { id: string; heldOn: Date; title: string };
  event: { id: string; title: string; distanceM: number; style: string; grade: number; gender: Gender };
  athlete: { id: string; fullName: string; grade: number; gender: Gender };
};

type EventBaseFilter = {
  distanceM: number;
};

type EventClassFilter = EventBaseFilter & {
  grade: number;
  gender: Gender;
};

function toEventBaseKey(event: EventBaseFilter): string {
  return [event.distanceM].join(":");
}

function toEventClassKey(event: EventClassFilter): string {
  return [toEventBaseKey(event), event.grade, event.gender].join(":");
}

function toSingleQueryParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
    return value[0];
  }

  return null;
}

function parseGender(value: string | null): Gender | null {
  if (value === "male" || value === "female" || value === "other") {
    return value;
  }

  return null;
}

function formatGenderLabel(gender: Gender): string {
  if (gender === "male") {
    return "男子";
  }

  if (gender === "female") {
    return "女子";
  }

  return "その他";
}

function formatSchoolYearLabel(schoolYear: number): string {
  return `${schoolYear}年度`;
}

function formatGradeRange(grades: number[]): string {
  if (grades.length === 0) {
    return "-";
  }

  if (grades.length === 1) {
    return formatGradeShortLabel(grades[0]);
  }

  const minGrade = grades[0];
  const maxGrade = grades[grades.length - 1];
  return `${formatGradeShortLabel(minGrade)}〜${formatGradeShortLabel(maxGrade)}`;
}

function toRankSource(result: {
  id: string;
  timeMs: number;
  meet: { heldOn: Date };
  athlete?: { fullName: string };
  event: { title: string; distanceM: number; style: string; grade: number; gender: Gender };
}) {
  return {
    id: result.id,
    heldOn: result.meet.heldOn,
    timeMs: result.timeMs,
    athleteName: result.athlete?.fullName,
    event: {
      title: result.event.title,
      distanceM: result.event.distanceM,
      style: result.event.style,
      grade: result.event.grade,
      gender: result.event.gender
    }
  };
}

type RankSource = ReturnType<typeof toRankSource>;

function groupByMeet(results: ResultWithMeetEventAthlete[]) {
  const grouped = new Map<string, { meet: ResultWithMeetEventAthlete["meet"]; results: ResultWithMeetEventAthlete[] }>();

  for (const result of results) {
    const key = result.meet.id;
    if (!grouped.has(key)) {
      grouped.set(key, { meet: result.meet, results: [] });
    }
    grouped.get(key)!.results.push(result);
  }

  return Array.from(grouped.values()).sort(
    (a, b) => b.meet.heldOn.getTime() - a.meet.heldOn.getTime()
  );
}

function getBestTimes(results: ResultWithMeetEventAthlete[]) {
  return pickBestTimesByEventBase(results);
}

function renderRankCell(stat: RankStat | undefined) {
  if (!stat) {
    return "-";
  }

  return (
    <div className="rank-cell">
      <div className="rank-main">{stat.rank}位</div>
      <details className="rank-details">
        <summary>詳細</summary>
        <div className="rank-sub">上位{stat.topPercent}%</div>
        <span>{stat.total}人中{stat.rank}位</span>
      </details>
    </div>
  );
}

function resolveRankScopeLabelsForMeet(
  results: ResultWithMeetEventAthlete[],
  gender: Gender
) {
  const gradeSet = new Set(results.map((result) => result.event.grade));

  if (gradeSet.size !== 1) {
    return buildChildHistoryRankScopeLabels({ gender });
  }

  const grade = Array.from(gradeSet)[0];
  return buildAthleteRankScopeLabels({ grade, gender });
}

async function findAthletesByChild(normalizedFullName: string, gender: Gender) {
  const select = {
    id: true,
    fullName: true,
    grade: true,
    gender: true,
    results: {
      where: { meet: { program: "swimming" as const } },
      include: {
        meet: true,
        event: true
      },
      orderBy: [{ meet: { heldOn: "desc" as const } }]
    }
  };

  const exactMatches = await prisma.athlete.findMany({
    where: {
      fullName: normalizedFullName,
      gender,
      results: {
        some: {
          meet: {
            program: "swimming"
          }
        }
      }
    },
    select,
    orderBy: [{ grade: "asc" }]
  });

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  const key = nameSearchKey(normalizedFullName);
  const fallbackCandidates = await prisma.athlete.findMany({
    where: {
      gender,
      results: {
        some: {
          meet: {
            program: "swimming"
          }
        }
      }
    },
    select,
    orderBy: [{ grade: "asc" }]
  });

  return fallbackCandidates.filter((athlete) => nameSearchKey(athlete.fullName) === key);
}

export default async function AthleteHistoryPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const rawFullName = toSingleQueryParam(query.fullName);
  const rawGender = toSingleQueryParam(query.gender);
  const gender = parseGender(rawGender);

  if (!rawFullName || !gender) {
    notFound();
  }

  const normalizedFullName = normalizeFullName(rawFullName);

  if (!normalizedFullName) {
    notFound();
  }

  let publishWindow: { publishFrom: Date | null; publishUntil: Date | null } | null = null;
  try {
    publishWindow = await prisma.publishWindow.findUnique({
      where: { id: "default" },
      select: {
        publishFrom: true,
        publishUntil: true
      }
    });
  } catch {
    publishWindow = null;
  }

  const athletes = await findAthletesByChild(normalizedFullName, gender);

  if (athletes.length === 0) {
    notFound();
  }

  const displayFullName = athletes[0].fullName;

  const grades = Array.from(new Set(athletes.map((athlete) => athlete.grade))).sort((a, b) => a - b);
  const mergedResults: ResultWithMeetEventAthlete[] = athletes
    .flatMap((athlete) =>
      athlete.results.map((result) => ({
        id: result.id,
        timeText: result.timeText,
        timeMs: result.timeMs,
        rank: result.rank,
        meet: {
          id: result.meet.id,
          heldOn: result.meet.heldOn,
          title: result.meet.title
        },
        event: {
          id: result.event.id,
          title: result.event.title,
          distanceM: result.event.distanceM,
          style: result.event.style,
          grade: result.event.grade,
          gender: result.event.gender
        },
        athlete: {
          id: athlete.id,
          fullName: athlete.fullName,
          grade: athlete.grade,
          gender: athlete.gender
        }
      }))
    )
    .sort((a, b) => b.meet.heldOn.getTime() - a.meet.heldOn.getTime());

  const monthRanges = new Map<string, { start: Date; end: Date }>();
  const eventBaseByKey = new Map<string, EventBaseFilter>();
  const eventClassByKey = new Map<string, EventClassFilter>();

  for (const result of mergedResults) {
    const heldOn = result.meet.heldOn;
    const key = `${heldOn.getUTCFullYear()}-${heldOn.getUTCMonth() + 1}`;
    if (!monthRanges.has(key)) {
      const start = new Date(Date.UTC(heldOn.getUTCFullYear(), heldOn.getUTCMonth(), 1));
      const end = new Date(Date.UTC(heldOn.getUTCFullYear(), heldOn.getUTCMonth() + 1, 1));
      monthRanges.set(key, { start, end });
    }

    const eventBase = {
      distanceM: result.event.distanceM
    };
    eventBaseByKey.set(toEventBaseKey(eventBase), eventBase);

    const eventClass = {
      ...eventBase,
      grade: result.event.grade,
      gender: result.event.gender
    };
    eventClassByKey.set(toEventClassKey(eventClass), eventClass);
  }

  const monthlyMeetScopes = Array.from(monthRanges.values()).map((range) => ({
    heldOn: {
      gte: range.start,
      lt: range.end
    }
  }));
  const eventBaseScopes = Array.from(eventBaseByKey.values()).map((event) => ({
    event: {
      distanceM: event.distanceM
    }
  }));
  const eventClassScopes = Array.from(eventClassByKey.values()).map((event) => ({
    event: {
      distanceM: event.distanceM,
      grade: event.grade,
      gender: event.gender
    }
  }));

  const monthlyScope = monthlyMeetScopes.length === 0 || eventBaseScopes.length === 0
    ? []
    : await prisma.result.findMany({
        where: {
          meet: {
            program: "swimming",
            OR: monthlyMeetScopes
          },
          OR: eventBaseScopes
        },
        select: {
          id: true,
          timeMs: true,
          athlete: {
            select: {
              fullName: true
            }
          },
          meet: {
            select: { heldOn: true }
          },
          event: {
            select: {
              title: true,
              distanceM: true,
              style: true,
              grade: true,
              gender: true
            }
          }
        }
      });

  const allTimeClassScope = eventClassScopes.length === 0
    ? []
    : await prisma.result.findMany({
        where: {
          meet: { program: "swimming" },
          OR: eventClassScopes
        },
        select: {
          id: true,
          timeMs: true,
          meet: {
            select: { heldOn: true }
          },
          event: {
            select: {
              title: true,
              distanceM: true,
              style: true,
              grade: true,
              gender: true
            }
          }
        }
      });

  const monthlySources = monthlyScope.map(toRankSource);
  const allTimeSources = allTimeClassScope.map(toRankSource);
  const targetSources: RankSource[] = mergedResults.map((result) =>
    toRankSource({
      id: result.id,
      timeMs: result.timeMs,
      meet: { heldOn: result.meet.heldOn },
      athlete: { fullName: result.athlete.fullName },
      event: {
        title: result.event.title,
        distanceM: result.event.distanceM,
        style: result.event.style,
        grade: result.event.grade,
        gender: result.event.gender
      }
    })
  );

  const monthlyClassRankStats = assignMonthlyRankStats(monthlySources);
  const monthlyOverallRankStats = assignMonthlyOverallRankStats(monthlySources);
  const allTimeClassRankStats = assignAllTimeClassRankStatsUpToHeldOn(targetSources, allTimeSources);

  const schoolYearGroups = groupResultsBySchoolYear(mergedResults);
  const bestTimes = getBestTimes(mergedResults);

  return (
    <main>
      <header>
        <h1>{displayFullName}</h1>
        <p className="notice">
          {formatGenderLabel(gender)} / 対象学年: {formatGradeRange(grades)}
        </p>
        <p className="notice publish-deadline">
          {formatPublishRange(publishWindow?.publishFrom, publishWindow?.publishUntil)}
        </p>
      </header>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>🏆 ベストタイム</h2>
        {bestTimes.length === 0 ? (
          <p className="notice">記録がありません</p>
        ) : (
          <table className="table history-best-table">
            <colgroup>
              <col className="history-best-col-event" />
              <col className="history-best-col-time" />
              <col className="history-best-col-meet" />
            </colgroup>
            <thead>
              <tr>
                <th>種目</th>
                <th>タイム</th>
                <th>開催区分</th>
              </tr>
            </thead>
            <tbody>
              {bestTimes.map((result) => (
                <tr key={result.id}>
                  <td>
                    <span className="history-best-event-title">{result.event.title}</span>
                    <span className="history-best-event-grade">{formatGradeShortLabel(result.event.grade)}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{result.timeText}</td>
                  <td className="notice">{formatMeetMonthLabel(result.meet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>📊 年度別履歴</h2>
        <p className="notice" style={{ marginBottom: 12 }}>
          ※ 学校年度（4月〜翌3月）ごとに表示 / 歴代順位は各記録時点までで算出
        </p>
        {schoolYearGroups.length === 0 ? (
          <p className="notice">記録がありません</p>
        ) : (
          schoolYearGroups.map((schoolYearGroup) => {
            const meetGroups = groupByMeet(schoolYearGroup.results);

            return (
              <details key={schoolYearGroup.schoolYear} className="school-year-accordion" style={{ marginBottom: 16 }}>
                <summary className="school-year-summary">{formatSchoolYearLabel(schoolYearGroup.schoolYear)}</summary>
                <div style={{ marginTop: 12 }}>
                  {meetGroups.map((group) => {
                    const rankScopeLabels = resolveRankScopeLabelsForMeet(group.results, gender);

                    return (
                      <div key={group.meet.id} style={{ marginBottom: 24 }}>
                        <h4 style={{ fontSize: "1rem", marginBottom: 8 }}>{formatMeetMonthLabel(group.meet)}</h4>
                        <div className="table-scroll">
                          <table className="table rank-table history-rank-table">
                            <colgroup>
                              <col className="history-rank-col-event" />
                              <col className="history-rank-col-time" />
                              <col className="history-rank-col-monthly-class" />
                              <col className="history-rank-col-monthly-overall" />
                              <col className="history-rank-col-alltime" />
                            </colgroup>
                            <thead>
                              <tr className="rank-table-period-row">
                                <th rowSpan={2}>種目</th>
                                <th rowSpan={2}>タイム</th>
                                <th colSpan={2} className="rank-table-period-group rank-table-period-monthly">
                                  {formatMeetMonthLabel(group.meet)}
                                </th>
                                <th colSpan={1} className="rank-table-period-group rank-table-period-alltime">歴代</th>
                              </tr>
                              <tr>
                                <th className="rank-table-subhead-monthly">{rankScopeLabels.monthlyClassHeader}</th>
                                <th className="rank-table-subhead-monthly">{rankScopeLabels.monthlyOverallHeader}</th>
                                <th className="rank-table-subhead-alltime">{rankScopeLabels.allTimeClassHeader}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.results.map((result) => {
                                const monthlyClassRank = monthlyClassRankStats.get(result.id);
                                const monthlyOverallRank = monthlyOverallRankStats.get(result.id);
                                const allTimeClassRank = allTimeClassRankStats.get(result.id);

                                return (
                                  <tr key={result.id}>
                                    <td>{result.event.title}（{formatGradeShortLabel(result.event.grade)}）</td>
                                    <td>{result.timeText}</td>
                                    <td className="rank-table-rank-col rank-table-rank-col-monthly">
                                      {renderRankCell(monthlyClassRank)}
                                    </td>
                                    <td className="rank-table-rank-col rank-table-rank-col-monthly">
                                      {renderRankCell(monthlyOverallRank)}
                                    </td>
                                    <td className="rank-table-rank-col rank-table-rank-col-alltime">
                                      {renderRankCell(allTimeClassRank)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })
        )}
      </section>

      <Link href="/" className="admin-link">
        ← トップに戻る
      </Link>
    </main>
  );
}
