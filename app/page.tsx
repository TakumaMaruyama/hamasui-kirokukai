import Link from "next/link";
import SearchForm from "./search-form";
import { prisma } from "@/lib/prisma";
import { formatImprovementTotal } from "@/lib/display-time";
import {
  getHomeMeetComparisonCards,
  type HomeMeetComparisonCard
} from "@/lib/home-meet-summary";
import { formatMeetLabel } from "@/lib/meet-context";
import { formatPublishRange } from "@/lib/publish";

function formatCount(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function formatComparisonPair(card: HomeMeetComparisonCard): string {
  if (card.currentMeet && card.previousMeet) {
    return `${formatMeetLabel(card.currentMeet)} ← ${formatMeetLabel(card.previousMeet)}`;
  }

  if (card.currentMeet) {
    return `${formatMeetLabel(card.currentMeet)} を基準に次回から表示`;
  }

  return "比較できる記録会がそろったら表示";
}

function renderCardBody(card: HomeMeetComparisonCard) {
  if (card.state === "ready") {
    if (card.totalImprovementMs > 0) {
      return (
        <>
          <h2 className="home-progress-title">
            前回からみんなで合計 {formatImprovementTotal(card.totalImprovementMs)}タイム更新
          </h2>
          <p className="home-progress-body">
            {formatCount(card.comparedEntryCount)}記録中{formatCount(card.improvedEntryCount)}記録更新
          </p>
        </>
      );
    }

    return (
      <>
        <h2 className="home-progress-title">今回はまだ前回超えなし</h2>
        <p className="home-progress-body">{formatCount(card.comparedEntryCount)}記録を比較</p>
      </>
    );
  }

  if (card.state === "not-comparable") {
    return (
      <>
        <h2 className="home-progress-title">比較できる記録がまだ少ない</h2>
        <p className="home-progress-body">
          同じ子・同じ種目の記録がまだ十分そろっていません。
        </p>
      </>
    );
  }

  return (
    <>
      <h2 className="home-progress-title">次回から表示</h2>
      <p className="home-progress-body">
        {card.state === "waiting-next-meet"
          ? "この回を基準に、次回から前回比を表示します。"
          : "さらに前の記録会が入ると、この枠も表示されます。"}
      </p>
    </>
  );
}

export default async function HomePage() {
  const [publishWindowResult, comparisonCardsResult] = await Promise.allSettled([
    prisma.publishWindow.findUnique({
      where: { id: "default" },
      select: {
        publishFrom: true,
        publishUntil: true,
        announcement: true
      }
    }),
    getHomeMeetComparisonCards()
  ]);

  const publishWindow =
    publishWindowResult.status === "fulfilled" ? publishWindowResult.value : null;
  const comparisonCards =
    comparisonCardsResult.status === "fulfilled" ? comparisonCardsResult.value : null;

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
      {comparisonCards ? (
        <section className="home-progress-grid" aria-label="みんなの前回比">
          {comparisonCards.map((card) => (
            <article
              key={card.slotLabel}
              className={`home-progress-card ${
                card.slotLabel === "今回"
                  ? "home-progress-card-current"
                  : "home-progress-card-previous"
              }${card.state === "unavailable" ? " is-empty" : ""}`}
            >
              <p className="home-progress-slot">{card.slotLabel}</p>
              {renderCardBody(card)}
              <p className="home-progress-pair">{formatComparisonPair(card)}</p>
            </article>
          ))}
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
