import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatPublishRange, parsePublishDateInput, toDateInputValue } from "@/lib/publish";

async function updatePublishWindow(formData: FormData) {
  "use server";

  const publishFromInput = formData.get("publishFrom")?.toString() ?? "";
  const publishUntilInput = formData.get("publishUntil")?.toString() ?? "";
  const publishFrom = parsePublishDateInput(publishFromInput, "start");
  const publishUntil = parsePublishDateInput(publishUntilInput, "end");

  if (publishFrom && publishUntil && publishFrom.getTime() > publishUntil.getTime()) {
    throw new Error("公開期間の開始日は終了日以前にしてください");
  }

  await prisma.publishWindow.upsert({
    where: { id: "default" },
    update: {
      publishFrom,
      publishUntil
    },
    create: {
      id: "default",
      publishFrom,
      publishUntil
    }
  });

  revalidatePath("/admin/publish");
  revalidatePath("/");
}

export default async function PublishPage() {
  try {
    const publishWindow = await prisma.publishWindow.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" }
    });

    return (
      <main>
        <header>
          <h1>公開期間表示管理</h1>
          <p className="notice">ユーザー画面に表示する公開期限の案内文を設定します。</p>
        </header>
        <div className="card">
          <p className="notice" style={{ marginBottom: 16 }}>
            現在の表示: {formatPublishRange(publishWindow.publishFrom, publishWindow.publishUntil)}
          </p>
          <form action={updatePublishWindow} style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="notice">開始日</span>
              <input
                type="date"
                name="publishFrom"
                defaultValue={toDateInputValue(publishWindow.publishFrom)}
                style={{ width: 180 }}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="notice">終了日</span>
              <input
                type="date"
                name="publishUntil"
                defaultValue={toDateInputValue(publishWindow.publishUntil)}
                style={{ width: 180 }}
              />
            </label>
            <button type="submit" className="secondary" style={{ fontSize: "0.9rem", padding: "8px 14px" }}>
              保存
            </button>
          </form>
        </div>

        <Link href="/admin/dashboard" className="admin-link">
          ← メニューに戻る
        </Link>
      </main>
    );
  } catch {
    return (
      <main>
        <header>
          <h1>公開期間表示管理</h1>
          <p className="notice">公開期間設定テーブルが未作成です。`npx prisma db push` を実行してください。</p>
        </header>
        <Link href="/admin/dashboard" className="admin-link">
          ← メニューに戻る
        </Link>
      </main>
    );
  }
}
