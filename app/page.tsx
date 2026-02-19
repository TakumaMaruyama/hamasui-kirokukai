import Link from "next/link";
import SearchForm from "./search-form";
import { prisma } from "@/lib/prisma";
import { formatPublishRange } from "@/lib/publish";

export default async function HomePage() {
  let publishWindow: {
    publishFrom: Date | null;
    publishUntil: Date | null;
    announcement: string | null;
  } | null = null;
  try {
    publishWindow = await prisma.publishWindow.findUnique({
      where: { id: "default" },
      select: {
        publishFrom: true,
        publishUntil: true,
        announcement: true
      }
    });
  } catch {
    publishWindow = null;
  }

  return (
    <main>
      <header>
        <h1>はまスイ記録会 記録検索</h1>
        {publishWindow?.announcement?.trim() ? (
          <section className="announcement-box">
            <p className="announcement-title">お知らせ</p>
            <p className="announcement-body">{publishWindow.announcement}</p>
          </section>
        ) : null}
        <p className="notice publish-deadline">
          {formatPublishRange(publishWindow?.publishFrom, publishWindow?.publishUntil)}
        </p>
      </header>
      <div className="card">
        <SearchForm />
      </div>
      <p className="notice" style={{ marginTop: 16 }}>
        不具合を見つけた場合は、こちらのフォームからご報告ください。
        <br />
        <br />
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLScWJuJ-f8NQ43nRAGKbaMdcNpNZjENEKo9fdjd2_OLqFD8Tvw/viewform?usp=publish-editor"
          target="_blank"
          rel="noopener noreferrer"
        >
          バグ報告フォームを開く
        </a>
      </p>
      <Link href="/admin" className="admin-link">
        管理者
      </Link>
    </main>
  );
}
