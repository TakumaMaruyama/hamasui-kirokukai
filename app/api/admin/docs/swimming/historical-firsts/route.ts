import { generateSwimmingDocumentResponse } from "@/lib/swimming-docs-response";

export const runtime = "nodejs";

export function POST(request: Request) {
  return generateSwimmingDocumentResponse(request, "historical-firsts");
}
