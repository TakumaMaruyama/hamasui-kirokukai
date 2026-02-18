import { notFound } from "next/navigation";
import type { Gender } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatMeetMonthLabel } from "@/lib/meet-context";
import { formatPublishRange } from "@/lib/publish";
import { formatGradeLabel } from "@/lib/grade";
import { assignAllTimeClassRanks, assignMonthlyOverallRanks, assignMonthlyRanks } from "@/lib/monthly-rank";

type ResultWithMeetEvent = {
  id: string;
  timeText: string;
  timeMs: number;
  rank: number;
  meet: { id: string; heldOn: Date; title: string };
  event: { id: string; title: string; distanceM: number; style: string; grade: number; gender: Gender };
};

type EventBaseFilter = {
  title: string;
  distanceM: number;
  style: string;
};

type EventClassFilter = EventBaseFilter & {
  grade: number;
  gender: Gender;
};

function toEventBaseKey(event: EventBaseFilter): string {
  return [event.title, event.distanceM, event.style].join(":");
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
  const bestByEvent = new Map<string, ResultWithMeetEvent>();

  for (const result of results) {
    const key = result.event.id;
    const current = bestByEvent.get(key);
    if (!current || result.timeMs < current.timeMs) {
      bestByEvent.set(key, result);
    }
  }

  return Array.from(bestByEvent.values()).sort((a, b) =>
    a.event.title.localeCompare(b.event.title, "ja")
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
      title: result.event.title,
      distanceM: result.event.distanceM,
      style: result.event.style
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
      title: event.title,
      distanceM: event.distanceM,
      style: event.style
    }
  }));
  const eventClassScopes = Array.from(eventClassByKey.values()).map((event) => ({
    event: {
      title: event.title,
      distanceM: event.distanceM,
      style: event.style,
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

  const monthlyClassRanks = assignMonthlyRanks(monthlyScope.map(toRankSource));
  const monthlyOverallRanks = assignMonthlyOverallRanks(monthlyScope.map(toRankSource));
  const allTimeClassRanks = assignAllTimeClassRanks(allTimeClassScope.map(toRankSource));

  const groupedResults = groupByMeet(athlete.results);
  const bestTimes = getBestTimes(athlete.results);

  const genderLabel = athlete.gender === "male" ? "男子" : athlete.gender === "female" ? "女子" : "";

  return (
    <main>
      <header>
        <h1>{athlete.fullName}</h1>
        <p className="notice">
          {formatGradeLabel(athlete.grade)} / {genderLabel}
        </p>
        <p className="notice">
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
        <div className="notice rank-guide">
          <div className="rank-guide-title">順位は「期間 × 比較対象」で見分けます</div>
          <ul className="rank-guide-list">
            <li><span className="rank-guide-key">月内 × 同学年・同性別</span></li>
            <li><span className="rank-guide-key">月内 × 性別内（学年混合）</span></li>
            <li><span className="rank-guide-key">歴代 × 同学年・同性別</span></li>
          </ul>
        </div>
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
                      <th colSpan={2} className="rank-table-period-group">月内</th>
                      <th colSpan={1} className="rank-table-period-group">歴代</th>
                    </tr>
                    <tr>
                      <th>同学年・同性別</th>
                      <th>性別内（学年混合）</th>
                      <th>同学年・同性別</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.results.map((result) => {
                      const monthlyClassRank = monthlyClassRanks.get(result.id);
                      const monthlyOverallRank = monthlyOverallRanks.get(result.id);
                      const allTimeClassRank = allTimeClassRanks.get(result.id);

                      return (
                        <tr key={result.id}>
                          <td>{result.event.title}</td>
                          <td>{result.timeText}</td>
                          <td>{typeof monthlyClassRank === "number" ? `${monthlyClassRank}位` : "-"}</td>
                          <td>{typeof monthlyOverallRank === "number" ? `${monthlyOverallRank}位` : "-"}</td>
                          <td>{typeof allTimeClassRank === "number" ? `${allTimeClassRank}位` : "-"}</td>
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
