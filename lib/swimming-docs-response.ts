import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "./admin-auth";
import { buildAttachmentContentDisposition } from "./content-disposition";
import { parseDocsFilterInput } from "./docs-filter";
import { prepareSwimmingDocument, SwimmingDocsInputError } from "./swimming-docs";
import type { SwimmingDocumentKind } from "./swimming-docs-types";

export function swimmingDocsErrorResponse(error: unknown) {
  if (error instanceof SwimmingDocsInputError) return NextResponse.json({ message: error.message }, { status: 400 });
  console.error("Swimming document generation failed", error);
  return NextResponse.json({ message: "記録の取得・PDF生成に失敗しました。時間をおいて再度お試しください。" }, { status: 500 });
}

export async function generateSwimmingDocumentResponse(request: Request, kind: SwimmingDocumentKind) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ message: "ログインの有効期限が切れました。再度ログインしてください。" }, { status: 401 });
  // Keep the existing no-filter record request compatible.
  const rawBody = await request.json().catch(() => ({}));
  const parsed = parseDocsFilterInput(rawBody);
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: 400 });
  try {
    const document = await prepareSwimmingDocument(kind, parsed.value);
    if (document.preview.items.length === 0) {
      const message = kind === "certificates" ? "条件に一致する賞状対象がありません" : kind === "records" ? "条件に一致する記録がありません" : "ランキング対象データがありません";
      return NextResponse.json({ message }, { status: 400 });
    }
    const pdf = await import("./pdf");
    const buffer = document.kind === "records"
      ? await pdf.renderRecordCertificatesPdf(document.inputs)
      : document.kind === "certificates"
        ? await pdf.renderFirstPrizeAwardsPdf(document.inputs)
        : await pdf.renderChallengeRankingPdf({ periodLabel: document.periodLabel, groups: document.groups, highlightLegend: "NEW はこの月に新しく歴代1位になった記録", rankRange: { min: 1, max: 1 } });
    return new NextResponse(buffer, { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": buildAttachmentContentDisposition(document.filename, `swimming_${kind.replace(/-/g, "_")}.pdf`),
      "Cache-Control": "no-store"
    } });
  } catch (error) {
    return swimmingDocsErrorResponse(error);
  }
}
