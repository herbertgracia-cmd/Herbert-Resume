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

// Set by renderWork: opens a Selected Work tab and scrolls to it (used by the opening reel).
let jumpToCategory = () => { location.hash = "#portfolio"; };

const data = await fetch("/content.json").then((r) => r.json());
render(data);
setupTheme();
setupChrome();
setupWorkDialog();
setupReveal();
setupReel(data);
setupFeatures(data);

function render(d) {
  const firstName = d.name.split(" ")[0];
  const initials = d.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2);
  const binds = { ...d, firstName, initials };
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const v = binds[el.dataset.bind];
    if (typeof v === "string") el.textContent = v;
  });
  // The summary's paragraphs (separated by a blank line) become separate <p>s.
  $(".hero-summary").replaceChildren(...String(d.summary || "").split(/\n\s*\n/).map((t) => h("p", {}, t)));
  // "Head of Brand · Creative Director · ..." gives the tab title "Head of Brand & Creative Director".
  document.title = d.seo_title || `${d.name} — ${d.role.split(" · ").slice(0, 2).join(" & ")}`;

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
    partners.replaceChildren(h("span", { class: "partners-label" }, d.partners_label || "Collaborations"), ...d.partners.map((x) => h("span", { class: "partner" }, x)));
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
      return h("div", { class: long ? "stat stat-text" : "stat" }, h("strong", {}, value), " ", h("span", {}, s.label));
    }));
  } else stats.remove();

  // Experience: 3 key bullets per job; the rest sits behind "More".
  $("#jobs").replaceChildren(...d.experience.map(renderJob));

  renderNow(d.now, d.work || []);
  renderFounder(d.entrepreneur, d.work || []);
  renderWork(d.work || [], d.work_categories || []);

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
  // Education gets its own section on the printed resume, so it isn't printed inside Skills.
  const rowClass = (k) => (k === "Education" ? "screen-only" : null);
  const factRows = (rows) => rows.flatMap(([k, v]) => [h("dt", { class: rowClass(k) }, k), h("dd", { class: rowClass(k) }, factItems(v))]);
  $("#facts").replaceChildren(...factRows(facts));
  $("#facts-all").replaceChildren(...factRows(allFacts));

  // Tools support the skills above, so they sit in one smaller line.
  if (d.tools?.length) {
    const tools = $("#tools");
    tools.replaceChildren(h("span", { class: "tools-label" }, "Tools"), " ", d.tools.join(" · "));
    tools.hidden = false;
  }

  renderAppliedAI(d.applied_ai);
  renderCerts(d.certifications || []);
  // Printed resume: a fuller summary with the keywords applicant tracking systems look for,
  // and Education as its own section ("School, Degree, graduation year").
  $("#print-summary").textContent = d.resume_summary || d.summary;
  const edu = (d.education || [])[0];
  $("#print-edu").textContent = edu ? `${edu.school}, ${edu.degree}, ${String(edu.year || "").slice(-4)}`.replace(/, $/, "") : "";
  // Printed resume: the exact titles recruiters search for.
  $("#print-seeking").textContent = d.seeking ? `Seeking: ${d.seeking}` : "";
  $("#print-industries").textContent = (d.industries || []).length
    ? `Industries: ${(d.industries || []).map((x) => x.name.replace(/ & (manufacturing|online video|generative AI|experiential)$/, "")).join(" · ")}` : "";

  // Printed resume: email and LinkedIn go at the top instead of a contact section at the end.
  // Printed resume: email, website, LinkedIn, and city under the name.
  const bare = (u) => u?.replace(/^https?:\/\/(www\.)?/, "");
  // Links stay clickable in the PDF.
  const contact = [
    d.links.email && h("a", { href: `mailto:${d.links.email}` }, d.links.email),
    safeUrl(d.links.website) && h("a", { href: safeUrl(d.links.website) }, bare(d.links.website)),
    safeUrl(d.links.linkedin) && h("a", { href: safeUrl(d.links.linkedin) }, bare(d.links.linkedin)),
    d.location && h("span", {}, d.location),
  ].filter(Boolean);
  // Each dot stays with the item after it, so a line never ends with a dot.
  $("#print-contact").replaceChildren(...contact.flatMap((x, i) => (i ? [" ", h("span", { class: "nowrap" }, "·\u00a0 ", x)] : [x])));

  const email = $("#contact-email");
  email.textContent = d.links.email;
  email.href = `mailto:${d.links.email}`;
  const linkNames = { linkedin: "LinkedIn", github: "GitHub", website: "Website" };
  $("#contact-links").replaceChildren(
    ...Object.entries(d.links)
      // The website itself isn't linked from its own contact section.
      .filter(([k, v]) => k !== "email" && k !== "website" && safeUrl(v))
      .map(([k, v]) => h("li", {}, h("a", { href: safeUrl(v), target: "_blank", rel: "noopener" }, `${linkNames[k] || k} ↗`))),
  );

  $("#year").textContent = new Date().getFullYear();

  // Number the sections that are shown: 01, 02, 03...
  // (Hidden from screen readers so headings read "Experience", not "01Experience".)
  document.querySelectorAll(".section:not(.print-only) .num").forEach((n, k) => {
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
  const src = item.cover_image || item.image || item.images?.[0]?.src || video?.thumb;
  // Poster colors follow the piece's first category, so every PR poster matches the PR tab.
  const CAT_HUE = { "cat-brand": 0, "cat-design": 1, "cat-tech-projects": 2, "cat-marketing": 3, "cat-events": 4, "cat-pr": 5, "cat-pr-communications": 5 };
  const catHue = CAT_HUE[categoryClass(item.category)] ?? hue;
  const cover = h("div", { class: `work-cover ${categoryClass(item.category)} hue-${catHue % 6}`, "aria-hidden": "true" });
  if (src) {
    cover.classList.add("has-image");
    // Logos show whole on a dark background instead of being cropped.
    if (item.imageFit === "contain") cover.classList.add("fit-contain");
    if (item.imageFit === "contain-light") cover.classList.add("fit-contain", "light");
    const img = h("img", { src, alt: "", loading: large ? null : "lazy" });
    if (item.cover_position) img.style.objectPosition = item.cover_position;
    cover.append(img);
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

function renderWork(items, catMeta = []) {
  const section = $("#portfolio");
  if (!items.length) return section.remove();

  // Tabs come from content.json "work_categories" (Brand, Design, Events, Marketing, PR), in that order.
  const order = catMeta.map((c) => c.name);
  const intros = Object.fromEntries(catMeta.map((c) => [c.name, c.intro]));
  const cats = [...new Set(items.flatMap(categoriesOf))]
    .sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  const filters = $("#work-filters");
  const grid = $("#work-grid");
  const introEl = $("#work-intro");
  $("#work-list")?.remove();
  $("#work-more")?.remove();
  const caption = (item) => item.caption || item.summary;

  // Every piece is an image tile; the case study opens in the dialog.
  const entries = items.map((item, i) => {
    const el = h("li", { class: "reveal work-tile", "data-category": JSON.stringify(categoriesOf(item)) },
      h("button", {
          class: isCaseStudy(item) ? "work-card is-case" : "work-card", type: "button", "aria-haspopup": "dialog",
          "aria-labelledby": `work-title-${i}`, "aria-describedby": `work-desc-${i}`,
        },
        workCover(item, { hue: i, large: i === 0 }),
        h("span", { class: "work-open", "aria-hidden": "true" }, isCaseStudy(item) ? "Read case study →" : "See the work →"),
        h("span", { class: "work-cap" },
          h("span", { class: "work-chips", "aria-hidden": "true" }, categoriesOf(item).map((c) => h("span", { class: `work-chip ${categoryClass(c)}` }, c))),
          h("h3", { id: `work-title-${i}` }, item.title),
          h("span", { id: `work-desc-${i}` },
            item.result && h("span", { class: "work-result" }, item.result),
            h("span", { class: "work-text" }, caption(item)),
          ),
        ),
      ));
    el.querySelector("button").addEventListener("click", () => openWork(item, i));
    el.style.viewTransitionName = `work-tile-${i}`; // lets tiles glide to their new spots when a tab changes
    return el;
  });
  grid.replaceChildren(...entries);

  // The category tabs stick just under the top bar, whose height changes with the screen size.
  const bar = document.querySelector(".topbar");
  const setBarHeight = () => document.documentElement.style.setProperty("--topbar-h", `${bar?.offsetHeight || 64}px`);
  setBarHeight();
  addEventListener("resize", setBarHeight);

  // The first visible tile is large; the last one stretches so the final row has no gap.
  const markLead = () => {
    const shown = [...grid.children].filter((e) => !e.hidden); // on-screen order
    entries.forEach((e) => { e.classList.remove("is-lead"); e.style.gridColumn = ""; e.style.gridRow = ""; });
    shown[0]?.classList.add("is-lead");
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
    if (cols < 2 || shown.length < 2) return;
    // Only two pieces on desktop: the second stands full height beside the large one.
    if (cols >= 3 && shown.length === 2) { shown[1].style.gridRow = "span 2"; return; }
    const leadCells = cols >= 3 ? 4 : cols; // 2x2 on desktop, a full row on tablets
    const filled = (leadCells + shown.length - 1) % cols;
    if (filled) shown[shown.length - 1].style.gridColumn = `span ${cols - filled + 1}`;
  };
  addEventListener("resize", () => markLead());
  markLead();
  const allIntro = "20+ years of brand, design, events, marketing, and PR. Pick a tab to see one kind of work.";
  introEl.textContent = allIntro;
  if (cats.length < 2) return filters.remove();

  const count = (c) => (c === "All" ? items.length : items.filter((it) => categoriesOf(it).includes(c)).length);
  const buttons = ["All", ...cats].map((c) =>
    h("button", { type: "button", "aria-pressed": String(c === "All"), "data-filter": c },
      c, h("span", { class: "work-filter-n", "aria-hidden": "true" }, count(c))),
  );
  filters.replaceChildren(...buttons);
  filters.hidden = false;

  const apply = (f) => {
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === f)));
    // Each tab leads with the pieces where that category comes first (e.g. the 50th and the stores on Events).
    const rank = (el) => (f === "All" ? 0 : JSON.parse(el.dataset.category).indexOf(f));
    grid.append(...entries.map((el, i) => [el, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([el]) => el));
    entries.forEach((c) => { c.hidden = f !== "All" && !JSON.parse(c.dataset.category).includes(f); c.classList.add("in"); });
    markLead();
    introEl.textContent = f === "All" ? allIntro : intros[f] || "";
    const shown = entries.filter((c) => !c.hidden).length;
    $("#work-count").textContent = f === "All" ? `Showing all ${entries.length} pieces` : `Showing ${shown} of ${entries.length}: ${f}`;
  };
  // Smooth re-layout where the browser supports view transitions; instant otherwise.
  const select = (f) => {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !still) document.startViewTransition(() => apply(f));
    else apply(f);
  };
  filters.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (btn) select(btn.dataset.filter);
  });

  jumpToCategory = (c) => {
    if (buttons.some((b) => b.dataset.filter === c)) select(c);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    $("#portfolio").scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", "#portfolio");
  };

  // Hero shortcuts: each category jumps to the work and opens that tab.
  const heroCats = $("#hero-cats");
  if (heroCats) {
    heroCats.replaceChildren(h("span", { class: "hero-cats-label" }, "Explore the work"), ...cats.map((c) => {
      const a = h("a", { href: "#portfolio", class: `hero-cat ${categoryClass(c)}` }, c);
      a.addEventListener("click", () => select(c));
      return a;
    }));
    heroCats.hidden = false;
  }
}

// A small button that opens one of the work pieces, by its title in content.json.
function workLink(title, items) {
  const i = items.findIndex((w) => w.title === title);
  if (i < 0) return null;
  const b = h("button", { type: "button", class: "see-work" }, `${title} →`);
  b.addEventListener("click", () => openWork(items[i], i));
  return b;
}

// Now: the current job, broken into focus areas, plus the path of titles at Fromm.
function renderNow(now, items) {
  const section = $("#now");
  if (!now) return section.remove();
  const body = $("#now-body");
  body.replaceChildren(
    h("div", { class: "now-head" },
      h("p", { class: "now-eyebrow" }, now.eyebrow),
      h("h3", { class: "now-title" }, now.title),
      h("p", { class: "now-org" }, now.org),
      h("ul", { class: "now-facts", role: "list" }, (now.facts || []).map((f) => h("li", {}, f))),
      h("p", { class: "now-team" }, now.team),
    ),
    h("ol", { class: "now-areas", role: "list" }, (now.areas || []).map((a, k) =>
      h("li", { class: "now-area reveal" },
        h("p", { class: "now-area-num", "aria-hidden": "true" }, String(k + 1).padStart(2, "0")),
        h("h4", {}, a.name),
        h("p", { class: "now-area-line" }, a.line),
        h("ul", { class: "now-points" }, a.points.map(highlight)),
        (a.work || []).length > 0 && h("p", { class: "see-row" }, h("span", { class: "see-label" }, "See"), ...a.work.map((t) => workLink(t, items))),
      ))),
    now.path && h("div", { class: "now-path" },
      h("p", { class: "now-path-label" }, now.path_label || "Path"),
      h("ol", { class: "path", role: "list" }, now.path.map((p, k) =>
        h("li", { class: k === now.path.length - 1 ? "path-step is-now" : "path-step" },
          h("span", { class: "path-year" }, p.year),
          h("span", { class: "path-title" }, p.title),
          p.note && h("span", { class: "path-note" }, p.note),
        ))),
      now.path_caption && h("p", { class: "now-path-caption" }, now.path_caption),
    ),
  );
  section.hidden = false;
}

// Entrepreneur: the two apparel brands, side by side, with their exits.
function renderFounder(ent, items) {
  const section = $("#entrepreneur");
  if (!ent) return section.remove();
  $("#ent-body").replaceChildren(
    h("div", { class: "founder-head" },
      h("p", { class: "now-eyebrow" }, ent.eyebrow),
      h("h3", { class: "founder-headline" }, ent.headline),
      h("p", { class: "founder-sub" }, ent.sub),
    ),
    h("ul", { class: "brands", role: "list" }, (ent.brands || []).map((b) =>
      h("li", { class: "brand-card reveal" },
        h("div", { class: "brand-top" },
          h("h4", {}, b.name),
          h("p", { class: "brand-meta" }, h("span", {}, b.years), h("span", { class: "brand-exit" }, b.exit)),
        ),
        h("ul", { class: "now-points" }, b.points.map(highlight)),
        (b.work || []).length > 0 && h("p", { class: "see-row" }, h("span", { class: "see-label" }, "See"), ...b.work.map((t) => workLink(t, items))),
      ))),
  );
  section.hidden = false;
}

// The opening reel: five photos, one per skill (content.json "reel": category, file, proof). Full 3D (reel.js)
// where WebGL works and motion is allowed; otherwise the same five as a labeled grid. Each one opens that
// skill's tab in Selected Work.
function setupReel(d) {
  const tiles = (d.reel || []).filter((r) => r && r.category && r.file).slice(0, 6).map((r, i) => ({
    category: r.category, name: r.label || r.category, proof: r.proof || "", num: String(i + 1).padStart(2, "0"),
    cls: categoryClass(r.category), src: "/work/" + r.file,
  }));
  if (tiles.length < 3) return;
  const root = document.documentElement;
  root.classList.add("reel-on");
  const go = (cat) => jumpToCategory(cat);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const probe = document.createElement("canvas");
  const webgl = !!(probe.getContext("webgl2") || probe.getContext("webgl"));
  const saveData = navigator.connection?.saveData; // respect "save data" on phones: skip the 3D download
  if (still || !webgl || saveData) return reelGrid(tiles, go);
  import("/reel.js")
    .then((m) => { if (!m.start({ tiles, onOpen: go, label: reelLabel })) reelGrid(tiles, go); })
    .catch(() => reelGrid(tiles, go));
}

// One skill label: "● 01 Design →" plus its proof line. A real link to the work, so it works by keyboard too.
function reelLabel(t, onOpen) {
  const a = h("a", { href: "#portfolio", class: `reel-label ${t.cls}` },
    h("span", { class: "reel-label-name" }, h("span", { class: "reel-dot", "aria-hidden": "true" }), h("span", { class: "reel-num" }, t.num), ` ${t.name} `, h("span", { "aria-hidden": "true" }, "→")),
    t.proof ? h("span", { class: "reel-label-proof" }, t.proof) : null);
  a.addEventListener("click", (e) => { e.preventDefault(); onOpen(t.category); });
  return a;
}

// The no-3D reel: the five photos as a labeled grid that fades in once you start scrolling.
function reelGrid(tiles, onOpen) {
  const stage = document.querySelector(".reel-stage");
  const wrap = $("#reel");
  const root = document.documentElement;
  if (!stage || !wrap) return;
  $("#reel-canvas")?.remove();
  stage.classList.add("is-grid");
  const grid = h("ul", { class: "reel-grid", role: "list", "aria-label": "My work by skill" }, tiles.map((t) => {
    const img = h("img", { src: t.src, alt: "", loading: "lazy", decoding: "async" });
    const pic = h("button", { type: "button", class: "reel-tile", tabindex: "-1", "aria-hidden": "true" }, img);
    pic.addEventListener("click", () => onOpen(t.category));
    return h("li", { class: "reel-cell" }, pic, reelLabel(t, onOpen));
  }));
  stage.prepend(grid);
  const hint = $("#reel-hint");
  const onScroll = () => {
    const r = wrap.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, wrap.offsetHeight - innerHeight)));
    stage.classList.toggle("is-shown", p > 0.06);
    const panel = document.querySelector(".hero-panel-bg");
    root.classList.toggle("over-reel", (panel ? panel.getBoundingClientRect().top : r.bottom) > 72);
    if (hint) hint.style.opacity = String(1 - Math.min(1, p * 6));
  };
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });
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
    const strip = h("div", { class: "work-media gallery", tabindex: "0", role: "region", "aria-label": `${item.title} photos` },
      // Photos after the first load only as they come near; width and height keep the strip from jumping.
      item.images.map((img, k) => h("img", { src: img.src, alt: img.alt || item.title, loading: k > 1 ? "lazy" : null, decoding: "async", width: img.w || null, height: img.h || null })));
    const count = h("span", { class: "gallery-count", "aria-live": "polite" }, `1 of ${item.images.length}`);
    const imgs = () => [...strip.querySelectorAll("img")];
    // The photo nearest the middle of the strip.
    const current = () => {
      const mid = strip.scrollLeft + strip.clientWidth / 2;
      const all = imgs();
      return all.reduce((best, img, k) => (Math.abs(img.offsetLeft + img.offsetWidth / 2 - mid) < Math.abs(all[best].offsetLeft + all[best].offsetWidth / 2 - mid) ? k : best), 0);
    };
    const prev = h("button", { class: "gallery-btn", type: "button", "aria-label": "Previous photo" }, "‹");
    const next = h("button", { class: "gallery-btn", type: "button", "aria-label": "Next photo" }, "›");
    // The photo being shown: drives the "3 of 7" counter (updated only when it changes,
    // so screen readers hear it once) and greys out the arrow at either end.
    let shown = 0;
    let stepping = null;
    prev.disabled = true;
    const show = (k) => {
      if (k === shown) return;
      shown = k;
      count.textContent = `${k + 1} of ${imgs().length}`;
      prev.disabled = k === 0;
      next.disabled = k === imgs().length - 1;
    };
    // Arrows move exactly one photo from the one shown, centering it.
    const step = (dir) => {
      const all = imgs();
      const k = Math.max(0, Math.min(all.length - 1, shown + dir));
      const target = all[k];
      show(k);
      clearTimeout(stepping);
      stepping = setTimeout(() => { stepping = null; }, 700);
      const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      strip.scrollTo({ left: target.offsetLeft - (strip.clientWidth - target.offsetWidth) / 2, behavior: smooth ? "smooth" : "auto" });
    };
    prev.addEventListener("click", () => step(-1));
    next.addEventListener("click", () => step(1));
    // Swiping: follow the photo nearest the middle (the ends count as the first and last photo).
    strip.addEventListener("scroll", () => {
      if (stepping) return;
      const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2;
      show(strip.scrollLeft <= 2 ? 0 : atEnd ? imgs().length - 1 : current());
    }, { passive: true });
    media = h("div", { class: "gallery-wrap" }, strip, h("div", { class: "gallery-bar" }, prev, count, next));
  } else if (item.image || item.images?.length) {
    const img = item.images?.[0] || { src: item.image, alt: item.imageAlt };
    const fit = { contain: " fit-contain", "contain-light": " fit-contain light" }[item.imageFit] || "";
    media = h("div", { class: `work-media${fit}` }, h("img", { src: img.src, alt: img.alt || item.title }));
  } else {
    media = workCover(item, { large: true, hue: index });
    media.classList.add("work-media");
  }

  // Case studies read as challenge → responsibility → decisions → result (the photos are the work);
  // other pieces just list role and partners.
  const facts = (isCaseStudy(item)
    ? [["The challenge", item.challenge], ["My responsibility", item.role], ["The decisions", item.approach], ["The result", item.outcome], ["With", item.collaborators]]
    : [["My role", item.role], ["With", item.collaborators]]
  ).filter(([, v]) => v);
  const linkLabel = item.linkLabel || (item.video && !video ? "Watch" : "View project");
  const linkUrl = safeUrl(item.link || (item.video && !video ? item.video : "")) || "";

  // A short summary sits above the photos, so the story starts before the gallery.
  $("#work-dialog-body").replaceChildren(
    h("div", { class: "work-dialog-head" },
      h("p", { class: "work-meta" }, item.tag || categoriesOf(item).join(" + "), item.year && ["\u00a0· ", h("span", { class: "nowrap" }, item.year)]),
      h("h3", { id: "work-dialog-title" }, item.title),
      h("p", {}, item.summary),
    ),
    media,
    h("div", { class: "work-dialog-text" },
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
  // The page shows a short version (one line, 2-3 points, the exit label).
  // The printed resume and "More" carry the full summary and bullets, which hold the keywords
  // applicant tracking systems search for.
  const points = j.points?.length ? j.points : (j.key || []).slice(0, 3);
  const key = j.key?.length ? j.key : points;
  const line = j.line || j.summary;
  const moreSummary = j.summary && j.summary !== line ? j.summary : null;
  const moreKey = key.join() !== points.join() ? key : [];
  const earlier = j.earlier_roles || [];
  const hasMore = moreSummary || moreKey.length || j.exit_note || j.creative?.length || j.highlights?.length || j.earlier_roles?.length || j.areas?.length || j.tags?.length;
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
      j.exit && h("p", { class: "job-exit" }, j.exit),
      // Printed resume only.
      h("div", { class: "job-print" },
        j.summary && h("p", { class: "job-summary" }, j.summary),
        key.length > 0 && h("ul", { class: "job-key" }, key.map(highlight)),
        j.exit_note && h("p", { class: "job-exit-note" }, j.exit_note),
        earlier.length > 0 && h("div", { class: "job-earlier-print" },
          h("p", {}, "Earlier roles here:"),
          h("ul", {}, earlier.map((r) => h("li", {}, `${r.title}, ${r.years}`)))),
      ),
      hasMore && h("details", { class: "job-more" },
        h("summary", {}, "More about this role"),
        moreSummary && h("p", { class: "job-summary" }, moreSummary),
        moreKey.length > 0 && h("ul", { class: "job-key" }, moreKey.map(highlight)),
        j.exit_note && h("p", { class: "job-exit-note" }, j.exit_note),
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

// Applied AI: one real workflow, step by step, then what's in development.
// The certificates sit under it (renderCerts).
function renderAppliedAI(ai) {
  if (!ai?.steps?.length) return;
  const box = $("#applied-ai");
  box.replaceChildren(
    ai.lead && h("p", { class: "ai-lead" }, ai.lead),
    h("div", { class: "ai-example" },
      ai.example_title && h("h3", {}, ai.example_title),
      h("ol", { class: "ai-steps", role: "list" }, ai.steps.map((st) => h("li", {}, h("strong", {}, st.label), h("span", {}, st.text)))),
    ),
    (ai.also || []).length > 0 && h("ul", { class: "ai-also" },
      ai.also.map((a) => h("li", {}, a.label && h("span", { class: "ai-badge" }, a.label), " ", a.text))),
  );
  box.hidden = false;
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
  if (i > 0 && i < 40) return h("li", {}, h("strong", {}, text.slice(0, i + 1)), " ", text.slice(i + 2));
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

  // With "once", a returning visitor (a recruiter comparing candidates) doesn't see it again.
  const seenKey = "intro-seen";
  let seen = false;
  try { seen = cfg.once && localStorage.getItem(seenKey) === "1"; } catch {}
  if (!seen || testing) {
    setTimeout(() => {
      show();
      try { if (cfg.once) localStorage.setItem(seenKey, "1"); } catch {}
    }, testing ? 300 : (cfg.delay_seconds ?? 30) * 1000);
  }

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
