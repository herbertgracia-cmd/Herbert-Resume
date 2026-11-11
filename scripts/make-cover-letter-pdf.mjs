// Turns a cover letter written by the cover-letter-writer agent (applications/<job>/cover-letter.md)
// into a one-page PDF to upload with an application. Only the letter body (after the "---" line) is used.
//   node scripts/make-cover-letter-pdf.mjs <cover-letter.md> <out.pdf> ["Headline under the name"]
// Use the same headline as the resume version sent with it (default: the site's headline).
// Needs Playwright (run node with NODE_PATH=$(npm root -g) in the cloud workspace).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const [src, outArg, headlineArg] = process.argv.slice(2);
if (!src || !outArg) {
  console.error("Usage: node scripts/make-cover-letter-pdf.mjs <cover-letter.md> <out.pdf>");
  process.exit(1);
}

const content = JSON.parse(readFileSync(new URL("../public/content.json", import.meta.url), "utf8"));
const md = readFileSync(src, "utf8");
const body = md.includes("\n---") ? md.slice(md.indexOf("\n---") + 4) : md;
// Drop the signature block (name, email, site): the letterhead and closing below cover it.
const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  .filter((p) => !/^Herbert Gracia\b/.test(p));
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const site = (content.links?.website || "").replace(/^https?:\/\//, "");
const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: Letter; margin: 0.8in 0.9in; }
  body { font: 10.5pt/1.5 Inter, "Helvetica Neue", Arial, sans-serif; color: #111; }
  h1 { font: 400 24pt/1.1 Georgia, "Times New Roman", serif; margin: 0; }
  .role { margin: 2pt 0 0; font-size: 10.5pt; }
  .contact { margin: 4pt 0 18pt; font-size: 9pt; color: #333; padding-bottom: 8pt; border-bottom: 1px solid #000; }
  p { margin: 0 0 9pt; }
  .date { margin-bottom: 14pt; }
  .sign { margin-top: 14pt; }
</style></head><body>
  <h1>${esc(content.name)}</h1>
  <p class="role">${esc(headlineArg || content.role)}</p>
  <p class="contact">${esc(content.links?.email || "")} · ${esc(site)} · ${esc((content.links?.linkedin || "").replace(/^https?:\/\/(www\.)?/, ""))} · ${esc(content.location || "")}</p>
  <p class="date">${date}</p>
  ${paras.map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("\n  ")}
  <p class="sign">Sincerely,<br>${esc(content.name)}</p>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.pdf({ path: resolve(outArg), format: "Letter", tagged: true });
await browser.close();
console.log(`Wrote ${resolve(outArg)}`);
