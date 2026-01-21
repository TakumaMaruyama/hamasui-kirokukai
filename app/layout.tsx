import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "浜水記録会",
  description: "スイミング記録会の記録閲覧",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
      </body>
    </html>
  );
}
