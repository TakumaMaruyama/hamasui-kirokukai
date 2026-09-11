import SwimmingDocsActions from "./swimming-docs-actions";

export default function SwimmingDocsPage() {
  return (
    <main>
      <header>
        <h1>一般コース記録証</h1>
        <p className="notice">
          記録証は1人1枚あたり4件まで掲載します。年・月指定で曜日を指定しない場合は、曜日順にまとめて1つのPDFへ出力します。
        </p>
        <p className="notice">
          登録済みの対象年月を一度選ぶと、記録証・1位賞状・ランキング・歴代1位記録一覧に共通で使えます。
        </p>
        <p className="notice">
          1位賞状は、その年月内の各種目・学年別・男女別1位を対象に、条件に一致した全員分を1つのPDFにまとめて出力します。同タイ1位は全員出力します。指定した氏名が1位でない場合は出力されません。
        </p>
        <p className="notice">
          ランキングは種目ごとに男女左右で1〜3位を出力し、小6までを対象に最小学年から最大学年まで欠番なしで表示します。中1以降は出力しません。
        </p>
      </header>
      <div className="card">
        <SwimmingDocsActions />
      </div>
    </main>
  );
}
