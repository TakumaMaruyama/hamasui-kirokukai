import { Program } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatMeetLabel } from "@/lib/meet-context";
import DeleteMeetButton from "./DeleteMeetButton";

const PROGRAM_OPTIONS = [
    { value: "swimming", label: "スイミング" },
    { value: "school", label: "学校委託" },
    { value: "challenge", label: "チャレンジコース" }
] as const;

type AdminProgram = (typeof PROGRAM_OPTIONS)[number]["value"];
type MeetWithCount = {
    id: string;
    program: Program;
    heldOn: Date;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    _count: {
        results: number;
    };
};

function toAdminProgram(value: string | string[] | undefined): AdminProgram {
    if (value === "school" || value === "challenge") {
        return value;
    }

    return "swimming";
}

function isMissingChallengeProgramError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    return (
        error.message.includes("Invalid value for argument `program`") &&
        error.message.includes('program: "challenge"')
    );
}

function isMissingChallengeProgramInDatabaseError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    return /invalid input value for enum .*Program.*challenge/i.test(error.message);
}

function isMissingDatabaseUrlError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    return error.message.includes("Environment variable not found: DATABASE_URL");
}

function hasChallengeInRuntimeProgramEnum(): boolean {
    if (!Program || typeof Program !== "object") {
        return false;
    }

    return Object.values(Program).includes("challenge");
}

function formatAdminDateTime(value: Date): string {
    return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    }).format(value);
}

async function deleteMeet(formData: FormData) {
    "use server";
    const id = formData.get("id")?.toString();
    if (!id) return;

    // 関連するResultを先に削除
    await prisma.result.deleteMany({ where: { meetId: id } });
    await prisma.meet.delete({ where: { id } });
}

export default async function MeetsPage({
    searchParams
}: {
    searchParams?: { program?: string | string[] };
}) {
    const selectedProgram = toAdminProgram(searchParams?.program);
    const selectedProgramLabel = PROGRAM_OPTIONS.find((option) => option.value === selectedProgram)?.label ?? "スイミング";

    let meets: MeetWithCount[] = [];
    let loadMessage: string | null = null;

    if (selectedProgram === "challenge" && !hasChallengeInRuntimeProgramEnum()) {
        loadMessage = "チャレンジコースのPrisma Clientが古い可能性があります。アプリを再起動/再デプロイしてください。";
    }

    try {
        if (!loadMessage) {
            meets = await prisma.meet.findMany({
                where: { program: selectedProgram },
                include: {
                    _count: { select: { results: true } }
                },
                orderBy: [{ heldOn: "desc" }, { createdAt: "desc" }]
            });
        }
    } catch (error) {
        console.error("[admin/meets] failed to load meets", error);

        if (selectedProgram === "challenge" && isMissingChallengeProgramError(error)) {
            loadMessage = "チャレンジコースのPrisma Clientが古い可能性があります。アプリを再起動/再デプロイしてください。";
        } else if (selectedProgram === "challenge" && isMissingChallengeProgramInDatabaseError(error)) {
            loadMessage = "チャレンジコースのDB設定が未反映です。実行中アプリと同じDATABASE_URLに `Program.challenge` を反映してください（例: npx prisma db push）。";
        } else if (isMissingDatabaseUrlError(error)) {
            loadMessage = "DATABASE_URL が未設定のため記録会を取得できません。環境変数を設定してから再度開いてください。";
        } else {
            loadMessage = "記録会の取得に失敗しました。DB接続とスキーマ反映状態を確認して、しばらくしてから再度お試しください。";
        }
    }

    return (
        <main>
            <header>
                <h1>記録会管理</h1>
                <p className="notice">過去の記録会一覧です。CSVインポートで自動作成されます。</p>
                <p className="notice">表示中: {selectedProgramLabel}</p>
                <p className="notice">同じ年月・曜日を複数回取り込んだ場合は末尾に連番が付き、個別に削除できます。</p>
                {loadMessage ? (
                    <p className="notice" style={{ color: "#b00020" }}>{loadMessage}</p>
                ) : null}
            </header>
            <div className="card">
                <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {PROGRAM_OPTIONS.map((option) => (
                        <Link
                            key={option.value}
                            href={`/admin/meets?program=${option.value}`}
                            style={{
                                padding: "6px 12px",
                                borderRadius: 999,
                                textDecoration: "none",
                                border: option.value === selectedProgram ? "1px solid #2f5cff" : "1px solid #d5d7de",
                                color: option.value === selectedProgram ? "#2f5cff" : "#1b1b1f",
                                background: option.value === selectedProgram ? "#eef2ff" : "#fff"
                            }}
                        >
                            {option.label}
                        </Link>
                    ))}
                </div>
                <table className="table">
                    <thead>
                        <tr>
                            <th>開催区分</th>
                            <th>登録日時</th>
                            <th>記録数</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {meets.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={{ textAlign: "center", color: "#888" }}>
                                    記録会がありません
                                </td>
                            </tr>
                        ) : (
                            meets.map((meet) => (
                                <tr key={meet.id}>
                                    <td>{formatMeetLabel(meet)}</td>
                                    <td>{formatAdminDateTime(meet.createdAt)}</td>
                                    <td>{meet._count.results}件</td>
                                    <td>
                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                            <Link
                                                href={`/admin/meets/${meet.id}?program=${selectedProgram}`}
                                                className="secondary"
                                                style={{
                                                    fontSize: "0.85rem",
                                                    padding: "6px 12px",
                                                    textDecoration: "none",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    borderRadius: 999,
                                                    background: "#4d5564",
                                                    color: "#fff"
                                                }}
                                            >
                                                プレビュー
                                            </Link>
                                            <form action={deleteMeet} style={{ display: "inline" }}>
                                                <input type="hidden" name="id" value={meet.id} />
                                                <DeleteMeetButton meetLabel={formatMeetLabel(meet)} />
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div style={{ marginTop: 24 }}>
                <Link href={`/admin/import/${selectedProgram}`}>
                    <button>新しい記録をインポート</button>
                </Link>
            </div>
        </main>
    );
}
