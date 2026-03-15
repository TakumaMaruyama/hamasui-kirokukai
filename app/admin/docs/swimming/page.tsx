import DocsAction from "../docs-actions";

export default function SwimmingDocsPage() {
  return (
    <main>
      <header>
        <h1>一般コース記録証</h1>
        <p className="notice">
          記録証は1人1枚あたり4件まで掲載します。年・月指定で曜日を指定しない場合は、曜日順にまとめて1つのPDFへ出力します。
        </p>
        <p className="notice">
          記録証は年・月・曜日で絞り込めます。1位賞状は年・月必須で、氏名を入れるとその子どもの指定年月データだけを出力できます。
        </p>
        <p className="notice">
          1位賞状は、その年月内の各種目・学年別・男女別1位を対象に、条件に一致した全員分を1つのPDFにまとめて出力します。同タイ1位は全員出力します。
        </p>
        <p className="notice">
          ランキングは種目ごとに男女左右で1〜3位を出力し、小6までを対象に最小学年から最大学年まで欠番なしで表示します。中1以降は出力しません。
        </p>
      </header>
      <div className="card">
        <DocsAction
          title="記録証PDFを一括生成"
          endpoint="/api/admin/docs/swimming/records"
          filename="swimming_records.pdf"
        />
        <DocsAction
          title="賞状PDFを一括生成"
          endpoint="/api/admin/docs/swimming/certificates"
          filename="swimming_certificates.pdf"
          allowWeekday={false}
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
