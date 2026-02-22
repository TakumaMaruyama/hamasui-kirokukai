import DocsAction from "../docs-actions";

export default function SwimmingDocsPage() {
  return (
    <main>
      <header>
        <h1>一般コース記録証</h1>
        <p className="notice">
          記録証・賞状は年・月・曜日で絞り込めます。氏名を入れると、その子どもの指定年月データだけを出力できます。
        </p>
        <p className="notice">
          ランキングは種目ごとに男女左右で1〜3位を出力し、学年は最小学年から最大学年まで欠番なしで表示されます。
        </p>
      </header>
      <div className="card">
        <DocsAction
          title="記録証PDFを一括生成"
          endpoint="/api/admin/docs/swimming/records"
          filename="swimming_records.zip"
        />
        <DocsAction
          title="賞状PDFを一括生成"
          endpoint="/api/admin/docs/swimming/certificates"
          filename="swimming_certificates.zip"
        />
        <DocsAction
          title="ランキングPDFを生成（月ごと・男女左右1〜3位）"
          endpoint="/api/admin/docs/swimming/rankings"
          filename="swimming_rankings.zip"
          allowFullName={false}
          allowWeekday={false}
        />
        <DocsAction
          title="歴代1位記録一覧PDFを生成（月末時点・新規1位に★）"
          endpoint="/api/admin/docs/swimming/historical-firsts"
          filename="swimming_historical_firsts.zip"
          allowFullName={false}
          allowWeekday={false}
        />
      </div>
    </main>
  );
}
