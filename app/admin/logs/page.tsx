import { prisma } from "@/lib/prisma";
import { isMissingSearchLogConsentVersionColumnError } from "@/lib/search-log";

export const dynamic = "force-dynamic";

type SearchLogRow = {
  id: string;
  createdAt: Date;
  fullName: string;
  ipAddress: string;
  userAgent: string;
  consentVersion: string | null;
};

export default async function LogsPage() {
  let logs: SearchLogRow[] = [];
  let warning: string | null = null;

  try {
    logs = await prisma.searchLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        fullName: true,
        ipAddress: true,
        userAgent: true,
        consentVersion: true
      }
    });
  } catch (error) {
    if (!isMissingSearchLogConsentVersionColumnError(error)) {
      throw error;
    }

    const fallbackLogs = await prisma.searchLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        fullName: true,
        ipAddress: true,
        userAgent: true
      }
    });

    logs = fallbackLogs.map((log) => ({
      ...log,
      consentVersion: null
    }));
    warning = "本番DBに consentVersion 列が未反映のため、同意版は表示していません。";
  }

  return (
    <main>
      <header>
        <h1>検索ログ</h1>
        {warning ? <p className="notice" style={{ color: "#b00020" }}>{warning}</p> : null}
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
