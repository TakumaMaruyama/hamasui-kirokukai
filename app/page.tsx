import Link from "next/link";
import SearchForm from "./search-form";
import { prisma } from "@/lib/prisma";
import { formatPublishRange } from "@/lib/publish";

export default async function HomePage() {
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

  return (
    <main>
      <header>
        <h1>はまスイ記録会 記録検索</h1>
        <p className="notice">フルネーム完全一致で検索できます。</p>
        <p className="notice">
          {formatPublishRange(publishWindow?.publishFrom, publishWindow?.publishUntil)}
        </p>
      </header>
      <div className="card">
        <SearchForm />
      </div>
      <Link href="/admin" className="admin-link">
        管理者
      </Link>
    </main>
  );
}
