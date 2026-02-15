import { prisma } from "@/lib/prisma";

export default async function LogsPage() {
  const logs = await prisma.searchLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return (
    <main>
      <header>
        <h1>検索ログ</h1>
      </header>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>日時</th>
              <th>氏名</th>
              <th>同意版</th>
              <th>IP</th>
              <th>User-Agent</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.createdAt.toISOString()}</td>
                <td>{log.fullName}</td>
                <td>{log.consentVersion ?? "-"}</td>
                <td>{log.ipAddress}</td>
                <td>{log.userAgent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
