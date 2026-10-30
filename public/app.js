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
  } else stats.closest(".stats-band").remove();

  // Experience: 3 key bullets per job; the rest sits behind "More".
  $("#jobs").replaceChildren(...d.experience.map(renderJob));

  renderWork(d.work || []);

  // Expertise & education as a short list of labeled lines.
  const facts = [
    ...(d.skills || []).filter((g) => g.group !== "Languages").map((g) => [g.group, g.items.join(" · ")]),
    ["Industries", (d.industries || []).map((x) => x.name).join(" · ")],
    ["Languages", (d.skills || []).find((g) => g.group === "Languages")?.items.join(" · ")],
    [(d.certifications || []).length > 1 ? "Certificates" : "Certificate", certificateLine(d.certifications || [])],
    ["Education", (d.education || []).slice(0, 1).map((e) => `${e.school}, ${[e.degree, e.year].filter(Boolean).join(", ")}`).join("")],
  ].filter(([, v]) => v);
  $("#facts").replaceChildren(...facts.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]));

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
  return "cat-" + String(cat || "other").toLowerCase().replace(/[^a-z]+/g, "-");
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
  } else {
    cover.append(
      h("span", { class: "work-cover-meta" }, h("span", {}, item.category || ""), h("span", {}, item.year || "")),
      h("span", { class: "work-cover-title" }, item.title),
    );
  }
  if (item.video) cover.append(h("span", { class: "play" }, "▶"));
  return cover;
}

function renderWork(items) {
  const section = $("#portfolio");
  if (!items.length) return section.remove();

  const CATEGORY_ORDER = ["Design", "Marketing", "Video", "Events", "Storytelling", "Collaborations", "Technology", "AI"];
  const cats = [...new Set(items.map((i) => i.category).filter(Boolean))]
    .sort((a, b) => (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99));
  const filters = $("#work-filters");
  const grid = $("#work-grid");

  const cards = items.map((item, i) => {
    // Poster covers already show the title, category, and year, so the text below
    // only repeats them for screen readers; image covers show them below as usual.
    const poster = !item.image && !item.images?.length && !videoInfo(item.video);
    const caseStudy = isCaseStudy(item);
    return h("li", { class: poster ? "reveal is-poster" : "reveal", "data-category": item.category || "" },
      h("button", { class: "work-card", type: "button", "aria-haspopup": "dialog" },
        workCover(item, { hue: i }),
        h("div", { class: "work-meta" },
          h("span", {}, item.category || ""),
          item.year && h("span", {}, item.year),
        ),
        h("h3", {}, item.title),
        h("p", {}, item.summary),
        caseStudy && h("span", { class: "work-cta" }, "Read the case study →"),
      ),
    );
  });
  cards.forEach((card, i) => card.querySelector("button").addEventListener("click", () => openWork(items[i], i)));
  grid.replaceChildren(...cards);

  // Show only featured pieces at first; "See all work" reveals the rest and the filters.
  const featured = items.map((i) => !!i.featured);
  const more = $("#work-more");
  if (featured.some(Boolean) && !featured.every(Boolean)) {
    cards.forEach((c, i) => { if (!featured[i]) { c.hidden = true; c.dataset.extra = "1"; } });
    more.textContent = `See all work (${items.length})`;
    more.hidden = false;
    more.addEventListener("click", () => {
      const firstNew = cards.find((c) => c.dataset.extra);
      // On phones the extra pieces show as a compact list (see .compact in styles.css).
      cards.forEach((c) => { if (c.dataset.extra) c.classList.add("compact"); c.hidden = false; c.classList.add("in"); delete c.dataset.extra; });
      filters.hidden = false;
      more.remove();
      // Keep keyboard users in place: move focus to the first newly shown piece.
      firstNew?.querySelector("button").focus();
    });
  } else {
    filters.hidden = false;
    more.remove();
  }

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
    cards.forEach((c) => { c.hidden = f !== "All" && c.dataset.category !== f; c.classList.add("in"); });
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
      h("p", { class: "work-meta" }, h("span", {}, item.category || ""), item.year && h("span", {}, item.year)),
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

// "A and B, University of San Francisco" when they share an issuer; otherwise each with its own.
function certificateLine(certs) {
  if (!certs.length) return "";
  const issuers = [...new Set(certs.map((c) => c.issuer).filter(Boolean))];
  if (issuers.length === 1 && certs.every((c) => c.issuer === issuers[0]) && certs.every((c) => !c.year)) {
    return `${certs.map((c) => c.name).join(" and ")}, ${issuers[0]}`;
  }
  return certs.map((c) => [c.name, c.issuer, c.year].filter(Boolean).join(", ")).join(" · ");
}

function renderJob(j) {
  const key = j.key?.length ? j.key : (j.highlights || []).slice(0, 3);
  const hasMore = j.creative?.length || j.highlights?.length || j.earlier_roles?.length;
  return h("li", { class: "job reveal" },
    h("div", { class: "job-dates" },
      j.start ? `${j.start}–${j.end}` : "",
      j.since && h("span", { class: "job-since" }, j.since),
      j.location && h("span", { class: "job-location" }, j.location),
    ),
    h("div", {},
      h("h3", {}, j.role, j.company && " ", j.company && h("span", { class: "at" }, `at ${j.company}`)),
      j.summary && h("p", { class: "job-summary" }, j.summary),
      key.length > 0 && h("ul", { class: "job-key" }, key.map(highlight)),
      hasMore && h("details", { class: "job-more" },
        h("summary", {}, "More about this role"),
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

// "Label: details" becomes a bold label followed by the details.
function highlight(text) {
  const i = text.indexOf(": ");
  if (i > 0 && i < 40) return h("li", {}, h("strong", {}, text.slice(0, i)), " ", text.slice(i + 2));
  return h("li", {}, text);
}

function setupTheme() {
  $("#theme-toggle").addEventListener("click", () => {
    const root = document.documentElement;
    const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
  });
}

function setupChrome() {
  const bar = $(".topbar");
  const onScroll = () => bar.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  // Both buttons open the print dialog, where "Save as PDF" gives a clean resume.
  $("#print-btn").addEventListener("click", () => window.print());
  $("#hero-resume").addEventListener("click", () => window.print());
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
    // Move focus into the pop-up only if the visitor isn't busy with something else.
    const active = document.activeElement;
    if (!active || active === document.body) {
      returnFocus = null;
      firstFocusable()?.focus({ preventScroll: true });
    }
  };
  const close = () => {
    const hadFocus = box.contains(document.activeElement);
    box.classList.remove("open");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => { box.hidden = true; }, 250);
    if (hadFocus) (returnFocus && document.contains(returnFocus) ? returnFocus : $("#main")).focus({ preventScroll: true });
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
    step1.hidden = true; form.hidden = true; done.hidden = false;
    $("#intro-done-text").textContent = text;
    $("#intro-close").focus({ preventScroll: true });
    setTimeout(close, 5000);
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
