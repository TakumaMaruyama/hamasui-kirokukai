import DocsAction from "../docs-actions";

export default function SchoolDocsPage() {
  return (
    <main>
      <header>
        <h1>学校委託PDF生成</h1>
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
