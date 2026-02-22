import DocsAction from "../docs-actions";

export default function SchoolDocsPage() {
  return (
    <main>
      <header>
        <h1>小学校記録証</h1>
        <p className="notice">
          年・月・曜日で絞り込めます。氏名を入れると、その子どもの指定年月データだけを出力できます。
        </p>
      </header>
      <div className="card">
        <DocsAction
          title="記録証PDFを一括生成"
          endpoint="/api/admin/docs/school/records"
          filename="school_records.zip"
        />
      </div>
    </main>
  );
}
