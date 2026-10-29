import content from "../public/content.json";

// Shown at /api/status so you can tell which version is live.
const VERSION = "2026-10-29.2";

// Form limits: at most 5 submissions a minute per visitor (FORM_LIMITER in wrangler.toml).
const LIMIT_MESSAGE = "Too many tries. Please wait a minute.";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/status" && request.method === "GET") {
        // Lets the page show or hide features depending on which secrets are set.
        return json({
          version: VERSION,
          contact: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
          intro: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
        });
      }
      if (url.pathname === "/api/intro" && request.method === "POST") {
        return await handleIntro(request, env);
      }
      if (url.pathname === "/api/contact" && request.method === "POST") {
        return await handleContact(request, env);
      }
      if (url.pathname.startsWith("/api/")) {
        return json({ error: "Not found" }, 404);
      }
    } catch (err) {
      console.error(err);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }

    // Home page: point the link-preview tags at this site's own address,
    // so shared links show the preview image on any domain.
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const page = await env.ASSETS.fetch(request);
      const origin = url.origin;
      return new HTMLRewriter()
        .on('meta[property="og:image"]', { element: (el) => el.setAttribute("content", `${origin}/og.png`) })
        .on('meta[name="twitter:image"]', { element: (el) => el.setAttribute("content", `${origin}/og.png`) })
        .on('meta[property="og:url"]', { element: (el) => el.setAttribute("content", `${origin}/`) })
        .transform(page);
    }

    return env.ASSETS.fetch(request);
  },
};

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
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
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

// Works with both the legacy service_role key (a JWT starting "eyJ") and the
// newer "sb_secret_..." keys, which go in the apikey header only.
function supabaseHeaders(key) {
  const headers = { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

// Welcome pop-up: saves who the visitor is and how Herbert can help.
async function handleIntro(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "This form is not set up yet." }, 503);
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
    referrer: clean(body?.referrer, 500) || null,
  };
  // "Just looking" needs nothing else; everyone else leaves a name and an email to reply to.
  if (reason !== "looking") {
    if (!row.name || !row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      return json({ error: "Please add your name and a valid email." }, 400);
    }
  }

  const saved = await supabaseInsert(env, "visitor_intros", row);
  if (!saved) return json({ error: "Could not send. Please email me instead." }, 502);
  return json({ ok: true });
}

// Adds one row to a Supabase table. Returns true if it worked.
async function supabaseInsert(env, table, row) {
  const res = await safeFetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: supabaseHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
    body: JSON.stringify(row),
  });
  if (!res?.ok) {
    if (res) console.error(`Supabase error (${table})`, res.status, await res.text());
    return false;
  }
  return true;
}

// Returns null instead of throwing when the other service can't be reached.
async function safeFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch (err) {
    console.error("Request failed", url, err);
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

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
