// Fills the page from content.json and wires up theme, chat, and contact form.

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
  document.title = `${d.name} — Resume`;

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
  // Roles I'm looking for, under the tagline.
  if (d.looking_for?.length) {
    const seek = $("#hero-seeking");
    seek.replaceChildren(h("span", { class: "hero-seeking-label" }, "Open to"), " ", d.looking_for.join(" · "));
    seek.hidden = false;
  }
  if (d.links?.linkedin) {
    const li = $("#hero-linkedin");
    li.href = d.links.linkedin;
    li.hidden = false;
  }

  // Hero name: one line per word, last word in italic accent.
  const nameEl = $(".hero-name");
  nameEl.replaceChildren(...d.name.split(/\s+/).map((w) => h("span", { class: "line" }, w)));

  // Key numbers under the hero.
  const stats = $("#stats");
  if (d.stats?.length) {
    stats.replaceChildren(...d.stats.map((s) => h("div", { class: "stat" }, h("strong", {}, s.value), h("span", {}, s.label))));
  } else stats.parentElement.remove();

  // What I do: one short block per area of expertise.
  if (d.pillars?.length) {
    $("#pillars").replaceChildren(...d.pillars.map((p) =>
      h("li", { class: "pillar reveal" },
        h("h3", {}, p.title),
        p.summary && h("p", {}, p.summary),
        p.proof?.length > 0 && h("ul", {}, p.proof.map((x) => h("li", {}, x))),
      )));
  } else $("#expertise").remove();

  // Experience: key bullets and skill tags per job; the rest sits in a pop-up.
  $("#jobs").replaceChildren(...d.experience.map(renderJob));

  renderWork(d.work || []);

  // Skills & industries as a short list of labeled lines.
  const facts = [
    ["Industries", (d.industries || []).map((x) => x.name).join(" · ")],
    ...(d.skills || []).filter((g) => g.group !== "Languages").map((g) => [g.group, g.items.join(" · ")]),
    ["Languages", (d.skills || []).find((g) => g.group === "Languages")?.items.join(" · ")],
    ["Certificate", (d.certifications || []).map((c) => [c.name, c.issuer, c.year].filter(Boolean).join(", ")).join(" · ")],
    ["Education", (d.education || []).slice(0, 1).map((e) => `${e.school}, ${[e.degree, e.year].filter(Boolean).join(", ")}`).join("")],
  ].filter(([, v]) => v);
  $("#facts").replaceChildren(...facts.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]));

  const email = $("#contact-email");
  email.textContent = d.links.email;
  email.href = `mailto:${d.links.email}`;
  const linkNames = { linkedin: "LinkedIn", github: "GitHub", website: "Website" };
  $("#contact-links").replaceChildren(
    ...Object.entries(d.links)
      .filter(([k, v]) => k !== "email" && v)
      .map(([k, v]) => h("li", {}, h("a", { href: v, target: "_blank", rel: "noopener" }, `${linkNames[k] || k} ↗`))),
  );

  $("#year").textContent = new Date().getFullYear();

  // Number the sections that are shown: 01, 02, 03...
  document.querySelectorAll(".section .num").forEach((n, k) => { n.textContent = String(k + 1).padStart(2, "0"); });
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
  const name = String(cat || "other").toLowerCase();
  // All the design types (Web design, Print design...) share the design color.
  if (name.endsWith("design")) return "cat-design";
  return "cat-" + name.replace(/[^a-z]+/g, "-");
}

// "category" can be one name or a list, e.g. ["Product design", "Print design"].
function categoriesOf(item) {
  return [].concat(item.category || []).filter(Boolean);
}

function workCover(item, large = false) {
  const video = videoInfo(item.video);
  const src = item.image || video?.thumb;
  const cover = h("div", { class: `work-cover ${categoryClass(categoriesOf(item)[0])}` });
  if (src) {
    cover.append(h("img", { src, alt: item.imageAlt || "", loading: large ? null : "lazy" }));
  } else {
    cover.append(h("span", { class: "work-cover-title" }, item.title));
  }
  if (item.video) cover.append(h("span", { class: "play", "aria-hidden": "true" }, "▶"));
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

  const cards = items.map((item) =>
    h("li", { class: "reveal", "data-category": JSON.stringify(categoriesOf(item)) },
      h("button", { class: "work-card", type: "button", "aria-haspopup": "dialog" },
        workCover(item),
        h("div", { class: "work-meta" },
          h("span", {}, categoriesOf(item).slice(0, 2).join(" + ")),
          item.year && h("span", {}, item.year),
        ),
        h("h3", {}, item.title),
        h("p", {}, item.summary),
      ),
    ),
  );
  cards.forEach((card, i) => card.querySelector("button").addEventListener("click", () => openWork(items[i])));
  grid.replaceChildren(...cards);

  // Show only featured pieces at first; "See all work" reveals the rest and the filters.
  const featured = items.map((i) => !!i.featured);
  const more = $("#work-more");
  if (featured.some(Boolean) && !featured.every(Boolean)) {
    cards.forEach((c, i) => { if (!featured[i]) { c.hidden = true; c.dataset.extra = "1"; } });
    more.textContent = `See all work (${items.length})`;
    more.hidden = false;
    more.addEventListener("click", () => {
      cards.forEach((c) => { c.hidden = false; c.classList.add("in"); delete c.dataset.extra; });
      filters.hidden = false;
      more.remove();
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
    cards.forEach((c) => { c.hidden = f !== "All" && !JSON.parse(c.dataset.category).includes(f); c.classList.add("in"); });
  });
}

function openWork(item) {
  const dialog = $("#work-dialog");
  const video = videoInfo(item.video);
  let media;
  if (video) {
    media = h("div", { class: "work-media video" },
      h("iframe", {
        src: video.embed, title: item.title,
        allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowfullscreen: "",
      }));
  } else if (item.image) {
    media = h("div", { class: "work-media" }, h("img", { src: item.image, alt: item.imageAlt || item.title }));
  } else {
    media = workCover(item, true);
    media.classList.add("work-media");
  }

  const facts = [["My role", item.role], ["With", item.collaborators]].filter(([, v]) => v);
  const linkLabel = item.linkLabel || (item.video && !video ? "Watch" : "View project");
  const linkUrl = item.link || (item.video && !video ? item.video : "");

  $("#work-dialog-body").replaceChildren(
    media,
    h("div", { class: "work-dialog-text" },
      h("p", { class: "work-meta" }, h("span", {}, categoriesOf(item).join(" + ")), item.year && h("span", {}, item.year)),
      h("h3", { id: "work-dialog-title" }, item.title),
      h("p", {}, item.summary),
      item.details && h("p", { class: "muted" }, item.details),
      facts.length > 0 && h("dl", { class: "work-facts" }, facts.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])),
      item.tags?.length > 0 && h("div", { class: "tags" }, item.tags.map((t) => h("span", { class: "tag" }, t))),
      linkUrl && h("a", { class: "btn btn-small", href: linkUrl, target: "_blank", rel: "noopener" }, `${linkLabel} ↗`),
    ),
  );
  dialog.showModal();
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
  const key = j.key?.length ? j.key : (j.highlights || []).slice(0, 3);
  const photos = j.photos || [];
  const hasMore = Boolean(photos.length || j.creative?.length || j.highlights?.length || j.earlier_roles?.length);
  const more = !hasMore ? null : h("button", { class: "job-open", type: "button", "aria-haspopup": "dialog" },
    photos.length ? `Photos & more about this role (${photos.length})` : "More about this role");
  more?.addEventListener("click", () => openJob(j));
  return h("li", { class: "job reveal" },
    h("div", { class: "job-dates" }, j.start ? `${j.start} — ${j.end}` : "", j.location && h("span", { class: "job-location" }, j.location)),
    h("div", {},
      h("h3", {}, j.role, j.company && " ", j.company && h("span", { class: "at" }, `at ${j.company}`)),
      j.summary && h("p", { class: "job-summary" }, j.summary),
      key.length > 0 && h("ul", { class: "job-key" }, key.map(highlight)),
      j.tags?.length > 0 && h("div", { class: "tags job-tags", role: "list", "aria-label": "Skills used in this role" },
        j.tags.map((t) => h("span", { class: "tag", role: "listitem" }, t))),
      more,
    ),
  );
}

// Pop-up for one job: photos (if any) plus everything about the role.
function openJob(j) {
  const photos = j.photos || [];
  $("#work-dialog-body").replaceChildren(
    ...(photos.length ? [gallery(photos, j.company)] : []),
    h("div", { class: "work-dialog-text job-dialog-text" },
      h("p", { class: "work-meta" }, h("span", {}, j.start ? `${j.start} — ${j.end}` : ""), j.location && h("span", {}, j.location)),
      h("h3", { id: "work-dialog-title" }, j.role, j.company && h("span", { class: "at" }, ` at ${j.company}`)),
      j.summary && h("p", {}, j.summary),
      j.tags?.length > 0 && h("div", { class: "tags" }, j.tags.map((t) => h("span", { class: "tag" }, t))),
      j.creative?.length > 0 && h("div", { class: "job-creative" },
        h("p", { class: "job-creative-label" }, "Brand, design & creative direction"),
        h("ul", {}, j.creative.map((x) => h("li", {}, x))),
      ),
      j.highlights?.length > 0 && h("ul", { class: "job-highlights" }, j.highlights.map(highlight)),
      j.earlier_roles?.length > 0 && h("div", { class: "job-earlier" },
        h("p", { class: "job-creative-label" }, "Earlier roles here"),
        h("ol", {}, j.earlier_roles.map((r) =>
          h("li", {}, h("span", { class: "job-earlier-years" }, r.years), h("strong", {}, r.title), r.note && h("span", { class: "job-earlier-note" }, r.note)))),
      ),
    ),
  );
  $("#work-dialog").showModal();
}

// One big picture with a row of small ones to switch between them.
// Each photo is { "image": "/work/...jpg" or "video": "YouTube/Vimeo link", "caption": "..." }.
function gallery(photos, label) {
  const stage = h("div", { class: "gallery-stage" });
  const caption = h("p", { class: "gallery-caption" });
  const show = (i) => {
    const p = photos[i];
    const video = videoInfo(p.video);
    stage.replaceChildren(video
      ? h("div", { class: "work-media video" }, h("iframe", {
          src: video.embed, title: p.caption || label,
          allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowfullscreen: "",
        }))
      : h("div", { class: "work-media" }, h("img", { src: p.image, alt: p.alt || p.caption || label })));
    caption.textContent = p.caption || "";
    caption.hidden = !p.caption;
    thumbs.forEach((t, k) => t.setAttribute("aria-current", String(k === i)));
  };
  const thumbs = photos.map((p, i) => {
    const src = p.image || videoInfo(p.video)?.thumb;
    const btn = h("button", { type: "button", class: "gallery-thumb", "aria-label": `Show ${p.caption || `photo ${i + 1}`}` },
      src ? h("img", { src, alt: "", loading: "lazy" }) : h("span", {}, "▶"));
    btn.addEventListener("click", () => show(i));
    return btn;
  });
  show(0);
  return h("div", { class: "gallery" }, stage, caption, photos.length > 1 && h("div", { class: "gallery-thumbs" }, thumbs));
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
  $("#print-btn").addEventListener("click", () => window.print());
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
  let status = { chat: false, contact: false };
  try { status = await fetch("/api/status").then((r) => r.json()); } catch {}
  if (status.chat) setupChat(d);
  if (status.contact) setupContact();
}

function setupChat(d) {
  const first = d.name.split(" ")[0];
  const launch = $("#chat-launch"), panel = $("#chat-panel"), log = $("#chat-log");
  const form = $("#chat-form"), input = $("#chat-input"), suggest = $("#chat-suggest");
  const history = [];
  launch.hidden = false;

  const open = (state) => {
    panel.hidden = !state;
    launch.hidden = state;
    launch.setAttribute("aria-expanded", String(state));
    if (state) input.focus(); else launch.focus();
  };
  launch.addEventListener("click", () => open(true));
  $("#chat-close").addEventListener("click", () => open(false));
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") open(false); });

  const add = (cls, text) => {
    const m = h("div", { class: `msg ${cls}` }, text);
    log.append(m);
    log.scrollTop = log.scrollHeight;
    return m;
  };
  add("bot", `Hi, I'm ${first}, or rather an AI version of me. Ask me about my brands, design work, or experience.`);

  ["What roles are you looking for?", "How do you take a product from idea to launch?", "What brands have you built?"]
    .forEach((q) => suggest.append(h("button", { type: "button" }, q)));
  suggest.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") ask(e.target.textContent);
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });

  let busy = false;
  async function ask(q) {
    q = q.trim();
    if (!q || busy) return;
    busy = true;
    input.value = "";
    suggest.hidden = true;
    add("user", q);
    const pending = add("bot typing", "Thinking…");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Something went wrong.");
      pending.className = "msg bot";
      pending.textContent = body.answer;
      history.push({ role: "user", content: q }, { role: "assistant", content: body.answer });
    } catch (err) {
      pending.className = "msg bot err";
      pending.textContent = `${err.message} You can also email ${d.links.email}.`;
    } finally {
      busy = false;
    }
  }
}

function setupContact() {
  const form = $("#contact-form"), status = $("#form-status");
  form.hidden = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    const payload = Object.fromEntries(new FormData(form));
    status.className = "form-status";
    if (!payload.name.trim() || !payload.message.trim() || !form.elements.email.checkValidity() || !payload.email.trim()) {
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
