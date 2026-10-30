import content from "../public/content.json";

// Shown at /api/status so you can tell which version is live.
const VERSION = "2026-10-30.8";

// Form limits: at most 5 submissions a minute per visitor (FORM_LIMITER in wrangler.toml).
const LIMIT_MESSAGE = "Too many tries. Please wait a minute.";

// Security headers for every response the Worker sends. Static files get the
// same headers from public/_headers.
const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: https://i.ytimg.com",
    "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export default {
  async fetch(request, env) {
    const response = await route(request, env);
    return withSecurityHeaders(response);
  },
};

async function route(request, env) {
  const url = new URL(request.url);
  // The site's main address. Set SITE_URL (for example https://herbertgracia.com)
  // once a custom domain is live, so every address points to one place.
  const base = (env.SITE_URL || url.origin).replace(/\/$/, "");

  try {
    if (url.pathname === "/api/status" && request.method === "GET") {
      // Lets the page show or hide features depending on which secrets are set.
      const { url, key } = supabaseConfig(env);
      const supabase = Boolean(url && key);
      return json({
        version: VERSION,
        contact: supabase,
        intro: supabase,
        // Setup check: which Supabase settings the site can see. Names and yes/no only,
        // never the values themselves.
        setup: {
          supabase_url: Boolean(url),
          supabase_key: Boolean(key),
          setting_names: Object.keys(env).filter((k) => k.toUpperCase().includes("SUPABASE")).sort(),
        },
      });
    }
    if (url.pathname.startsWith("/api/") && request.method === "POST") {
      // Only accept JSON sent from this site's own pages.
      const origin = request.headers.get("Origin");
      const type = request.headers.get("Content-Type") || "";
      if (origin !== url.origin || !type.includes("application/json")) {
        return json({ error: "Not allowed." }, 403);
      }
      if (url.pathname === "/api/intro") return await handleIntro(request, env);
      if (url.pathname === "/api/contact") return await handleContact(request, env);
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, 404);
    }
  } catch (err) {
    console.error("Unexpected error", err?.message);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }

  if (url.pathname === "/robots.txt") {
    return text(`User-agent: *\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`);
  }
  if (url.pathname === "/sitemap.xml") {
    return text(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc></url>\n</urlset>\n`,
      "application/xml",
    );
  }

  // Home page: fill in the parts search engines and link previews read.
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const page = await env.ASSETS.fetch(request);
    return renderHome(page, base);
  }

  return env.ASSETS.fetch(request);
}

// ---------- Home page, filled in on the server ----------

// Puts the headline, summary, key numbers, and experience straight into the HTML,
// plus link-preview addresses and structured data for Google. The browser script
// then takes over and adds the interactive parts.
function renderHome(page, base) {
  const d = content;
  const binds = { name: d.name, role: d.role, tagline: d.tagline, availability: d.availability, location: d.location };

  return new HTMLRewriter()
    .on('meta[property="og:image"]', { element: (el) => el.setAttribute("content", `${base}/og.png`) })
    .on('meta[name="twitter:image"]', { element: (el) => el.setAttribute("content", `${base}/og.png`) })
    .on('meta[property="og:url"]', { element: (el) => el.setAttribute("content", `${base}/`) })
    .on('link[rel="canonical"]', { element: (el) => el.setAttribute("href", `${base}/`) })
    .on("head", {
      element: (el) =>
        el.append(`<script type="application/ld+json">${personJsonLd(base)}</script>`, { html: true }),
    })
    .on("[data-bind]", {
      element: (el) => {
        const key = el.getAttribute("data-bind");
        if (typeof binds[key] === "string") el.setInnerContent(binds[key]);
      },
    })
    .on("h1.hero-name", {
      element: (el) =>
        el.setInnerContent(
          d.name.split(/\s+/).map((w) => `<span class="line">${esc(w)}</span>`).join(" "),
          { html: true },
        ),
    })
    .on("#stats", {
      element: (el) =>
        el.setInnerContent(
          (d.stats || [])
            .map((s) => {
              const value = s.value.length > 8
                ? s.value.split(" · ").map((v) => `<span class="stat-line">${esc(v)}</span>`).join("")
                : esc(s.value);
              return `<div class="${s.value.length > 8 ? "stat stat-text" : "stat"}"><strong>${value}</strong><span>${esc(s.label)}</span></div>`;
            })
            .join(""),
          { html: true },
        ),
    })
    .on("#jobs", {
      element: (el) =>
        el.setInnerContent(
          (d.experience || [])
            .map((j) => {
              const dates = j.start ? `${esc(j.start)}–${esc(j.end)}` : "";
              const key = (j.key || []).map((k) => `<li>${esc(k)}</li>`).join("");
              return `<li class="job"><div class="job-dates">${dates}${j.since ? `<span class="job-since">${esc(j.since)}</span>` : ""}${j.location ? `<span class="job-location">${esc(j.location)}</span>` : ""}</div><div><h3>${esc(j.role)}${j.company ? ` <span class="at">at ${esc(j.company)}</span>` : ""}</h3>${j.summary ? `<p class="job-summary">${esc(j.summary)}</p>` : ""}${key ? `<ul class="job-key">${key}</ul>` : ""}</div></li>`;
            })
            .join(""),
          { html: true },
        ),
    })
    .transform(page);
}

// Structured data describing Herbert as a Person, built only from content.json.
function personJsonLd(base) {
  const d = content;
  const [city, region] = (d.location || "").split(",").map((s) => s.trim());
  const current = (d.experience || []).find((j) => j.end === "Present");
  const languages = (d.skills || []).find((g) => g.group === "Languages")?.items.map((l) => l.replace(/\s*\(.*\)$/, ""));
  const knowsAbout = (d.skills || [])
    .filter((g) => g.group !== "Languages")
    .flatMap((g) => g.items)
    .slice(0, 12);
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: d.name,
    jobTitle: d.role.split(",")[0],
    description: d.tagline,
    url: `${base}/`,
    image: d.photo?.src ? `${base}${d.photo.src}` : `${base}/og.png`,
    email: d.links?.email ? `mailto:${d.links.email}` : undefined,
    address: city ? { "@type": "PostalAddress", addressLocality: city, addressRegion: region } : undefined,
    sameAs: [d.links?.linkedin].filter(Boolean),
    worksFor: current ? { "@type": "Organization", name: current.company } : undefined,
    alumniOf: d.education?.[0] ? { "@type": "CollegeOrUniversity", name: d.education[0].school } : undefined,
    hasCredential: (d.certifications || []).map((c) => ({
      "@type": "EducationalOccupationalCredential",
      name: c.name,
      recognizedBy: c.issuer ? { "@type": "Organization", name: c.issuer } : undefined,
    })),
    knowsLanguage: languages,
    knowsAbout,
  };
  // "<" is escaped so the data can never close the script tag early.
  return JSON.stringify(person).replace(/</g, "\\u003c");
}

// ---------- Forms ----------

// True if this visitor is under the per-minute limit for a form.
async function withinLimit(env, request, form) {
  if (!env.FORM_LIMITER) return true;
  const { success } = await env.FORM_LIMITER.limit({ key: `${form}:${await visitorId(request)}` });
  return success;
}

// A stable, anonymous id for a visitor: a hash of their IP address, never the IP itself.
async function visitorId(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`herbert-resume:${ip}`));
  return [...new Uint8Array(bytes)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Contact form: saves a message to the Supabase contact_messages table.
async function handleContact(request, env) {
  if (!supabaseConfig(env).key || !supabaseConfig(env).url) {
    return json({ error: "The contact form is not set up yet." }, 503);
  }

  if (!(await withinLimit(env, request, "contact"))) return json({ error: LIMIT_MESSAGE }, 429);

  const body = await readJson(request);
  // Hidden "website" field: real people leave it empty, bots tend to fill it.
  if (body?.website) return json({ ok: true });

  const row = {
    name: clean(body?.name, 200),
    email: clean(body?.email, 320),
    company: clean(body?.company, 200) || null,
    message: clean(body?.message, 5000),
  };
  if (!row.name || !row.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    return json({ error: "Please add your name, a valid email, and a message." }, 400);
  }

  const saved = await supabaseInsert(env, "contact_messages", row);
  if (!saved) {
    return json({ error: "Could not send your message. Please email instead." }, 502);
  }
  return json({ ok: true });
}

// The Supabase address and secret key. The key is accepted under either name:
// SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_SECRET_KEY (Supabase's own name for it).
// Extra spaces or a trailing slash pasted by accident are removed.
function supabaseConfig(env) {
  const url = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "").trim();
  return { url, key };
}

// Works with both the legacy service_role key (a JWT starting "eyJ") and the
// newer "sb_secret_..." keys, which go in the apikey header only.
function supabaseHeaders(key) {
  const headers = { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

// Welcome pop-up: saves who the visitor is and how Herbert can help.
async function handleIntro(request, env) {
  if (!supabaseConfig(env).key || !supabaseConfig(env).url) {
    return json({ error: "Sorry, this isn't working right now. Please try again later." }, 503);
  }
  if (!(await withinLimit(env, request, "intro"))) return json({ error: LIMIT_MESSAGE }, 429);

  const body = await readJson(request);
  if (body?.website) return json({ ok: true }); // hidden field: bots fill it, people don't

  const reasons = (content.intro?.reasons || []).map((r) => r.id);
  const reason = String(body?.reason ?? "");
  if (!reasons.includes(reason)) return json({ error: "Please pick an option." }, 400);

  const row = {
    reason,
    name: clean(body?.name, 200) || null,
    email: clean(body?.email, 320) || null,
    company: clean(body?.company, 200) || null,
    title: clean(body?.title, 200) || null,
    message: clean(body?.message, 2000) || null,
    referrer: originOnly(body?.referrer),
  };
  // "Just looking" needs nothing else. Everyone else shares at least a name, an email,
  // or a note. Email is optional, but if given it must look like an email.
  if (reason !== "looking" && !row.name && !row.email && !row.message) {
    return json({ error: "Please add your name or a short note." }, 400);
  }
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    return json({ error: "That email doesn't look right. Fix it, or leave it blank." }, 400);
  }

  const saved = await supabaseInsert(env, "visitor_intros", row);
  if (!saved) return json({ error: "Sorry, that didn't go through. Please try again in a moment." }, 502);
  return json({ ok: true });
}

// Keeps only the site a visitor came from (https://www.linkedin.com), never the full link.
function originOnly(value) {
  try {
    const u = new URL(String(value ?? ""));
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin.slice(0, 500) : null;
  } catch {
    return null;
  }
}

// Adds one row to a Supabase table. Returns true if it worked.
async function supabaseInsert(env, table, row) {
  const { url, key } = supabaseConfig(env);
  const res = await safeFetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: supabaseHeaders(key),
    body: JSON.stringify(row),
  });
  if (!res?.ok) {
    // Status only: Supabase error text can include the visitor's details.
    if (res) console.error(`Supabase error (${table})`, res.status);
    return false;
  }
  return true;
}

// Returns null instead of throwing when the other service can't be reached.
async function safeFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch (err) {
    console.error("Request failed", err?.message);
    return null;
  }
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// ---------- Helpers ----------

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function withSecurityHeaders(response) {
  const res = new Response(response.body, response);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  return res;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function text(body, type = "text/plain") {
  return new Response(body, { headers: { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "public, max-age=3600" } });
}
