import ImportForm from "../import-form";

export default function SchoolImportPage() {
  return (
    <main>
      <header>
        <h1>小学校水泳授業インポート</h1>
        <p className="notice">
          種目名はCSVに入力した名称をそのまま記録証へ表示します。欠席者はタイム欄に「a」を入力してください。
        </p>
      </header>
      <div className="card">
        <ImportForm program="school" />
      </div>
    </main>
  );
}
