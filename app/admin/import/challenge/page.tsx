import ImportForm from "../import-form";

export default function ChallengeImportPage() {
  return (
    <main>
      <header>
        <h1>チャレンジコースCSV取り込み</h1>
        <p className="notice">学年は年少〜高校3年生のみ取り込みます（範囲外は除外）。</p>
      </header>
      <div className="card">
        <ImportForm program="challenge" />
      </div>
    </main>
  );
}
