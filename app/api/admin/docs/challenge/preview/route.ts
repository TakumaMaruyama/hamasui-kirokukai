import { challengeRankingResponse } from "@/lib/challenge-docs-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return challengeRankingResponse(request, "preview");
}
