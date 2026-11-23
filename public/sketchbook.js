// The on-screen site, "Sketchbook × Tech Pack" (Nov 2026). Renders #sb from content.json:
// a spec-strip header, the opening, one "sheet" per main project, more work, the full resume, skills, education,
// and contact. The old layout stays in the page for the printed resume and search engines; sketchbook.css
// (screen only) hides it. If anything here fails, the stylesheet is removed and the old layout shows instead.
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PDF = "/Herbert-Gracia-Resume.pdf";

const pen = (cls, viewBox, d, len, extra = "") =>
  `<svg class="sb-pen sb-draw ${cls}" viewBox="${viewBox}" aria-hidden="true" data-len="${len}" ${extra}><path d="${d}"/></svg>`;

function thumb(src) {
  const f = String(src || "").split("/").pop();
  return f ? `/work/thumbs/${f}` : "";
}

function strip(d, S) {
  const L = d.links || {};
  return `<header class="sb-strip"><div class="sb-wrap">
    <div class="sb-cell"><b>NOW</b>${esc(S.strip?.now)}</div>
    <div class="sb-cell"><b>STATUS</b>${esc(S.strip?.status)}</div>
    <div class="sb-cell"><b>EMAIL</b><a class="sb-mail" href="mailto:${esc(L.email)}">${esc(L.email)}</a></div>
    <div class="sb-actions">
      <button class="sb-theme" id="sb-theme" type="button" aria-label="Dark theme" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z"/></svg></button>
      ${L.linkedin ? `<a href="${esc(L.linkedin)}" target="_blank" rel="noopener">LinkedIn ↗</a>` : ""}
      <a class="sb-solid" href="${PDF}" download>PDF ↓</a>
    </div>
  </div></header>`;
}

function hero(d, S) {
  const H = S.hero_image || {}, I = S.inset_image || {};
  const facts = (S.facts || []).map((f) => `<div class="sb-fact">${f.ring ? pen("sb-ring", "0 0 92 56", "M14 10 C 40 -2, 86 6, 84 28 C 82 52, 26 56, 10 40 C -2 26, 18 10, 40 9", 260) : ""}<span class="sb-num">${esc(f.num)}</span><span class="sb-lab">${esc(f.label)}</span></div>`).join("");
  return `<section class="sb-wrap sb-hero" aria-labelledby="sb-name">
    <div>
      <nav class="sb-tapes" aria-label="Jump to"><a class="sb-tp sb-tp1" href="#sb-resume">Resume ↓</a><a class="sb-tp sb-tp2" href="#sb-skills">Skills ↓</a></nav>
      <p class="sb-label">${esc(S.eyebrow)}</p>
      <h1 id="sb-name">${esc(d.name).replace(/ (\S+)$/, " <br><em>$1</em>")}</h1>
      <p class="sb-role">${esc(S.titles)}</p>
      <p class="sb-now"><strong>Now:</strong> ${esc(S.now)}</p>
      <div class="sb-facts">${facts}</div>
    </div>
    <figure class="sb-fig">
      ${H.note ? `<p class="sb-note" aria-hidden="true">${esc(H.note)}</p>` : ""}
      <div class="sb-photo"><span class="sb-tape sb-t1"></span><span class="sb-tape sb-t2"></span><img src="${esc(H.src)}" alt="${esc(H.alt)}" width="${H.w || 500}" height="${H.h || 500}" fetchpriority="high"></div>
      ${I.src ? `<div class="sb-photo sb-mini"><span class="sb-tape sb-t1"></span><img src="${esc(thumb(I.src))}" data-full="${esc(I.src)}" alt="${esc(I.alt)}" width="${I.w || 600}" height="${I.h || 600}"><span class="sb-hand sb-minicap">${esc(I.note)}</span></div>` : ""}
      <figcaption class="sb-figcap"><span class="sb-label">${esc(H.caption)}</span><span class="sb-label">${esc(H.caption2)}</span></figcaption>
    </figure>
  </section>`;
}

function sheet(s, i) {
  const keys = "ABCDEFG";
  const media = s.wipe
    ? `<div class="sb-wipe">
        <img class="sb-after" src="${esc(s.wipe.after)}" alt="${esc(s.wipe.after_alt)}" width="900" height="675" loading="lazy">
        <img class="sb-before" src="${esc(s.wipe.before)}" alt="${esc(s.wipe.before_alt)}" width="900" height="675" loading="lazy">
        <span class="sb-seam" aria-hidden="true"><svg viewBox="0 0 14 600" preserveAspectRatio="none"><path class="sb-pen" d="M7 0 C 3 80, 11 160, 6 240 S 4 400, 8 480 S 6 560, 7 600"/></svg></span>
        <span class="sb-knob" aria-hidden="true">⇆</span>
        <span class="sb-tagb">${esc(s.wipe.before_label)}</span><span class="sb-taga">${esc(s.wipe.after_label)}</span>
        <input type="range" min="0" max="100" step="5" value="50" aria-label="${esc(s.wipe.aria)}" aria-valuetext="Half and half">
      </div>
      <div class="sb-wipe-cap"><span class="sb-label">${esc(s.wipe.caption)}</span><span class="sb-hand sb-hand-sm">drag me ⇆</span></div>`
    : `<div class="sb-pgrid">${(s.grid || []).map((g) => `<figure><img src="${esc(thumb(g.src))}" data-full="${esc(g.src)}" alt="${esc(g.alt)}" loading="lazy"><figcaption class="sb-label">${esc(g.caption)}</figcaption></figure>`).join("")}</div>`;
  const side = (s.side || []).map((g) => `<figure class="${s.side.length === 1 ? "sb-st" : ""}">${g.note ? `<span class="sb-scribble" aria-hidden="true">${esc(g.note)}</span>` : ""}<img src="${esc(thumb(g.src))}" data-full="${esc(g.src)}" alt="${esc(g.alt)}" loading="lazy"><figcaption class="sb-label">${esc(g.caption)}</figcaption></figure>`).join("");
  return `<article class="sb-sheet" id="sb-sheet-${i}" aria-labelledby="sb-sheet-title-${i}">
    <div class="sb-sheet-hdr">
      <div><b>COMPANY</b><span>${esc(s.company)}</span></div>
      <div><b>${esc((s.when_label || "Years").toUpperCase())}</b><span>${esc(s.when)}</span></div>
      <div><b>ROLE</b><span>${esc(s.role)}</span></div>
      <div><b>STATUS</b><span>${esc(s.status)}</span></div>
    </div>
    <div class="sb-sheet-body">
      <div class="sb-sheet-left">
        <h3 id="sb-sheet-title-${i}">${esc(s.title)}</h3>
        <p class="sb-sk-line">${(s.tags || []).map((t) => `<span>${esc(t)}</span>`).join("")}</p>
        <p class="sb-lede">${esc(s.lede)}</p>
        ${media}
      </div>
      <div class="sb-sheet-right">
        <ol class="sb-callouts">${(s.callouts || []).map(([b, t], k) => `<li><span class="sb-k">${keys[k]}</span><span><b>${esc(b)}</b> ${esc(t)}</span></li>`).join("")}</ol>
        ${side ? `<div class="sb-margin ${s.side.length === 1 ? "sb-one" : "sb-two"}">${side}</div>` : ""}
        ${s.work ? `<button class="sb-sheet-more" type="button" data-work="${esc(s.work)}">Open the full case study →</button>` : ""}
      </div>
    </div>
  </article>`;
}

function more(d, S) {
  const used = new Set((S.sheets || []).map((s) => s.work));
  const items = (d.work || []).filter((w) => !used.has(w.title));
  if (!items.length) return "";
  return `<h3 class="sb-sub">More work</h3><ul class="sb-more" role="list">${items.map((w) => {
    const src = w.cover_image || w.images?.[0]?.src || "";
    const cat = [].concat(w.category || [])[0] || "";
    const contain = /contain/.test(w.imageFit || "") ? " sb-contain" : "";
    const pic = src ? `<img class="sb-cimg" src="${esc(thumb(src))}" data-full="${esc(src)}" alt="" loading="lazy">` : `<span class="sb-cnone">${esc(w.title)}</span>`;
    return `<li><button class="sb-card${contain}" type="button" data-work="${esc(w.title)}">${pic}<span class="sb-cc">${esc(cat)}</span><span class="sb-ct">${esc(w.title)}</span>${w.result || w.caption ? `<span class="sb-cr">${esc(w.result || w.caption)}</span>` : ""}</button></li>`;
  }).join("")}</ul>`;
}

function experience(d) {
  const jobs = (d.experience || []).map((e) => {
    const current = /^present/i.test(e.end || "");
    const tag = current ? "Current" : String(e.exit || "").replace(/^Exit:\s*/, "").replace(" · ", ", ");
    const earlier = (e.earlier_roles || []).length
      ? `<p class="sb-label sb-earlier-h">Earlier roles at Fromm</p><ul class="sb-earlier">${e.earlier_roles.map((r) => `<li><span class="sb-mono">${esc(r.years)}</span> ${esc(r.title)}</li>`).join("")}</ul>`
      : "";
    return `<li class="sb-job">
      <div class="sb-yr">${esc(e.start)} – ${esc(e.end)}</div>
      <div class="sb-jb"><h3 class="sb-t">${esc(e.role)}</h3><p class="sb-o">${esc(e.company)}${e.location ? " · " + esc(e.location) : ""}</p>
        <ul class="sb-kb">${(e.key || []).map((k) => `<li>${esc(k)}</li>`).join("")}</ul>${earlier}</div>
      <div class="sb-x">${esc(tag)}</div>
    </li>`;
  }).join("");
  return `<section class="sb-wrap sb-sec" id="sb-resume" aria-labelledby="sb-tl-title">
    <div class="sb-sec-head"><h2 id="sb-tl-title">Experience</h2><span class="sb-label">The full resume · <a href="${PDF}" download>Download PDF ↓</a></span></div>
    <ol class="sb-tl">${jobs}</ol>
  </section>`;
}

function skills(d) {
  const langs = (d.skills || []).find((g) => /^language/i.test(g.group));
  return `<section class="sb-wrap sb-sec" id="sb-skills" aria-labelledby="sb-sk-title">
    <div class="sb-sec-head"><h2 id="sb-sk-title">Skills &amp; tools</h2>${langs ? `<span class="sb-label">Languages: ${esc(langs.items.join(", "))}</span>` : ""}</div>
    <div class="sb-skills">${(d.skills_short || []).map((g) => `<div class="sb-sg"><p class="sb-label">${esc(g.group)}</p><ul>${g.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}</div>
    ${(d.tools || []).length ? `<div class="sb-tools"><p class="sb-label">Tools</p><p>${esc(d.tools.join(" · "))}</p></div>` : ""}
  </section>`;
}

function education(d) {
  const ed = (d.education || [])[0];
  const certs = (d.certifications || []).filter((c) => !c.status || /^completed/i.test(c.status));
  return `<section class="sb-wrap sb-sec" aria-labelledby="sb-ed-title">
    <div class="sb-sec-head"><h2 id="sb-ed-title">Education &amp; certifications</h2></div>
    <div class="sb-edu">
      ${ed ? `<div><p class="sb-label">Education</p><p class="sb-t2">${esc(ed.degree)}</p><p class="sb-o">${esc(ed.school)}${ed.year ? " · " + esc(ed.year) : ""}</p></div>` : ""}
      ${certs.map((c) => `<div><p class="sb-label">Certificate${c.year ? " · " + esc(c.year) : ""}</p><p class="sb-t2">${esc(c.name)}</p><p class="sb-o">${esc(c.issuer)}${c.description ? " · " + esc(c.description) : ""}</p></div>`).join("")}
    </div>
  </section>`;
}

function contact(d) {
  const L = d.links || {};
  const tag = String(d.tagline || "");
  const k = tag.indexOf("first idea");
  const tagline = k > 0
    ? `${esc(tag.slice(0, k))}<span class="sb-u">first idea${pen("", "0 0 200 14", "M2 9 C 40 2, 90 13, 130 6 S 185 9, 198 4", 230, 'preserveAspectRatio="none"')}</span>${esc(tag.slice(k + 10))}`
    : esc(tag);
  return `<section class="sb-wrap sb-sec sb-contact" id="sb-contact" aria-labelledby="sb-ct-title">
    <div class="sb-sec-head"><h2 id="sb-ct-title">Let’s talk</h2><span class="sb-label">${esc(d.location || "San Francisco")} · ${esc(d.availability || "Open to new roles")}</span></div>
    <div class="sb-ct-grid">
      <div class="sb-ct-left">
        <div class="sb-sign"><p class="sb-tag sb-end">${tagline}</p></div>
        <p class="sb-ct">Hiring for brand, creative, or marketing leadership? I’d like to hear about it.</p>
        <ul class="sb-ct-links">
          <li><span class="sb-label">Email</span><a href="mailto:${esc(L.email)}">${esc(L.email)}</a></li>
          ${L.linkedin ? `<li><span class="sb-label">LinkedIn</span><a href="${esc(L.linkedin)}" target="_blank" rel="noopener">linkedin.com/in/herbert-gracia ↗</a></li>` : ""}
          <li><span class="sb-label">Resume</span><a href="${PDF}" download>Download the PDF ↓</a></li>
        </ul>
      </div>
      <div class="sb-ct-form" id="sb-form-slot" hidden><p class="sb-label sb-form-h">Send me a note</p></div>
    </div>
  </section>`;
}

function wire(root) {
  document.documentElement.classList.add("sb-js");
  // Pen marks draw in when they come into view.
  const marks = root.querySelectorAll(".sb-draw");
  marks.forEach((m) => m.style.setProperty("--len", m.dataset.len || 600));
  if ("IntersectionObserver" in window && !still) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("sb-on"); io.unobserve(e.target); } }), { threshold: 0.4 });
    marks.forEach((m) => io.observe(m));
    setTimeout(() => marks.forEach((m) => m.classList.add("sb-on")), 4000);
  } else marks.forEach((m) => m.classList.add("sb-on"));

  // Before/after: the range input drives the seam (mouse, touch, and arrow keys), with one nudge on first view.
  root.querySelectorAll(".sb-wipe").forEach((wipe) => {
    const range = wipe.querySelector("input");
    const setPos = (v) => wipe.style.setProperty("--pos", v + "%");
    setPos(50);
    const said = (v) => range.setAttribute("aria-valuetext", v <= 5 ? "Showing the after view" : v >= 95 ? "Showing the before view" : `${Math.round(v)}% before view`);
    range.addEventListener("input", () => { setPos(range.value); said(+range.value); });
    if (!("IntersectionObserver" in window) || still) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      let t0 = null;
      const step = (t) => { t0 ??= t; const k = Math.min(1, (t - t0) / 1400); const v = 50 + Math.sin(k * Math.PI * 2) * 22 * (1 - k); setPos(v.toFixed(1)); range.value = v; if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(wipe);
  });

  // Small thumbnails first; fall back to the full image if a thumbnail doesn't exist.
  root.querySelectorAll("img[data-full]").forEach((img) => img.addEventListener("error", () => { if (img.src.indexOf(img.dataset.full) < 0) img.src = img.dataset.full; }, { once: true }));

  // The contact form lives in the old markup, where app.js wires it up; move it here once it's switched on.
  const slot = $("#sb-form-slot", root), form = document.getElementById("contact-form");
  const place = () => { if (form && !form.hidden && slot.hidden) { slot.append(form); slot.hidden = false; } };
  place();
  if (form && slot.hidden) new MutationObserver((m, o) => { place(); if (!slot.hidden) o.disconnect(); }).observe(form, { attributes: true, attributeFilter: ["hidden"] });

  // Case studies open in the existing work dialog (app.js).
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-work]");
    if (b && window.hgOpenWork) window.hgOpenWork(b.dataset.work);
  });

  // Light/dark toggle, saved the same way theme.js reads it.
  const btn = $("#sb-theme", root), html = document.documentElement;
  const cur = () => html.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const label = () => btn.setAttribute("aria-pressed", String(cur() === "dark"));
  label();
  btn.addEventListener("click", () => { const next = cur() === "dark" ? "light" : "dark"; html.dataset.theme = next; try { localStorage.setItem("theme", next); } catch {} label(); });

  // Old links (#contact, #skills, #work...) land on the matching new section.
  const map = { "#contact": "#sb-contact", "#skills": "#sb-skills", "#work": "#sb-resume", "#portfolio": "#sb-work", "#now": "#sb-work", "#entrepreneur": "#sb-work", "#top": "#sb-name" };
  const target = map[location.hash] || (location.hash.startsWith("#sb-") ? location.hash : null);
  if (target && $(target)) requestAnimationFrame(() => $(target).scrollIntoView());
}

try {
  const d = await fetch("/content.json").then((r) => r.json());
  const S = d.sketchbook;
  const root = $("#sb");
  if (!S || !root) throw new Error("no sketchbook content");
  root.innerHTML = strip(d, S) + `<main id="sb-main" class="sb-main" tabindex="-1">${hero(d, S)}
    <section class="sb-wrap sb-sec" id="sb-work" aria-labelledby="sb-work-title">
      <div class="sb-sec-head"><h2 id="sb-work-title">Selected work</h2><span class="sb-label">Current role first · what I built and what it delivered</span></div>
      ${(S.sheets || []).map(sheet).join("")}
      ${more(d, S)}
    </section>
    ${experience(d)}${skills(d)}${education(d)}${contact(d)}</main>`;
  root.hidden = false;
  wire(root);
} catch (err) {
  // Fall back to the previous layout rather than show an empty page.
  console.error(err);
  document.querySelector('link[href="/sketchbook.css"]')?.remove();
  document.querySelector(".skip")?.setAttribute("href", "#main");
}
