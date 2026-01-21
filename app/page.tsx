import SearchForm from "./search-form";

export default function HomePage() {
  return (
    <main>
      <header>
        <h1>浜水記録会 記録検索</h1>
        <p className="notice">フルネーム完全一致で検索できます。</p>
      </header>
      <div className="card">
        <SearchForm />
      </div>
    </main>
  );
}
