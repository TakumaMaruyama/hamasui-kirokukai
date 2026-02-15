import DocsAction from "../docs-actions";

export default function ChallengeDocsPage() {
  return (
    <main>
      <header>
        <h1>チャレンジコースPDF生成</h1>
        <p className="notice">年・月を指定して、チャレンジコース内の月次ランキングを全順位で出力します。</p>
      </header>
      <div className="card">
        <DocsAction
          title="ランキングPDFを生成（月ごと・全順位）"
          endpoint="/api/admin/docs/challenge/rankings"
          filename="challenge_rankings.zip"
          allowFullName={false}
          allowWeekday={false}
        />
      </div>
    </main>
  );
}
