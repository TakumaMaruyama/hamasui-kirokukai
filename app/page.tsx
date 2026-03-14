import React from "react";
import Link from "next/link";
import SearchForm from "./search-form";
import { prisma } from "@/lib/prisma";
import { formatImprovementTotal } from "@/lib/display-time";
import {
  getHomeMeetComparisonCards,
  type HomeMeetComparisonCard
} from "@/lib/home-meet-summary";
import { formatPublishRange } from "@/lib/publish";

function formatCount(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function getComparisonCardTitle(card: HomeMeetComparisonCard): string {
  if (card.state === "ready") {
    return card.totalImprovementMs > 0
      ? `みんなで前より${formatImprovementTotal(card.totalImprovementMs)}タイムアップ`
      : "今回はまだ前回超えなし";
  }

  if (card.state === "not-comparable") {
    return "比較できる同一記録がまだ少ない";
  }

  if (card.state === "waiting-next-meet") {
    return "次回から前回比を表示";
  }

  return "さらに前の開催月が入ると表示";
}

function renderComparisonCardBody(card: HomeMeetComparisonCard) {
  if (card.state === "not-comparable") {
    return (
      <p className="home-progress-body">
        今回の開催月と前回の開催月で、同じ子・同じ種目がまだ十分そろっていません。次回以降に前回比を表示します。
      </p>
    );
  }

  if (card.state === "waiting-next-meet") {
    return (
      <p className="home-progress-body">
        まだ比較できる前回開催月がないため、次の開催月が入ると「前回より何秒速くなったか」を表示できます。
      </p>
    );
  }

  return null;
}

function renderComparisonCardMeetPanels(card: HomeMeetComparisonCard) {
  if (!card.currentMeet) {
    return null;
  }

  const previousPlaceholderDate =
    card.state === "waiting-older-month"
      ? "さらに前の開催月が入ると表示"
      : "次の開催月から比較できます";
  const previousPlaceholderMeta =
    card.state === "waiting-older-month" ? "前回の前回比を準備中" : "前回比の表示を準備中";

  return (
    <div className="home-progress-meets">
      <article className="home-progress-meet home-progress-meet-current">
        <p className="home-progress-meet-label">今回</p>
        <h3 className="home-progress-meet-title">{card.currentMeet.title}</h3>
        <p className="home-progress-meet-meta">{formatCount(card.currentMeet.resultCount)}記録</p>
      </article>
      <article
        className={`home-progress-meet home-progress-meet-previous${
          card.previousMeet ? "" : " is-empty"
        }`}
      >
        <p className="home-progress-meet-label">前回</p>
        {card.previousMeet ? (
          <>
            <h3 className="home-progress-meet-title">{card.previousMeet.title}</h3>
            <p className="home-progress-meet-meta">{formatCount(card.previousMeet.resultCount)}記録</p>
          </>
        ) : (
          <>
            <h3 className="home-progress-meet-title">まだありません</h3>
            <p className="home-progress-meet-date">{previousPlaceholderDate}</p>
            <p className="home-progress-meet-meta">{previousPlaceholderMeta}</p>
          </>
        )}
      </article>
    </div>
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
        <section className="home-progress-section" aria-label="みんなの前回比">
          <p className="home-progress-eyebrow">みんなの前回比</p>
          <div className="home-progress-grid">
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
                <h2 className="home-progress-title">{getComparisonCardTitle(card)}</h2>
                {renderComparisonCardBody(card)}
                {renderComparisonCardMeetPanels(card)}
              </article>
            ))}
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
