import DocsAction from "../docs-actions";

export default function SwimmingDocsPage() {
  return (
    <main>
      <header>
        <h1>スイミングPDF生成</h1>
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
      </div>
    </main>
  );
}
