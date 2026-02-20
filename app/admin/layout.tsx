"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin";
  const href = isLoginPage ? "/" : "/admin/dashboard";
  const label = isLoginPage ? "トップページに戻る" : "メニューに戻る";

  return (
    <>
      {children}
      <Link href={href} className="admin-menu-return-button">
        {label}
      </Link>
    </>
  );
}
