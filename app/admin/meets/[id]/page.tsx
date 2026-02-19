import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma, Program } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatMeetLabel } from "@/lib/meet-context";

type PageProps = {
    params: { id: string };
    searchParams?: { program?: string | string[] };
};

type MeetPreview = Prisma.MeetGetPayload<{
    include: {
        results: {
            include: {
                athlete: {
                    select: {
                        fullName: true;
                        grade: true;
                        gender: true;
                    };
                };
                event: {
                    select: {
                        title: true;
                        distanceM: true;
                        style: true;
                    };
                };
            };
        };
    };
}>;

function isMissingDatabaseUrlError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    return error.message.includes("Environment variable not found: DATABASE_URL");
}

function toProgramQuery(value: string | string[] | undefined): Program | null {
    if (value === "swimming" || value === "school" || value === "challenge") {
        return value;
    }

    return null;
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

function formatGender(value: "male" | "female" | "other"): string {
    if (value === "male") {
        return "男";
    }

    if (value === "female") {
        return "女";
    }

    return "その他";
}

export default async function MeetPreviewPage({ params, searchParams }: PageProps) {
    const requestedProgram = toProgramQuery(searchParams?.program) ?? "swimming";
    let meet: MeetPreview | null = null;
    let loadMessage: string | null = null;

    try {
        meet = await prisma.meet.findUnique({
            where: { id: params.id },
            include: {
                results: {
                    include: {
                        athlete: {
                            select: {
                                fullName: true,
                                grade: true,
                                gender: true
                            }
                        },
                        event: {
                            select: {
                                title: true,
                                distanceM: true,
                                style: true
                            }
                        }
                    },
                    orderBy: [
                        { athlete: { fullName: "asc" } },
                        { event: { title: "asc" } },
                        { rank: "asc" },
                        { timeMs: "asc" }
                    ]
                }
            }
        });
    } catch (error) {
        console.error("[admin/meets/[id]] failed to load meet preview", error);
        if (isMissingDatabaseUrlError(error)) {
            loadMessage = "DATABASE_URL が未設定のため記録会を取得できません。環境変数を設定してから再度開いてください。";
        } else {
            loadMessage = "記録会プレビューの取得に失敗しました。DB接続とスキーマ反映状態を確認してください。";
        }
    }

    if (loadMessage) {
        return (
            <main>
                <header>
                    <h1>記録会プレビュー</h1>
                    <p className="notice" style={{ color: "#b00020" }}>{loadMessage}</p>
                </header>
                <Link
                    href={`/admin/meets?program=${requestedProgram}`}
                    style={{ color: "#4d5564", textDecoration: "none", fontSize: "0.9rem" }}
                >
                    ← 記録会管理に戻る
                </Link>
            </main>
        );
    }

    if (!meet) {
        notFound();
    }

    const athleteCount = new Set(meet.results.map((result) => result.athleteId)).size;
    const eventCount = new Set(meet.results.map((result) => result.eventId)).size;
    const backProgram = toProgramQuery(searchParams?.program) ?? meet.program;

    return (
        <main>
            <header>
                <h1>記録会プレビュー</h1>
                <p className="notice">{formatMeetLabel(meet)}</p>
            </header>

            <section className="card">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(160px, 1fr))", gap: 12 }}>
                    <p style={{ margin: 0 }}>
                        <strong>開催日:</strong> {meet.heldOn.toISOString().slice(0, 10)}
                    </p>
                    <p style={{ margin: 0 }}>
                        <strong>登録日時:</strong> {formatAdminDateTime(meet.createdAt)}
                    </p>
                    <p style={{ margin: 0 }}>
                        <strong>記録数:</strong> {meet.results.length}件
                    </p>
                    <p style={{ margin: 0 }}>
                        <strong>人数/種目:</strong> {athleteCount}人 / {eventCount}種目
                    </p>
                </div>
            </section>

            <section className="card" style={{ marginTop: 16 }}>
                {meet.results.length === 0 ? (
                    <p className="notice">この記録会には記録がありません。</p>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>氏名</th>
                                <th>学年</th>
                                <th>性別</th>
                                <th>種目</th>
                                <th>距離</th>
                                <th>泳法</th>
                                <th>レーン</th>
                                <th>タイム</th>
                                <th>順位</th>
                            </tr>
                        </thead>
                        <tbody>
                            {meet.results.map((result) => (
                                <tr key={result.id}>
                                    <td>{result.athlete.fullName}</td>
                                    <td>{result.athlete.grade}</td>
                                    <td>{formatGender(result.athlete.gender)}</td>
                                    <td>{result.event.title}</td>
                                    <td>{result.event.distanceM}m</td>
                                    <td>{result.event.style}</td>
                                    <td>{result.lane ?? "-"}</td>
                                    <td>{result.timeText}</td>
                                    <td>{result.rank > 0 ? `${result.rank}位` : "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            <p style={{ marginTop: 16 }}>
                <Link
                    href={`/admin/meets?program=${backProgram}`}
                    style={{ color: "#4d5564", textDecoration: "none", fontSize: "0.9rem" }}
                >
                    ← 記録会管理に戻る
                </Link>
            </p>
        </main>
    );
}
