import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "./admin-auth";
import { buildAttachmentContentDisposition } from "./content-disposition";
import { parseDocsFilterInput } from "./docs-filter";
import { ChallengeDocsInputError, prepareChallengeRanking } from "./challenge-docs";

export function challengeDocsErrorResponse(error: unknown) {
  if (error instanceof ChallengeDocsInputError) return NextResponse.json({ message: error.message }, { status: 400 });
  console.error("Challenge document generation failed", error);
  return NextResponse.json({ message: "記録の取得・PDF生成に失敗しました。時間をおいて再度お試しください。" }, { status: 500 });
}

export async function challengeRankingResponse(request: Request, mode: "preview" | "download") {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ message: "再度ログインしてください。" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = parseDocsFilterInput(body);
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: 400 });
  try {
    const document = await prepareChallengeRanking(parsed.value);
    if (mode === "preview") {
      return NextResponse.json(document.preview, { headers: { "Cache-Control": "no-store" } });
    }
    if (document.preview.counts.records === 0) {
      return NextResponse.json({ message: "条件に一致するランキングデータがありません" }, { status: 400 });
    }
    const { renderChallengeRankingPdf } = await import("./pdf");
    const buffer = await renderChallengeRankingPdf({
      periodLabel: document.periodLabel, groups: document.preview.groups, rankRange: "all"
    });
    return new NextResponse(buffer, { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": buildAttachmentContentDisposition(document.preview.filename, "challenge_rankings.pdf"),
      "Cache-Control": "no-store"
    } });
  } catch (error) {
    return challengeDocsErrorResponse(error);
  }
}
