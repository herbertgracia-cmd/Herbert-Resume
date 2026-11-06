// Rebuilds public/Herbert-Gracia-Resume.pdf (the file the "Resume (PDF)" buttons download)
// from the site's print layout. Start the site first (npm run dev), then run:
//   node scripts/make-resume-pdf.mjs [http://localhost:8787]
// Needs Playwright. If it isn't installed: npm install --no-save playwright && npx playwright install chromium
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const url = process.argv[2] || "http://localhost:8787/";
const out = fileURLToPath(new URL("../public/Herbert-Gracia-Resume.pdf", import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.emulateMedia({ media: "print" });
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: out, format: "Letter", printBackground: false });
await browser.close();
console.log(`Wrote ${out}`);
