// Rebuilds public/og.png (the link-preview image) from public/content.json.
// Run: node scripts/make-og.mjs
// Needs Playwright. If it isn't installed: npm install --no-save playwright && npx playwright install chromium
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// require() also finds a globally installed Playwright, which import can't.
const { chromium } = createRequire(import.meta.url)("playwright");

const d = JSON.parse(readFileSync(new URL("../public/content.json", import.meta.url), "utf8"));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const [first, ...rest] = d.name.split(" ");
const initials = d.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2);
// Short stats (number + label) first, then one text stat such as the collaborations.
const stats = (d.stats || []).slice(0, 3).map((s) =>
  s.value.length > 8 ? `<span>${esc(s.value)}</span>` : `<span><b>${esc(s.value)}</b>${esc(s.label)}</span>`,
);

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  html,body{margin:0}
  body{width:1200px;height:630px;background:#f4f2ee;color:#141413;font-family:Inter,sans-serif;position:relative;overflow:hidden}
  .wrap{position:absolute;inset:72px 80px;display:flex;flex-direction:column}
  .eyebrow{font:500 20px/1 'JetBrains Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6b6862;display:flex;align-items:center;gap:14px}
  .dot{width:12px;height:12px;border-radius:50%;background:#1f8a4c}
  h1{margin:36px 0 0;font:400 150px/.88 'Instrument Serif',serif;letter-spacing:-.02em}
  h1 em{color:#e0461f}
  .role{margin-top:34px;font:500 38px/1.2 Inter,sans-serif}
  .foot{margin-top:auto;display:flex;gap:32px;white-space:nowrap;font:400 20px/1.3 Inter,sans-serif;color:#6b6862}
  .foot b{font:400 26px/1 'Instrument Serif',serif;color:#e0461f;margin-right:8px}
  .mark{position:absolute;right:80px;top:64px;width:96px;height:96px;border:2px solid #141413;border-radius:50%;display:grid;place-items:center;font:italic 400 48px/1 'Instrument Serif',serif}
</style></head><body>
<div class="mark">${esc(initials)}</div>
<div class="wrap">
  <div class="eyebrow"><span class="dot"></span>${esc(d.availability)} · ${esc(d.location.split(",")[0])}</div>
  <h1>${esc(first)} <em>${esc(rest.join(" "))}</em></h1>
  <div class="role">${esc(d.role)}</div>
  <div class="foot">${stats.join("")}</div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: new URL("../public/og.png", import.meta.url).pathname });
await browser.close();
console.log("Wrote public/og.png");
