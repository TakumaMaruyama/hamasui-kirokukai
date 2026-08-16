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

function renderComparisonCardTitle(card: HomeMeetComparisonCard) {
  if (card.state === "ready") {
    if (card.totalImprovementMs > 0) {
      return `みんなで前より${formatImprovementTotal(card.totalImprovementMs)}タイムアップ`;
    }

    if (card.totalImprovementMs < 0) {
      return `みんなで前より${formatImprovementTotal(Math.abs(card.totalImprovementMs))}タイムダウン`;
    }

    return "みんなで前回と変化なし";
  }

  if (card.state === "not-comparable") {
    return "比較できる同一記録がまだ少ない";
  }

  if (card.state === "waiting-next-meet") {
    return "次回から前回比を表示";
  }

  return "さらに前の開催月が入ると表示";
}

function renderComparisonCardHeader(card: HomeMeetComparisonCard) {
  return (
    <div className="home-progress-header">
      {card.currentMeet ? (
        <>
          <p className="home-progress-slot">対象年月：{card.currentMeet.title}</p>
          <p className="home-progress-summary">
            {formatCount(card.currentMeet.resultCount)}記録
          </p>
          {card.previousMeet ? (
            <p className="home-progress-compare">比較対象：{card.previousMeet.title}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
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
        <section className="home-progress-section">
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
                {renderComparisonCardHeader(card)}
                <h2 className="home-progress-title">{renderComparisonCardTitle(card)}</h2>
                {renderComparisonCardBody(card)}
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
