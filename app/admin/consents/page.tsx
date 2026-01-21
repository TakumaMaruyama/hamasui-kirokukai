import { prisma } from "@/lib/prisma";

async function updateConsent(formData: FormData) {
  "use server";
  const id = formData.get("id")?.toString();
  const publishConsent = formData.get("publishConsent") === "on";
  const publishUntilValue = formData.get("publishUntil")?.toString();

  if (!id) return;

  await prisma.athlete.update({
    where: { id },
    data: {
      publishConsent,
      publishUntil: publishUntilValue ? new Date(publishUntilValue) : null
    }
  });
}

export default async function ConsentsPage() {
  const athletes = await prisma.athlete.findMany({
    orderBy: { fullName: "asc" }
  });

  return (
    <main>
      <header>
        <h1>同意管理</h1>
      </header>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>氏名</th>
              <th>同意</th>
              <th>公開期限</th>
              <th>更新</th>
            </tr>
          </thead>
          <tbody>
            {athletes.map((athlete) => (
              <tr key={athlete.id}>
                <td>{athlete.fullName}</td>
                <td>
                  <form action={updateConsent}>
                    <input type="hidden" name="id" value={athlete.id} />
                    <input
                      type="checkbox"
                      name="publishConsent"
                      defaultChecked={athlete.publishConsent}
                    />
                    <input
                      type="date"
                      name="publishUntil"
                      defaultValue={
                        athlete.publishUntil
                          ? athlete.publishUntil.toISOString().slice(0, 10)
                          : ""
                      }
                      style={{ marginLeft: 8 }}
                    />
                    <button type="submit" className="secondary" style={{ marginLeft: 8 }}>
                      更新
                    </button>
                  </form>
                </td>
                <td>{athlete.publishUntil?.toISOString().slice(0, 10) ?? ""}</td>
                <td className="notice">フォーム内で更新</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
