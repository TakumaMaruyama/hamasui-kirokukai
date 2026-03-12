import { notFound } from "next/navigation";
import type { Gender } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatMeetMonthLabel } from "@/lib/meet-context";
import { formatPublishRange } from "@/lib/publish";
import { formatGradeLabel } from "@/lib/grade";
import { buildAthleteRankScopeLabels } from "@/lib/athlete-rank-scope";
import { pickBestTimesByEventBase } from "@/lib/history-best-time";
import {
  assignAllTimeClassRankStatsUpToHeldOn,
  assignMonthlyOverallRankStats,
  assignMonthlyRankStats,
  type RankStat
} from "@/lib/monthly-rank";

type ResultWithMeetEvent = {
  id: string;
  timeText: string;
  timeMs: number;
  rank: number;
  meet: { id: string; heldOn: Date; title: string };
  event: { id: string; title: string; distanceM: number; style: string; grade: number; gender: Gender };
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

// 記録会ごとにグループ化
function groupByMeet(results: ResultWithMeetEvent[]) {
  const grouped = new Map<string, { meet: ResultWithMeetEvent["meet"]; results: ResultWithMeetEvent[] }>();

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

// 種目別ベストタイムを計算
function getBestTimes(results: ResultWithMeetEvent[]) {
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

export default async function AthletePage({ params }: { params: { id: string } }) {
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

  const athlete = await prisma.athlete.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      fullName: true,
      grade: true,
      gender: true,
      results: {
        where: {
          meet: { program: "swimming" }
        },
        include: {
          meet: true,
          event: true
        },
        orderBy: [{ meet: { heldOn: "desc" } }]
      }
    }
  });

  if (!athlete) {
    notFound();
  }

  const monthRanges = new Map<string, { start: Date; end: Date }>();
  const eventBaseByKey = new Map<string, EventBaseFilter>();
  const eventClassByKey = new Map<string, EventClassFilter>();

  for (const result of athlete.results) {
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
  const athleteSources: RankSource[] = athlete.results.map((result) => toRankSource({
    id: result.id,
    timeMs: result.timeMs,
    meet: { heldOn: result.meet.heldOn },
    athlete: { fullName: athlete.fullName },
    event: {
      title: result.event.title,
      distanceM: result.event.distanceM,
      style: result.event.style,
      grade: result.event.grade,
      gender: result.event.gender
    }
  }));

  const monthlyClassRankStats = assignMonthlyRankStats(monthlySources);
  const monthlyOverallRankStats = assignMonthlyOverallRankStats(monthlySources);
  const allTimeClassRankStats = assignAllTimeClassRankStatsUpToHeldOn(athleteSources, allTimeSources);

  const groupedResults = groupByMeet(athlete.results);
  const bestTimes = getBestTimes(athlete.results);
  const rankScopeLabels = buildAthleteRankScopeLabels({
    grade: athlete.grade,
    gender: athlete.gender
  });

  const genderLabel = athlete.gender === "male" ? "男子" : athlete.gender === "female" ? "女子" : "";

  return (
    <main>
      <header>
        <h1>{athlete.fullName}</h1>
        <p className="notice">
          {formatGradeLabel(athlete.grade)} / {genderLabel}
        </p>
        <p className="notice publish-deadline">
          {formatPublishRange(publishWindow?.publishFrom, publishWindow?.publishUntil)}
        </p>
      </header>

      {/* ベストタイム */}
      <section className="card" style={{ marginBottom: 24 }}>
        <h2>🏆 ベストタイム</h2>
        {bestTimes.length === 0 ? (
          <p className="notice">記録がありません</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>種目</th>
                <th>ベストタイム</th>
                <th>開催区分</th>
              </tr>
            </thead>
            <tbody>
              {bestTimes.map((result) => (
                <tr key={result.id}>
                  <td>{result.event.title}</td>
                  <td style={{ fontWeight: 600 }}>{result.timeText}</td>
                  <td className="notice">{formatMeetMonthLabel(result.meet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 記録会ごとの記録 */}
      <section className="card">
        <h2>📊 記録会別履歴</h2>
        <p className="notice" style={{ marginBottom: 12 }}>
          ※ 歴代順位は各記録時点までで算出（以降のデータは対象外）
        </p>
        {groupedResults.length === 0 ? (
          <p className="notice">記録がありません</p>
        ) : (
          groupedResults.map((group) => (
            <div key={group.meet.id} style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>{formatMeetMonthLabel(group.meet)}</h3>
              <div className="table-scroll">
                <table className="table rank-table">
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
                          <td>{result.event.title}</td>
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
          ))
        )}
      </section>

      <Link href="/" className="admin-link">
        ← トップに戻る
      </Link>
    </main>
  );
}
