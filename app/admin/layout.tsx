import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Link href="/admin/dashboard" className="admin-menu-return-button">
        メニューに戻る
      </Link>
    </>
  );
}
