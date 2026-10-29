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
// The first 3 stats, each as a big value over a small label (like the site).
// A long text value (such as three partner names) is set smaller, one name per line.
const stats = (d.stats || []).slice(0, 3).map((s) => {
  const long = s.value.length > 8;
  const value = long ? s.value.split(" · ").map(esc).join("<br>") : esc(s.value);
  return `<div class="stat${long ? " text" : ""}"><b>${value}</b><span>${esc(s.label)}</span></div>`;
});

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  html,body{margin:0}
  body{width:1200px;height:630px;background:#f4f2ee;color:#141413;font-family:Inter,sans-serif;position:relative;overflow:hidden}
  .wrap{position:absolute;inset:64px 80px 56px;display:flex;flex-direction:column}
  .eyebrow{font:500 20px/1 'JetBrains Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6b6862;display:flex;align-items:center;gap:14px}
  .dot{width:12px;height:12px;border-radius:50%;background:#1f8a4c}
  h1{margin:28px 0 0;font:400 132px/.9 'Instrument Serif',serif;letter-spacing:-.02em}
  h1 em{color:#b8360f}
  .role{margin-top:22px;font:500 36px/1.2 Inter,sans-serif}
  .foot{margin-top:auto;display:grid;grid-template-columns:repeat(3,1fr);border-top:2px solid #d6d2ca}
  .stat{display:flex;flex-direction:column;justify-content:space-between;gap:10px;padding:22px 24px 0 0}
  .stat+.stat{padding-left:24px;border-left:2px solid #d6d2ca}
  .stat b{font:400 64px/1 'Instrument Serif',serif;color:#b8360f}
  .stat.text b{font-size:28px;line-height:1.1}
  .stat span{font:400 20px/1.3 Inter,sans-serif;color:#6b6862}
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

// iPhone / iPad home-screen icon (180×180), matching the site's "HG" mark.
await page.setViewportSize({ width: 180, height: 180 });
await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&display=swap" rel="stylesheet">
<style>html,body{margin:0}body{width:180px;height:180px;background:#141413;display:grid;place-items:center;color:#f4f2ee;font:italic 400 92px/1 'Instrument Serif',serif}</style>
</head><body>${esc(initials)}</body></html>`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: new URL("../public/apple-touch-icon.png", import.meta.url).pathname });
await browser.close();
console.log("Wrote public/og.png and public/apple-touch-icon.png");
