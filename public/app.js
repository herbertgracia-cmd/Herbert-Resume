// Fills the page from content.json and wires up the theme, welcome pop-up, and contact form.

const $ = (sel) => document.querySelector(sel);

// Small element builder that only ever sets text (never raw HTML).
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Only allow normal web and email links from content.json (never "javascript:").
function safeUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url, location.href);
    return ["https:", "http:", "mailto:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

const data = await fetch("/content.json").then((r) => r.json());
render(data);
setupTheme();
setupChrome();
setupWorkDialog();
setupReveal();
setupFeatures(data);

function render(d) {
  const firstName = d.name.split(" ")[0];
  const initials = d.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2);
  const binds = { ...d, firstName, initials };
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const v = binds[el.dataset.bind];
    if (typeof v === "string") el.textContent = v;
  });
  // "Head of Brand · Creative Director · ..." gives the tab title "Head of Brand & Creative Director".
  document.title = `${d.name} — ${d.role.split(" · ").slice(0, 2).join(" & ")}`;

  // Hero role: "A · B · C" becomes separate pieces with accent dots.
  const roleEl = $(".hero-role");
  const roles = d.role.split(" · ");
  if (roles.length > 1) {
    // Each dot stays attached to the role before it, so lines never start with one.
    roleEl.replaceChildren(...roles.flatMap((r, i) => [
      h("span", { class: "role" }, r, i < roles.length - 1 && h("span", { class: "sep", "aria-hidden": "true" }, " ·")),
      i < roles.length - 1 ? " " : null,
    ]).filter(Boolean));
  }
  const tag = $("#hero-tagline");
  const accent = d.tagline_accent && d.tagline.indexOf(d.tagline_accent);
  if (accent > 0) {
    tag.replaceChildren(d.tagline.slice(0, accent), h("em", {}, d.tagline_accent), d.tagline.slice(accent + d.tagline_accent.length));
  }

  // Well-known partners, right under the numbers.
  if (d.partners?.length) {
    const partners = $("#partners");
    partners.replaceChildren(h("span", { class: "partners-label" }, "Collaborations"), ...d.partners.map((x) => h("span", { class: "partner" }, x)));
    partners.hidden = false;
  }

  if (safeUrl(d.links?.linkedin)) {
    const li = $("#hero-linkedin");
    li.href = safeUrl(d.links.linkedin);
    li.hidden = false;
  }

  // Portrait next to the name.
  const photo = $(".hero-photo");
  if (d.photo?.src) { photo.src = d.photo.src; photo.alt = d.photo.alt || d.name; } else photo.remove();

  // Hero name: one line per word, last word in italic accent.
  const nameEl = $(".hero-name");
  nameEl.replaceChildren(...d.name.split(/\s+/).flatMap((w, i) => [i ? " " : null, h("span", { class: "line" }, w)]).filter(Boolean));

  // Key numbers under the hero.
  const stats = $("#stats");
  if (d.stats?.length) {
    // A long text value (like three partner names) gets one name per line.
    stats.replaceChildren(...d.stats.map((s) => {
      const long = s.value.length > 8;
      const value = long ? s.value.split(" · ").map((v) => h("span", { class: "stat-line" }, v)) : s.value;
      return h("div", { class: long ? "stat stat-text" : "stat" }, h("strong", {}, value), h("span", {}, s.label));
    }));
  } else stats.remove();

  // Experience: 3 key bullets per job; the rest sits behind "More".
  $("#jobs").replaceChildren(...d.experience.map(renderJob));

  renderWork(d.work || []);

  // Expertise: a short list on the page; every skill group, tool, and industry under "All skills".
  const groups = (d.skills || []).filter((g) => g.group !== "Languages");
  const facts = [
    ...(d.skills_short || groups.slice(0, 4)).map((g) => [g.group, g.items.join(" · ")]),
    ["Education", (d.education || []).slice(0, 1).map((e) => `${e.school}, ${[e.degree, e.year].filter(Boolean).join(", ")}`).join("")],
    ["Languages", (d.skills || []).find((g) => g.group === "Languages")?.items.join(" · ")],
  ].filter(([, v]) => v);
  const allFacts = [
    ...groups.map((g) => [g.group, g.items.join(" · ")]),
    ["Industries", (d.industries || []).map((x) => x.name).join(" · ")],
  ].filter(([, v]) => v);
  // Each item stays on one line with its dot, so no line starts with "·".
  const factItems = (v) => (!v.includes(" · ") ? v : v.split(" · ").flatMap((x, i, all) => [
    h("span", { class: "fact-item" }, x, i < all.length - 1 ? " ·" : ""),
    i < all.length - 1 ? " " : null,
  ]).filter(Boolean));
  const factRows = (rows) => rows.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, factItems(v))]);
  $("#facts").replaceChildren(...factRows(facts));
  $("#facts-all").replaceChildren(...factRows(allFacts));

  // Tools support the skills above, so they sit in one smaller line.
  if (d.tools?.length) {
    const tools = $("#tools");
    tools.replaceChildren(h("span", { class: "tools-label" }, "Tools"), " ", d.tools.join(" · "));
    tools.hidden = false;
  }

  renderCerts(d.certifications || []);

  // Printed resume: email and LinkedIn go at the top instead of a contact section at the end.
  $("#print-contact").textContent = [d.links.email, d.links.linkedin?.replace(/^https?:\/\/(www\.)?/, ""), d.location]
    .filter(Boolean).join("  ·  ");

  const email = $("#contact-email");
  email.textContent = d.links.email;
  email.href = `mailto:${d.links.email}`;
  const linkNames = { linkedin: "LinkedIn", github: "GitHub", website: "Website" };
  $("#contact-links").replaceChildren(
    ...Object.entries(d.links)
      .filter(([k, v]) => k !== "email" && safeUrl(v))
      .map(([k, v]) => h("li", {}, h("a", { href: safeUrl(v), target: "_blank", rel: "noopener" }, `${linkNames[k] || k} ↗`))),
  );

  $("#year").textContent = new Date().getFullYear();

  // Number the sections that are shown: 01, 02, 03...
  // (Hidden from screen readers so headings read "Experience", not "01Experience".)
  document.querySelectorAll(".section .num").forEach((n, k) => {
    n.textContent = String(k + 1).padStart(2, "0");
    n.setAttribute("aria-hidden", "true");
  });
}

// ---------- Work / portfolio ----------

// Turns a YouTube or Vimeo link into an embeddable player URL and a thumbnail.
function videoInfo(url) {
  if (!url) return null;
  let m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (m) {
    return {
      embed: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`,
      thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`,
    };
  }
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { embed: `https://player.vimeo.com/video/${m[1]}`, thumb: null };
  return null;
}

function categoryClass(cat) {
  const name = String([].concat(cat || "other")[0]).toLowerCase();
  // All the design types (Web design, Print design...) share the design color.
  if (name.endsWith("design")) return "cat-design";
  return "cat-" + name.replace(/[^a-z]+/g, "-");
}

// "category" can be one name or a list, e.g. ["Product design", "Print design"].
function categoriesOf(item) {
  return [].concat(item.category || []).filter(Boolean);
}

// The label a card shows: its first two categories.
function categoryLabel(item, max = 2) {
  return categoriesOf(item).slice(0, max).join(" + ");
}

// A card's cover: the real image or video thumbnail if there is one; otherwise a
// typographic poster (category and year in the corners, the title set large).
// Covers repeat the card's text, so screen readers skip them.
function workCover(item, { large = false, hue = 0 } = {}) {
  const video = videoInfo(item.video);
  const src = item.image || item.images?.[0]?.src || video?.thumb;
  const cover = h("div", { class: `work-cover ${categoryClass(item.category)} hue-${hue % 6}`, "aria-hidden": "true" });
  if (src) {
    cover.classList.add("has-image");
    // Logos show whole on a dark background instead of being cropped.
    if (item.imageFit === "contain") cover.classList.add("fit-contain");
    if (item.imageFit === "contain-light") cover.classList.add("fit-contain", "light");
    cover.append(h("img", { src, alt: "", loading: large ? null : "lazy" }));
  } else if (item.cover) {
    // A typeset cover: one big word (like "AI") on dark, until there's a real image.
    cover.classList.add("type-cover");
    cover.append(
      h("span", { class: "type-note" }, item.cover_note || categoryLabel(item, 1)),
      h("b", {}, item.cover),
      h("span", { class: "type-note" }, item.year || ""),
    );
  } else {
    cover.append(
      h("span", { class: "work-cover-meta" }, h("span", {}, categoryLabel(item, 1)), h("span", {}, item.year || "")),
      h("span", { class: "work-cover-title" }, item.title),
    );
  }
  if (item.video) cover.append(h("span", { class: "play" }, "▶"));
  return cover;
}

function renderWork(items) {
  const section = $("#portfolio");
  if (!items.length) return section.remove();

  const CATEGORY_ORDER = [
    "Web design", "Product design", "Project design", "Print design",
    "Marketing", "Video", "Events", "Storytelling", "Collaborations", "Technology", "AI",
  ];
  const cats = [...new Set(items.flatMap(categoriesOf))]
    .sort((a, b) => (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99));
  const filters = $("#work-filters");
  const grid = $("#work-grid");
  const list = $("#work-list");
  const num = (i) => String(i + 1).padStart(2, "0");
  const caption = (item) => item.caption || item.summary;
  const tag = (item) => item.tag || categoryLabel(item);

  // Featured pieces: big image tiles with a one-line caption. The case study opens in the dialog.
  // Everything else: a compact typeset list under "All work".
  const featured = items.some((i) => i.featured) ? items.map((i) => !!i.featured) : items.map(() => true);
  const entries = items.map((item, i) => {
    const ids = { "aria-labelledby": `work-title-${i}`, "aria-describedby": `work-sum-${i}` };
    const cats = JSON.stringify(categoriesOf(item));
    const el = featured[i]
      ? h("li", { class: "reveal", "data-category": cats },
          h("button", { class: isCaseStudy(item) ? "work-card is-case" : "work-card", type: "button", "aria-haspopup": "dialog", ...ids },
            workCover(item, { hue: i }),
            h("span", { class: "work-cap" },
              h("span", { class: "work-num", "aria-hidden": "true" }, num(i)),
              h("h3", { id: `work-title-${i}` }, item.title),
              h("span", { class: "work-tag" }, [tag(item), item.year].filter(Boolean).join(" · ")),
              h("span", { class: "work-text", id: `work-sum-${i}` }, caption(item)),
            ),
          ))
      : h("li", { "data-category": cats },
          h("button", { class: "work-row", type: "button", "aria-haspopup": "dialog", ...ids },
            h("span", { class: "work-num", "aria-hidden": "true" }, num(i)),
            h("span", { class: "work-row-title", id: `work-title-${i}` }, item.title),
            h("span", { class: "work-text", id: `work-sum-${i}` }, caption(item)),
            h("span", { class: "work-tag" }, [tag(item), item.year].filter(Boolean).join(" · ")),
          ));
    el.querySelector("button").addEventListener("click", () => openWork(item, i));
    return el;
  });
  grid.replaceChildren(...entries.filter((_, i) => featured[i]));
  list.replaceChildren(...entries.filter((_, i) => !featured[i]));

  const more = $("#work-more");
  const extra = entries.length - featured.filter(Boolean).length;
  if (extra > 0) {
    more.textContent = `All work (${items.length}) →`;
    more.hidden = false;
    more.addEventListener("click", () => {
      list.hidden = false;
      filters.hidden = cats.length < 2;
      more.hidden = true;
      // Keep keyboard users in place: move focus to the first newly shown piece.
      list.querySelector("button")?.focus();
    });
  } else more.remove();

  if (cats.length < 2) return filters.remove();
  const buttons = ["All", ...cats].map((c) =>
    h("button", { type: "button", "aria-pressed": String(c === "All"), "data-filter": c }, c),
  );
  filters.replaceChildren(...buttons);
  filters.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const f = btn.dataset.filter;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    entries.forEach((c) => { c.hidden = f !== "All" && !JSON.parse(c.dataset.category).includes(f); c.classList.add("in"); });
    const shown = entries.filter((c) => !c.hidden).length;
    $("#work-count").textContent = f === "All" ? `Showing all ${entries.length} pieces` : `Showing ${shown} of ${entries.length}: ${f}`;
  });
}

function openWork(item, index = 0) {
  const dialog = $("#work-dialog");
  const video = videoInfo(item.video);
  let media;
  if (video) {
    media = h("div", { class: "work-media video" },
      h("iframe", {
        src: video.embed, title: item.title,
        allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowfullscreen: "",
      }));
  } else if (item.images?.length > 1) {
    // Several photos: a swipeable strip, one photo per view.
    media = h("div", { class: "work-media gallery", tabindex: "0", role: "region", "aria-label": `${item.title} photos` },
      item.images.map((img) => h("img", { src: img.src, alt: img.alt || item.title })));
  } else if (item.image || item.images?.length) {
    const img = item.images?.[0] || { src: item.image, alt: item.imageAlt };
    const fit = { contain: " fit-contain", "contain-light": " fit-contain light" }[item.imageFit] || "";
    media = h("div", { class: `work-media${fit}` }, h("img", { src: img.src, alt: img.alt || item.title }));
  } else {
    media = workCover(item, { large: true, hue: index });
    media.classList.add("work-media");
  }

  // Case studies read as challenge → my role → approach → outcome; other pieces just list role and partners.
  const facts = (isCaseStudy(item)
    ? [["The challenge", item.challenge], ["My role", item.role], ["Approach", item.approach], ["Outcome", item.outcome], ["With", item.collaborators]]
    : [["My role", item.role], ["With", item.collaborators]]
  ).filter(([, v]) => v);
  const linkLabel = item.linkLabel || (item.video && !video ? "Watch" : "View project");
  const linkUrl = safeUrl(item.link || (item.video && !video ? item.video : "")) || "";

  $("#work-dialog-body").replaceChildren(
    media,
    h("div", { class: "work-dialog-text" },
      h("p", { class: "work-meta" }, h("span", {}, categoriesOf(item).join(" + ")), item.year && h("span", {}, item.year)),
      h("h3", { id: "work-dialog-title" }, item.title),
      h("p", {}, item.summary),
      item.details && h("p", { class: "muted" }, item.details),
      facts.length > 0 && h("dl", { class: isCaseStudy(item) ? "work-facts case" : "work-facts" }, facts.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])),
      item.tags?.length > 0 && h("div", { class: "tags" }, item.tags.map((t) => h("span", { class: "tag" }, t))),
      linkUrl && h("a", { class: "btn btn-small", href: linkUrl, target: "_blank", rel: "noopener" }, `${linkLabel} ↗`),
    ),
  );
  dialog.showModal();
}

function isCaseStudy(item) {
  return !!(item.challenge || item.approach || item.outcome);
}

function setupWorkDialog() {
  const dialog = $("#work-dialog");
  $("#work-dialog-close").addEventListener("click", () => dialog.close());
  // Click outside the box closes it.
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  // Stop any playing video when closed.
  dialog.addEventListener("close", () => $("#work-dialog-body").replaceChildren());
}

function renderJob(j) {
  // On the page: the role's description and its points, plus how a founder role ended.
  // Anything longer sits under "More"; the printed resume uses summary and key.
  const points = j.points?.length ? j.points : (j.key || []).slice(0, 3);
  const key = j.key?.length ? j.key : (j.highlights || []).slice(0, 3);
  const line = j.line || j.summary;
  // Skip what the page already shows, so "More" never repeats it.
  const moreSummary = j.summary && j.summary !== line ? j.summary : null;
  const moreKey = key.length && key.join() !== points.join() ? key : [];
  const hasMore = moreSummary || moreKey.length || j.creative?.length || j.highlights?.length || j.earlier_roles?.length || j.areas?.length || j.tags?.length;
  return h("li", { class: "job reveal" },
    h("div", { class: "job-dates" },
      j.start ? `${j.start}–${j.end}` : "",
      j.since && h("span", { class: "job-since" }, j.since),
      j.location && h("span", { class: "job-location" }, j.location),
    ),
    h("div", { class: "job-body" },
      h("h3", {}, j.role, j.company && " ", j.company && h("span", { class: "at" }, `· ${j.company}`)),
      line && h("p", { class: "job-line" }, line),
      points.length > 0 && h("ul", { class: "job-points" }, points.map(highlight)),
      // Printed resume only: the full summary and key bullets, when they differ from the page.
      (moreSummary || moreKey.length > 0) && h("div", { class: "job-print" },
        moreSummary && h("p", { class: "job-summary" }, moreSummary),
        moreKey.length > 0 && h("ul", { class: "job-key" }, moreKey.map(highlight)),
      ),
      j.exit && h("div", { class: "job-exit-block" },
        h("p", { class: "job-exit" }, j.exit),
        j.exit_note && h("p", { class: "job-exit-note" }, j.exit_note),
      ),
      hasMore && h("details", { class: "job-more" },
        h("summary", {}, "More about this role"),
        moreSummary && h("p", { class: "job-summary" }, moreSummary),
        moreKey.length > 0 && h("ul", { class: "job-key" }, moreKey.map(highlight)),
        j.areas?.length > 0 && h("div", { class: "job-areas-full" },
          h("p", { class: "job-creative-label" }, "Everything I run here"),
          jobAreas(j)),
        j.tags?.length > 0 && h("div", { class: "tags job-tags", role: "list", "aria-label": "Skills used in this role" },
          j.tags.map((t) => h("span", { class: "tag", role: "listitem" }, t))),
        j.creative?.length > 0 && h("div", { class: "job-creative" },
          h("p", { class: "job-creative-label" }, "Brand, design & creative direction"),
          h("ul", {}, j.creative.map((x) => h("li", {}, x))),
        ),
        j.highlights?.length > 0 && h("ul", {}, j.highlights.map(highlight)),
        j.earlier_roles?.length > 0 && h("div", { class: "job-earlier" },
          h("p", { class: "job-creative-label" }, "Earlier roles here"),
          h("ol", {}, j.earlier_roles.map((r) =>
            h("li", {}, h("span", { class: "job-earlier-years" }, r.years), h("strong", {}, r.title), r.note && h("span", { class: "job-earlier-note" }, r.note)))),
        ),
      ),
    ),
  );
}

// Certificates get their own section; the featured one is shown large.
function renderCerts(certs) {
  const box = $("#certs");
  if (!certs.length) return $("#certification").remove();
  const meta = (c) => [c.issuer, c.year, c.status].filter(Boolean).join(" · ");
  const [top, ...rest] = [...certs].sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
  box.replaceChildren(
    h("div", { class: "cert-card" },
      h("p", { class: "cert-kicker" }, "Featured certification"),
      h("h3", {}, top.name),
      h("p", { class: "cert-meta" }, meta(top)),
      top.description && h("p", { class: "cert-desc" }, top.description),
    ),
    // Same school as the featured one? Leave it out instead of repeating it.
    rest.length > 0 && h("ul", { class: "cert-more" }, rest.map((c) => h("li", {}, "Also: ", h("strong", {}, c.name), `, ${meta({ ...c, issuer: c.issuer === top.issuer ? "" : c.issuer })}`))),
  );
}

// What goes into each part of a role, e.g. Creative, Technology, Marketing.
// With short, each box shows only its first few items ("top", default 3).
function jobAreas(j, { short = false } = {}) {
  if (!j.areas?.length) return null;
  return h("dl", { class: short ? "job-areas short" : "job-areas" }, j.areas.map((a) => {
    const items = short ? (a.items || []).slice(0, a.top || 3) : (a.items || []);
    return h("div", { class: "job-area" },
      h("dt", {}, a.name),
      h("dd", {}, h("ul", {}, items.map((x) => h("li", {}, x)))),
    );
  }));
}

// "Label: details" becomes a bold label followed by the details.
function highlight(text) {
  const i = text.indexOf(": ");
  if (i > 0 && i < 40) return h("li", {}, h("strong", {}, text.slice(0, i)), " ", text.slice(i + 2));
  return h("li", {}, text);
}

function setupTheme() {
  const btn = $("#theme-toggle");
  const root = document.documentElement;
  const current = () => root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const label = () => {
    const dark = current() === "dark";
    btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    btn.setAttribute("aria-pressed", String(dark));
  };
  label();
  btn.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    label();
  });
}

function setupChrome() {
  const bar = $(".topbar");
  const onScroll = () => bar.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  // Both buttons open the print dialog, where "Save as PDF" gives a clean resume.
  $("#hero-resume").addEventListener("click", () => window.print());
  $("#exp-resume").addEventListener("click", () => window.print());
}

function setupReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) return items.forEach((el) => el.classList.add("in"));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  items.forEach((el) => io.observe(el));
  // Make sure everything is visible when printing.
  addEventListener("beforeprint", () => items.forEach((el) => el.classList.add("in")));
}

async function setupFeatures(d) {
  let status = { contact: false, intro: false };
  try { status = await fetch("/api/status").then((r) => r.json()); } catch {}
  if (status.contact) setupContact();
  if (d.intro) setupIntro(d);
}

// Marks form fields as invalid (or clears them) so screen readers announce the
// problem, and moves focus to the first one that needs fixing.
function flagFields(form, statusEl, badNames) {
  for (const el of form.querySelectorAll("input, textarea")) {
    const bad = badNames.includes(el.name);
    if (bad) {
      el.setAttribute("aria-invalid", "true");
      el.setAttribute("aria-describedby", statusEl.id);
    } else {
      el.removeAttribute("aria-invalid");
      el.removeAttribute("aria-describedby");
    }
  }
  if (badNames.length) form.elements[badNames[0]]?.focus();
}

// Welcome pop-up. Shows on every visit and every page load (including a refresh),
// a few seconds in (intro.delay_seconds in content.json). Once closed, it stays
// closed until the next page load. Add ?intro to the address to see it right away.
function setupIntro(d) {
  const testing = new URLSearchParams(location.search).has("intro");

  const box = $("#intro"), step1 = $("#intro-step-1"), form = $("#intro-form"), done = $("#intro-done");
  const status = $("#intro-status"), peek = $("#intro-peek"), workDialog = $("#work-dialog");
  const cfg = d.intro;
  const phone = matchMedia("(max-width: 760px)");
  let reason = null;
  let returnFocus = null;

  $("#intro-title").textContent = cfg.title;
  $("#intro-sub").textContent = cfg.subtitle || "";
  peek.textContent = cfg.title;
  $("#intro-reasons").replaceChildren(...cfg.reasons.map((r) =>
    h("button", { type: "button", class: "intro-reason", "data-id": r.id }, r.label)));

  const firstFocusable = () => (box.classList.contains("collapsed") ? peek : box.querySelector(".intro-reason"));

  const show = () => {
    if (!box.hidden) return;
    // Never pop up over a work piece someone is looking at; wait until it's closed.
    if (workDialog.open) {
      workDialog.addEventListener("close", () => setTimeout(show, 1500), { once: true });
      return;
    }
    // On phones, start as a slim bar at the bottom that opens when tapped.
    box.classList.toggle("collapsed", phone.matches && !testing);
    peek.hidden = !box.classList.contains("collapsed");
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add("open"));
    document.addEventListener("keydown", onKey);
    // Focus stays where it is, so screen-reader and keyboard users keep their place;
    // the pop-up is announced as a dialog and is the next stop when they press Tab.
  };
  const close = () => {
    const hadFocus = box.contains(document.activeElement);
    box.classList.remove("open");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => { box.hidden = true; }, 250);
    if (hadFocus && returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
  };
  function onKey(e) { if (e.key === "Escape") close(); }
  // Remember where keyboard focus was whenever it enters the pop-up, to return it there on close.
  box.addEventListener("focusin", (e) => { if (!box.contains(e.relatedTarget)) returnFocus = e.relatedTarget; });

  // Answers are always saved to the database (never sent through the visitor's email app).
  const send = async (payload) => {
    let referrer = "";
    try { referrer = document.referrer ? new URL(document.referrer).origin : ""; } catch {}
    const res = await fetch("/api/intro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, referrer }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Sorry, that didn't go through. Please try again in a moment.");
  };
  const finish = (text) => {
    $("#intro-done-text").textContent = text;
    step1.hidden = true; form.hidden = true; done.hidden = false;
    $("#intro-close").focus({ preventScroll: true });
    // Close on its own only if the visitor has moved on; never while they're still in it.
    setTimeout(() => { if (!box.contains(document.activeElement)) close(); }, 5000);
  };

  setTimeout(show, testing ? 300 : (cfg.delay_seconds ?? 30) * 1000);

  $("#intro-close").addEventListener("click", close);
  peek.addEventListener("click", () => {
    box.classList.remove("collapsed");
    peek.hidden = true;
    box.querySelector(".intro-reason")?.focus();
  });

  $("#intro-reasons").addEventListener("click", async (e) => {
    const btn = e.target.closest(".intro-reason");
    if (!btn) return;
    reason = btn.dataset.id;
    if (reason === "looking") {
      try { await send({ reason }); } catch {}
      return finish(cfg.thanks_looking);
    }
    $("#intro-form-title").textContent = btn.textContent;
    step1.hidden = true; form.hidden = false;
    $("#in-name").focus();
  });
  $("#intro-back").addEventListener("click", () => {
    form.hidden = true; step1.hidden = false; status.textContent = "";
    flagFields(form, status, []);
    box.querySelector(`.intro-reason[data-id="${reason}"]`)?.focus();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = { reason, ...Object.fromEntries(new FormData(form)) };
    status.className = "form-status";
    // Email is optional. Visitors just need to share something: a name, an email, or a note.
    const filled = ["name", "email", "message"].some((k) => payload[k]?.trim());
    const bad = !filled ? ["name"] : (payload.email.trim() && !form.elements.email.checkValidity() ? ["email"] : []);
    flagFields(form, status, bad);
    if (bad.length) {
      status.textContent = filled ? "That email doesn't look right. Fix it, or leave it blank." : "Please add your name or a short note.";
      status.classList.add("err");
      return;
    }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    status.textContent = "Sending…";
    try {
      await send(payload);
      const first = payload.name.trim().split(" ")[0];
      finish(first ? cfg.thanks.replace("{name}", first) : cfg.thanks.replace(/,?\s*\{name\}/, ""));
    } catch (err) {
      status.textContent = err.message;
      status.classList.add("err");
    } finally {
      btn.disabled = false;
    }
  });
}

function setupContact() {
  const form = $("#contact-form"), status = $("#form-status");
  form.hidden = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    const payload = Object.fromEntries(new FormData(form));
    status.className = "form-status";
    const bad = [];
    if (!payload.name.trim()) bad.push("name");
    if (!payload.email.trim() || !form.elements.email.checkValidity()) bad.push("email");
    if (!payload.message.trim()) bad.push("message");
    flagFields(form, status, bad);
    if (bad.length) {
      status.textContent = "Please add your name, a valid email, and a message.";
      status.classList.add("err");
      return;
    }
    btn.disabled = true;
    status.textContent = "Sending…";
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      form.reset();
      status.textContent = "Thanks! Your message was sent.";
      status.classList.add("ok");
    } catch (err) {
      status.textContent = err.message || "Could not send. Please email instead.";
      status.classList.add("err");
    } finally {
      btn.disabled = false;
    }
  });
}
