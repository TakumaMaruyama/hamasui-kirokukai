import ImportForm from "../import-form";

export default function SchoolImportPage() {
  return (
    <main>
      <header>
        <h1>学校委託CSV取り込み</h1>
      </header>
      <div className="card">
        <ImportForm program="school" />
      </div>
    </main>
  );
}
