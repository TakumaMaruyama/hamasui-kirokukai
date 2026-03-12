import Link from "next/link";
import SearchForm from "./search-form";
import { prisma } from "@/lib/prisma";
import { formatImprovementTotal } from "@/lib/display-time";
import { getHomeMeetComparisonSummary } from "@/lib/home-meet-summary";
import { formatMeetLabel } from "@/lib/meet-context";
import { formatPublishRange } from "@/lib/publish";

function formatCount(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function formatHeldOn(value: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

export default async function HomePage() {
  const [publishWindowResult, comparisonSummaryResult] = await Promise.allSettled([
    prisma.publishWindow.findUnique({
      where: { id: "default" },
      select: {
        publishFrom: true,
        publishUntil: true,
        announcement: true
      }
    }),
    getHomeMeetComparisonSummary()
  ]);

  const publishWindow =
    publishWindowResult.status === "fulfilled" ? publishWindowResult.value : null;
  const comparisonSummary =
    comparisonSummaryResult.status === "fulfilled" ? comparisonSummaryResult.value : null;

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
      {comparisonSummary ? (
        <section className="home-progress-card" aria-labelledby="home-progress-title">
          <p className="home-progress-eyebrow">みんなの前回比</p>
          {comparisonSummary.state === "ready" ? (
            comparisonSummary.totalImprovementMs > 0 ? (
              <>
                <h2 id="home-progress-title" className="home-progress-title">
                  みんなで前回より {formatImprovementTotal(comparisonSummary.totalImprovementMs)} 速くなった
                </h2>
                <p className="home-progress-body">
                  前回と比べられた {formatCount(comparisonSummary.comparedEntryCount)}記録中 {formatCount(comparisonSummary.improvedEntryCount)}記録更新
                </p>
              </>
            ) : (
              <>
                <h2 id="home-progress-title" className="home-progress-title">
                  今回はまだ前回超えなし
                </h2>
                <p className="home-progress-body">
                  比較できた {formatCount(comparisonSummary.comparedEntryCount)} 記録をもとに集計しています。次の記録会で更新を狙おう。
                </p>
              </>
            )
          ) : comparisonSummary.state === "not-comparable" ? (
            <>
              <h2 id="home-progress-title" className="home-progress-title">
                比較できる同一記録がまだ少ない
              </h2>
              <p className="home-progress-body">
                今回と前回で、同じ子・同じ種目がまだ十分そろっていません。次回以降に前回比を表示します。
              </p>
            </>
          ) : (
            <>
              <h2 id="home-progress-title" className="home-progress-title">
                次回から前回比を表示
              </h2>
              <p className="home-progress-body">
                直近の記録会がまだ1回分のため、次の記録会が入ると「前回より何秒速くなったか」を表示できます。
              </p>
            </>
          )}

          <div className="home-progress-meets">
            <article className="home-progress-meet home-progress-meet-current">
              <p className="home-progress-meet-label">今回</p>
              <h3 className="home-progress-meet-title">
                {formatMeetLabel(comparisonSummary.currentMeet)}
              </h3>
              <p className="home-progress-meet-date">{formatHeldOn(comparisonSummary.currentMeet.heldOn)}</p>
              <p className="home-progress-meet-meta">
                {formatCount(comparisonSummary.currentMeet.participantCount)}人 / {formatCount(comparisonSummary.currentMeet.resultCount)}記録
              </p>
            </article>
            <article
              className={`home-progress-meet home-progress-meet-previous${
                comparisonSummary.previousMeet ? "" : " is-empty"
              }`}
            >
              <p className="home-progress-meet-label">前回</p>
              {comparisonSummary.previousMeet ? (
                <>
                  <h3 className="home-progress-meet-title">
                    {formatMeetLabel(comparisonSummary.previousMeet)}
                  </h3>
                  <p className="home-progress-meet-date">{formatHeldOn(comparisonSummary.previousMeet.heldOn)}</p>
                  <p className="home-progress-meet-meta">
                    {formatCount(comparisonSummary.previousMeet.participantCount)}人 / {formatCount(comparisonSummary.previousMeet.resultCount)}記録
                  </p>
                </>
              ) : (
                <>
                  <h3 className="home-progress-meet-title">まだありません</h3>
                  <p className="home-progress-meet-date">次の記録会から比較できます</p>
                  <p className="home-progress-meet-meta">前回比の表示を準備中</p>
                </>
              )}
            </article>
          </div>
        </section>
      ) : null}
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
