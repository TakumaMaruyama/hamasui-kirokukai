import { notFound } from "next/navigation";
import type { Gender } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatMeetLabel } from "@/lib/meet-context";
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
  event: { title: string; distanceM: number; style: string; grade: number; gender: Gender };
}) {
  return {
    id: result.id,
    heldOn: result.meet.heldOn,
    timeMs: result.timeMs,
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
                  <td className="notice">{formatMeetLabel(result.meet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 記録会ごとの記録 */}
      <section className="card">
        <h2>📊 記録会別履歴</h2>
        <div className="notice" style={{ marginBottom: 12, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>順位の見方（わかりやすく）</div>
          <div>・同月 学年/性別: その月の「同じ種目・同じ学年・同じ性別」で比べた順位</div>
          <div>・同月 全体（性別別）: その月の「同じ種目・同じ性別」で比べた順位（学年は混合）</div>
          <div>・歴代 学年/性別: これまでの全記録で「同じ種目・同じ学年・同じ性別」で比べた順位</div>
        </div>
        {groupedResults.length === 0 ? (
          <p className="notice">記録がありません</p>
        ) : (
          groupedResults.map((group) => (
            <div key={group.meet.id} style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>{formatMeetLabel(group.meet)}</h3>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>種目</th>
                      <th>タイム</th>
                      <th>同月 学年/性別</th>
                      <th>同月 全体（性別別）</th>
                      <th>歴代 学年/性別</th>
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
