import Link from "next/link";

export default function AdminDashboard() {
    return (
        <main>
            <header>
                <h1>管理者メニュー</h1>
            </header>
            <div className="card">
                <nav className="admin-nav">
                    <Link href="/admin/meets" className="admin-menu-item">
                        <span className="admin-menu-icon">🏆</span>
                        <span className="admin-menu-label">記録会管理</span>
                    </Link>
                    <Link href="/admin/import/swimming" className="admin-menu-item">
                        <span className="admin-menu-icon">📊</span>
                        <span className="admin-menu-label">水泳記録インポート</span>
                    </Link>
                    <Link href="/admin/import/school" className="admin-menu-item">
                        <span className="admin-menu-icon">🏫</span>
                        <span className="admin-menu-label">学校名インポート</span>
                    </Link>
                    <Link href="/admin/publish" className="admin-menu-item">
                        <span className="admin-menu-icon">🔓</span>
                        <span className="admin-menu-label">公開期限管理</span>
                    </Link>
                    <Link href="/admin/docs/swimming" className="admin-menu-item">
                        <span className="admin-menu-icon">📄</span>
                        <span className="admin-menu-label">水泳証明書</span>
                    </Link>
                    <Link href="/admin/docs/school" className="admin-menu-item">
                        <span className="admin-menu-icon">📋</span>
                        <span className="admin-menu-label">学校証明書</span>
                    </Link>
                    <Link href="/admin/logs" className="admin-menu-item">
                        <span className="admin-menu-icon">📝</span>
                        <span className="admin-menu-label">ログ</span>
                    </Link>
                </nav>
            </div>
            <Link href="/" className="admin-link">
                ← トップに戻る
            </Link>
        </main>
    );
}
