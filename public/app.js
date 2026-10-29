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
  document.title = `${d.name} — ${d.role.split(",")[0]}`;

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
    stats.replaceChildren(...d.stats.map((s) =>
      h("div", { class: s.value.length > 8 ? "stat stat-text" : "stat" }, h("strong", {}, s.value), h("span", {}, s.label))));
  } else stats.parentElement.remove();

  // Experience: 3 key bullets per job; the rest sits behind "More".
  $("#jobs").replaceChildren(...d.experience.map(renderJob));

  renderWork(d.work || []);

  // Skills & industries as a short list of labeled lines.
  const facts = [
    ["Industries", (d.industries || []).map((x) => x.name).join(" · ")],
    ...(d.skills || []).filter((g) => g.group !== "Languages").map((g) => [g.group, g.items.join(" · ")]),
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
  return "cat-" + String(cat || "other").toLowerCase().replace(/[^a-z]+/g, "-");
}

function workCover(item, large = false) {
  const video = videoInfo(item.video);
  const src = item.image || video?.thumb;
  const cover = h("div", { class: `work-cover ${categoryClass(item.category)}` });
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

  const CATEGORY_ORDER = ["Design", "Marketing", "Video", "Events", "Storytelling", "Collaborations", "Technology", "AI"];
  const cats = [...new Set(items.map((i) => i.category).filter(Boolean))]
    .sort((a, b) => (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99));
  const filters = $("#work-filters");
  const grid = $("#work-grid");

  const cards = items.map((item) =>
    h("li", { class: "reveal", "data-category": item.category || "" },
      h("button", { class: "work-card", type: "button", "aria-haspopup": "dialog" },
        workCover(item),
        h("div", { class: "work-meta" },
          h("span", {}, item.category || ""),
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
    cards.forEach((c) => { c.hidden = f !== "All" && c.dataset.category !== f; c.classList.add("in"); });
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
      h("p", { class: "work-meta" }, h("span", {}, item.category || ""), item.year && h("span", {}, item.year)),
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
    h("div", { class: "job-dates" }, j.start ? `${j.start} — ${j.end}` : "", j.location && h("span", { class: "job-location" }, j.location)),
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
  if (status.intro && d.intro) setupIntro(d);
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

  ["What brands have you built?", "What's your creative direction experience?", "How do you use AI in your work?"]
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
      if (res.status === 429) {
        pending.className = "msg bot err";
        pending.textContent = body.error;
        return;
      }
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

// Welcome pop-up. Shows once per visitor, after a delay or partway down the page.
function setupIntro(d) {
  const KEY = "intro-seen";
  try { if (localStorage.getItem(KEY)) return; } catch { return; }
  const remember = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch {} };

  const box = $("#intro"), step1 = $("#intro-step-1"), form = $("#intro-form"), done = $("#intro-done");
  const status = $("#intro-status"), chatLaunch = $("#chat-launch");
  const cfg = d.intro;
  let reason = null;

  $("#intro-title").textContent = cfg.title;
  $("#intro-sub").textContent = cfg.subtitle || "";
  $("#intro-reasons").replaceChildren(...cfg.reasons.map((r) =>
    h("button", { type: "button", class: "intro-reason", "data-id": r.id }, r.label)));

  const show = () => {
    if (!box.hidden || document.querySelector(".chat-panel:not([hidden])")) return;
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add("open"));
    if (chatLaunch) chatLaunch.classList.add("nudged");
    cleanup();
  };
  const close = () => {
    remember();
    box.classList.remove("open");
    setTimeout(() => { box.hidden = true; }, 250);
    if (chatLaunch) chatLaunch.classList.remove("nudged");
  };
  const send = async (payload) => {
    const res = await fetch("/api/intro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, referrer: document.referrer || "" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Could not send. Please email me instead.");
  };
  const finish = (text) => {
    step1.hidden = true; form.hidden = true; done.hidden = false;
    $("#intro-done-text").textContent = text;
    remember();
    setTimeout(close, 4000);
  };

  // Show after the delay, or once they've scrolled 40% of the page, whichever comes first.
  const timer = setTimeout(show, (cfg.delay_seconds ?? 15) * 1000);
  const onScroll = () => {
    const seen = (scrollY + innerHeight) / document.documentElement.scrollHeight;
    if (seen > 0.4) show();
  };
  addEventListener("scroll", onScroll, { passive: true });
  function cleanup() { clearTimeout(timer); removeEventListener("scroll", onScroll); }

  $("#intro-close").addEventListener("click", close);
  box.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

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
  $("#intro-back").addEventListener("click", () => { form.hidden = true; step1.hidden = false; status.textContent = ""; });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = { reason, ...Object.fromEntries(new FormData(form)) };
    status.className = "form-status";
    if (!payload.name.trim() || !payload.email.trim() || !form.elements.email.checkValidity()) {
      status.textContent = "Please add your name and a valid email.";
      status.classList.add("err");
      return;
    }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    status.textContent = "Sending…";
    try {
      await send(payload);
      finish(cfg.thanks.replace("{name}", payload.name.trim().split(" ")[0]));
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
