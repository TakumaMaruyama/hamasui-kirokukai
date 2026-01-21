import ImportForm from "../import-form";

export default function SwimmingImportPage() {
  return (
    <main>
      <header>
        <h1>スイミングCSV取り込み</h1>
      </header>
      <div className="card">
        <ImportForm program="swimming" />
      </div>
    </main>
  );
}
