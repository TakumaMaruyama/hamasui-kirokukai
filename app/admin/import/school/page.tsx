import ImportForm from "../import-form";

export default function SchoolImportPage() {
  return (
    <main>
      <header>
        <h1>小学校水泳授業インポート</h1>
        <p className="notice">
          出席者の種目名はCSVの名称をそのまま記録証へ表示します。欠席者は種目名を空欄にして、
          タイム欄に「a」を入力してください。簡易CSVはファイル名を学校名として扱います。
        </p>
      </header>
      <div className="card">
        <ImportForm program="school" />
      </div>
    </main>
  );
}
