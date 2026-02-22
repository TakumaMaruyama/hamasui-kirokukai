import ImportForm from "../import-form";

export default function SchoolImportPage() {
  return (
    <main>
      <header>
        <h1>小学校水泳授業インポート</h1>
      </header>
      <div className="card">
        <ImportForm program="school" />
      </div>
    </main>
  );
}
