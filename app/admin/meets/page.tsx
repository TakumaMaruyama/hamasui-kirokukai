import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatMeetLabel } from "@/lib/meet-context";
import DeleteMeetButton from "./DeleteMeetButton";

async function deleteMeet(formData: FormData) {
    "use server";
    const id = formData.get("id")?.toString();
    if (!id) return;

    // 関連するResultを先に削除
    await prisma.result.deleteMany({ where: { meetId: id } });
    await prisma.meet.delete({ where: { id } });
}

export default async function MeetsPage() {
    const meets = await prisma.meet.findMany({
        where: { program: "swimming" },
        include: {
            _count: { select: { results: true } }
        },
        orderBy: { heldOn: "desc" }
    });

    return (
        <main>
            <header>
                <h1>記録会管理</h1>
                <p className="notice">過去の記録会一覧です。CSVインポートで自動作成されます。</p>
            </header>
            <div className="card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>開催区分</th>
                            <th>記録数</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {meets.length === 0 ? (
                            <tr>
                                <td colSpan={3} style={{ textAlign: "center", color: "#888" }}>
                                    記録会がありません
                                </td>
                            </tr>
                        ) : (
                            meets.map((meet) => (
                                <tr key={meet.id}>
                                    <td>{formatMeetLabel(meet)}</td>
                                    <td>{meet._count.results}件</td>
                                    <td>
                                        <form action={deleteMeet} style={{ display: "inline" }}>
                                            <input type="hidden" name="id" value={meet.id} />
                                            <DeleteMeetButton meetLabel={formatMeetLabel(meet)} />
                                        </form>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div style={{ marginTop: 24 }}>
                <Link href="/admin/import/swimming">
                    <button>新しい記録をインポート</button>
                </Link>
            </div>
            <Link href="/admin/dashboard" className="admin-link">
                ← メニューに戻る
            </Link>
        </main>
    );
}
