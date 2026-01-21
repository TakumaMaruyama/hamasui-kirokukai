import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

type ResultWithMeetEvent = {
  id: string;
  timeText: string;
  timeMs: number;
  rank: number;
  meet: { id: string; heldOn: Date; title: string };
  event: { id: string; title: string };
};

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
  const athlete = await prisma.athlete.findUnique({
    where: { id: params.id },
    include: {
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

  if (!athlete || !athlete.publishConsent) {
    notFound();
  }

  if (athlete.publishUntil && athlete.publishUntil < new Date()) {
    notFound();
  }

  const groupedResults = groupByMeet(athlete.results);
  const bestTimes = getBestTimes(athlete.results);

  const genderLabel = athlete.gender === "male" ? "男子" : athlete.gender === "female" ? "女子" : "";

  return (
    <main>
      <header>
        <h1>{athlete.fullName}</h1>
        <p className="notice">
          {athlete.grade}年 / {genderLabel}
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
                <th>記録日</th>
              </tr>
            </thead>
            <tbody>
              {bestTimes.map((result) => (
                <tr key={result.id}>
                  <td>{result.event.title}</td>
                  <td style={{ fontWeight: 600 }}>{result.timeText}</td>
                  <td className="notice">{result.meet.heldOn.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 記録会ごとの記録 */}
      <section className="card">
        <h2>📊 記録会別履歴</h2>
        {groupedResults.length === 0 ? (
          <p className="notice">記録がありません</p>
        ) : (
          groupedResults.map((group) => (
            <div key={group.meet.id} style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>
                {group.meet.title}
                <span className="notice" style={{ marginLeft: 8 }}>
                  ({group.meet.heldOn.toISOString().slice(0, 10)})
                </span>
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>種目</th>
                    <th>タイム</th>
                    <th>順位</th>
                  </tr>
                </thead>
                <tbody>
                  {group.results.map((result) => (
                    <tr key={result.id}>
                      <td>{result.event.title}</td>
                      <td>{result.timeText}</td>
                      <td>{result.rank}位</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
