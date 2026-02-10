import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatPublishUntil, isPublicNow, parsePublishUntilInput, toDateInputValue } from "@/lib/publish";

async function updatePublishUntil(formData: FormData) {
  "use server";

  const id = formData.get("id")?.toString();
  const publishUntilInput = formData.get("publishUntil")?.toString() ?? "";

  if (!id) {
    return;
  }

  const publishUntil = parsePublishUntilInput(publishUntilInput);

  await prisma.athlete.update({
    where: { id },
    data: { publishUntil }
  });

  revalidatePath("/admin/publish");
  revalidatePath(`/athletes/${id}`);
}

export default async function PublishPage() {
  const now = new Date();
  const athletes = await prisma.athlete.findMany({
    where: {
      results: {
        some: {
          meet: { program: "swimming" }
        }
      }
    },
    orderBy: [{ fullName: "asc" }, { grade: "asc" }],
    select: {
      id: true,
      fullName: true,
      grade: true,
      gender: true,
      publishUntil: true
    }
  });

  return (
    <main>
      <header>
        <h1>公開期限管理</h1>
        <p className="notice">公開期限が未設定または期限切れの選手は、検索結果と個人ページで非表示になります。</p>
      </header>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>氏名</th>
              <th>学年</th>
              <th>性別</th>
              <th>現在の公開期限</th>
              <th>状態</th>
              <th>編集</th>
            </tr>
          </thead>
          <tbody>
            {athletes.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "#888" }}>
                  対象の選手がいません
                </td>
              </tr>
            ) : (
              athletes.map((athlete) => (
                <tr key={athlete.id}>
                  <td>{athlete.fullName}</td>
                  <td>{athlete.grade}年</td>
                  <td>{athlete.gender}</td>
                  <td>{formatPublishUntil(athlete.publishUntil)}</td>
                  <td>{isPublicNow(athlete.publishUntil, now) ? "公開中" : "非公開"}</td>
                  <td>
                    <form action={updatePublishUntil} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="hidden" name="id" value={athlete.id} />
                      <input
                        type="date"
                        name="publishUntil"
                        defaultValue={toDateInputValue(athlete.publishUntil)}
                        style={{ width: 160 }}
                      />
                      <button type="submit" className="secondary" style={{ fontSize: "0.85rem", padding: "6px 12px" }}>
                        保存
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Link href="/admin/dashboard" className="admin-link">
        ← メニューに戻る
      </Link>
    </main>
  );
}
