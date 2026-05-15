// HTML → PDF.
// On Vercel / AWS Lambda: uses puppeteer-core + @sparticuz/chromium (serverless-safe).
// Locally: uses the full `puppeteer` package which bundles its own Chromium.
const IS_SERVERLESS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export async function htmlToPdf(html: string): Promise<Buffer> {
  if (IS_SERVERLESS) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = await import("puppeteer-core");
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", right: "16mm", bottom: "20mm", left: "16mm" },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "16mm", bottom: "20mm", left: "16mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
