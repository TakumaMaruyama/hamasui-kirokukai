import ChallengeDocsActions from "./challenge-docs-actions";

export default function ChallengeDocsPage() {
  return (
    <main>
      <header>
        <h1>チャレンジコースランキング</h1>
        <p className="notice">
          対象年月のチャレンジコース記録を、種目・学年・男女ごとに全員掲載したランキングPDFとして出力します。
        </p>
      </header>
      <div className="card">
        <ChallengeDocsActions />
      </div>
    </main>
  );
}
