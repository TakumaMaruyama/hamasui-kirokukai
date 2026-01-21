import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

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

  return (
    <main>
      <header>
        <h1>{athlete.fullName}</h1>
        <p className="notice">
          {athlete.grade}年 / {athlete.gender}
        </p>
      </header>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>記録推移</h2>
        <table className="table">
          <thead>
            <tr>
              <th>開催日</th>
              <th>記録会</th>
              <th>種目</th>
              <th>タイム</th>
            </tr>
          </thead>
          <tbody>
            {athlete.results.map((result) => (
              <tr key={result.id}>
                <td>{result.meet.heldOn.toISOString().slice(0, 10)}</td>
                <td>{result.meet.title}</td>
                <td>{result.event.title}</td>
                <td>{result.timeText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>種目別順位（学年×男女）</h2>
        <table className="table">
          <thead>
            <tr>
              <th>種目</th>
              <th>順位</th>
            </tr>
          </thead>
          <tbody>
            {athlete.results.map((result) => (
              <tr key={result.id}>
                <td>{result.event.title}</td>
                <td>{result.rank}位</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
