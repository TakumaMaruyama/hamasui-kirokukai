import AdminLoginForm from "./login-form";

export default function AdminPage() {
  return (
    <main>
      <header>
        <h1>管理者ログイン</h1>
      </header>
      <div className="card">
        <AdminLoginForm />
      </div>
    </main>
  );
}
