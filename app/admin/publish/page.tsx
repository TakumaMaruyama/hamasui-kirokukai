import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatPublishRange, parsePublishDateInput, toDateInputValue } from "@/lib/publish";

async function updatePublishWindow(formData: FormData) {
  "use server";

  const publishFromInput = formData.get("publishFrom")?.toString() ?? "";
  const publishUntilInput = formData.get("publishUntil")?.toString() ?? "";
  const announcementInput = formData.get("announcement")?.toString() ?? "";
  const announcement = announcementInput.trim() ? announcementInput.trim() : null;
  const publishFrom = parsePublishDateInput(publishFromInput, "start");
  const publishUntil = parsePublishDateInput(publishUntilInput, "end");

  if (publishFrom && publishUntil && publishFrom.getTime() > publishUntil.getTime()) {
    throw new Error("公開期間の開始日は終了日以前にしてください");
  }

  await prisma.publishWindow.upsert({
    where: { id: "default" },
    update: {
      publishFrom,
      publishUntil,
      announcement
    },
    create: {
      id: "default",
      publishFrom,
      publishUntil,
      announcement
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
          <h1>公開期間・お知らせ</h1>
          <p className="notice">ユーザー画面に表示する公開期限の案内文とお知らせを設定します。</p>
        </header>
        <div className="card">
          <p className="notice" style={{ marginBottom: 16 }}>
            現在の表示: {formatPublishRange(publishWindow.publishFrom, publishWindow.publishUntil)}
          </p>
          <p className="notice" style={{ marginBottom: 16 }}>
            現在のお知らせ: {publishWindow.announcement?.trim() || "未設定"}
          </p>
          <form action={updatePublishWindow} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="notice">開始日</span>
              <input
                type="date"
                name="publishFrom"
                defaultValue={toDateInputValue(publishWindow.publishFrom)}
                style={{ width: 220 }}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="notice">終了日</span>
              <input
                type="date"
                name="publishUntil"
                defaultValue={toDateInputValue(publishWindow.publishUntil)}
                style={{ width: 220 }}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="notice">お知らせ</span>
              <textarea
                name="announcement"
                defaultValue={publishWindow.announcement ?? ""}
                rows={4}
                placeholder="タイトル下に表示するお知らせを入力"
              />
            </label>
            <button type="submit" className="secondary" style={{ fontSize: "0.9rem", padding: "8px 14px" }}>
              保存
            </button>
          </form>
        </div>
      </main>
    );
  } catch {
    return (
      <main>
        <header>
          <h1>公開期間・お知らせ</h1>
          <p className="notice">公開期間設定テーブルが未作成です。`npx prisma db push` を実行してください。</p>
        </header>
      </main>
    );
  }
}
