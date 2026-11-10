// Rebuilds public/Herbert-Gracia-Resume.pdf (the file the "Download resume" buttons download)
// from the site's print layout. Start the site first (npm run dev), then run:
//   node scripts/make-resume-pdf.mjs [http://localhost:8787]
//
// Headline versions for job applications (same resume, only the line under the name changes):
//   node scripts/make-resume-pdf.mjs --headline "Creative Director" --out applications/resumes/Herbert-Gracia-Resume-Creative-Director.pdf
//
// Needs Playwright. If it isn't installed: npm install --no-save playwright && npx playwright install chromium
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : null;
};
const headline = flag("--headline");
const outArg = flag("--out");
const url = args[0] || "http://localhost:8787/";
const out = outArg ? resolve(outArg) : fileURLToPath(new URL("../public/Herbert-Gracia-Resume.pdf", import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.emulateMedia({ media: "print" });
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
if (headline) {
  // Only the headline under the name changes; everything else matches the site.
  await page.evaluate((text) => { document.querySelector(".hero-role").textContent = text; }, headline);
}
await page.pdf({ path: out, format: "Letter", printBackground: false, tagged: true, outline: true });
await browser.close();
console.log(`Wrote ${out}`);
