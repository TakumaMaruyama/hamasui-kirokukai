import ImportForm from "../import-form";

export default function SwimmingImportPage() {
  return (
    <main>
      <header>
        <h1>一般コース インポート</h1>
      </header>
      <div className="card">
        <ImportForm program="swimming" />
      </div>
    </main>
  );
}
