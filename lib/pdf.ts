import { chromium } from "playwright";

export async function renderPdfFromHtml(html: string): Promise<Buffer> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  const buffer = await page.pdf({ format: "A4" });
  await browser.close();
  return buffer;
}
