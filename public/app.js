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

  // Hero name: one line per word, last word in italic accent.
  const nameEl = $(".hero-name");
  nameEl.replaceChildren(...d.name.split(/\s+/).map((w) => h("span", { class: "line" }, w)));

  // Marquee: skills repeated twice for a seamless loop.
  const words = d.skills.flatMap((g) => g.items);
  const track = $("#marquee");
  for (let i = 0; i < 2; i++) words.forEach((w) => track.append(h("span", {}, w)));

  $("#about-body").replaceChildren(...d.about.map((p) => h("p", { class: "reveal" }, p)));

  // Key numbers row (optional).
  const stats = $("#stats");
  if (d.stats?.length) {
    stats.replaceChildren(
      ...d.stats.map((s) => h("div", { class: "stat reveal" }, h("strong", {}, s.value), h("span", {}, s.label))),
    );
  } else stats.remove();

  // Community section (optional).
  if (d.community?.length) {
    $("#community-list").replaceChildren(...d.community.map((c) => h("li", { class: "reveal" }, c)));
  } else $("#community").remove();

  $("#jobs").replaceChildren(
    ...d.experience.map((j) =>
      h("li", { class: "job reveal" },
        h("div", { class: "job-dates" }, j.start ? `${j.start} — ${j.end}` : ""),
        h("div", {},
          h("h3", {}, j.role, j.company && " ", j.company && h("span", { class: "at" }, `at ${j.company}`)),
          j.summary && h("p", { class: "job-summary" }, j.summary),
          j.highlights?.length && h("ul", {}, j.highlights.map(highlight)),
        ),
      ),
    ),
  );

  $("#project-list").replaceChildren(
    ...d.projects.map((p) => {
      const tag = p.url ? "a" : "div";
      return h(tag, { class: "project reveal", href: p.url || null, target: p.url ? "_blank" : null, rel: p.url ? "noopener" : null },
        (p.year || p.url) && h("div", { class: "project-top" }, h("span", {}, p.year || ""), p.url && h("span", { "aria-hidden": "true" }, "↗")),
        h("h3", {}, p.name),
        h("p", {}, p.description),
        h("div", { class: "tags" }, (p.tags || []).map((t) => h("span", { class: "tag" }, t))),
      );
    }),
  );

  $("#skill-list").replaceChildren(
    ...d.skills.map((g) => h("div", { class: "reveal" }, h("h3", {}, g.group), h("ul", {}, g.items.map((s) => h("li", {}, s))))),
  );
  $("#education").replaceChildren(
    ...(d.education || []).map((e) =>
      h("li", { class: "reveal" }, h("strong", {}, e.school), h("span", {}, [e.degree, e.year].filter(Boolean).join(" · "))),
    ),
  );

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
  add("bot", `Hi! Ask me anything about ${first}'s experience, projects, or skills.`);

  [`What is ${first}'s most recent role?`, `What projects has ${first} worked on?`, `Is ${first} open to new roles?`]
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
