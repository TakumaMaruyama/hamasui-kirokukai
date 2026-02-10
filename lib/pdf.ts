import { chromium } from "playwright";

export async function renderPdfFromHtml(html: string): Promise<Buffer> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const buffer = await page.pdf({ format: "A4" });
    await page.close();
    return buffer;
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF生成に失敗しました";
    if (message.includes("Executable doesn't exist")) {
      throw new Error("PlaywrightのChromiumが未インストールです。`npx playwright install chromium` を実行してください。");
    }

    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
