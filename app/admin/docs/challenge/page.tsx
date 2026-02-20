import DocsAction from "../docs-actions";

export default function ChallengeDocsPage() {
  return (
    <main>
      <header>
        <h1>チャレンジコースPDF生成</h1>
        <p className="notice">
          年・月を指定して、種目ごとに男女左右で1〜3位ランキングを出力します。学年は最小学年から最大学年まで欠番なしで表示されます。
        </p>
      </header>
      <div className="card">
        <DocsAction
          title="ランキングPDFを生成（月ごと・男女左右1〜3位）"
          endpoint="/api/admin/docs/challenge/rankings"
          filename="challenge_rankings.zip"
          allowFullName={false}
          allowWeekday={false}
        />
      </div>
    </main>
  );
}
