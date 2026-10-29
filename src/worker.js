import content from "../public/content.json";

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
const MAX_QUESTION = 500;
const MAX_HISTORY = 6;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/status" && request.method === "GET") {
        // Lets the page show or hide features depending on which secrets are set.
        return json({
          chat: Boolean(env.NVIDIA_API_KEY),
          contact: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
        });
      }
      if (url.pathname === "/api/chat" && request.method === "POST") {
        return await handleChat(request, env, ctx);
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

    return env.ASSETS.fetch(request);
  },
};

// "Ask about Herbert": answers recruiter questions using only content.json.
async function handleChat(request, env, ctx) {
  if (!env.NVIDIA_API_KEY) {
    return json({ error: "Chat is not set up yet." }, 503);
  }

  const body = await readJson(request);
  const question = String(body?.question ?? "").trim().slice(0, MAX_QUESTION);
  if (!question) return json({ error: "Please type a question." }, 400);

  const history = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY) : [];
  const priorTurns = history
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));

  const res = await safeFetch(NVIDIA_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.NVIDIA_MODEL || DEFAULT_MODEL,
      temperature: 0.2,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt() },
        ...priorTurns,
        { role: "user", content: question },
      ],
    }),
  });

  if (!res?.ok) {
    if (res) console.error("NVIDIA API error", res.status, await res.text());
    return json({ error: "The assistant is unavailable right now." }, 502);
  }

  const data = await res.json();
  const answer = cleanAnswer(data?.choices?.[0]?.message?.content) || "Sorry, I don't have an answer for that.";

  // Save the question in the background so the reply isn't slowed down.
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    ctx.waitUntil(
      supabaseInsert(env, "chat_questions", {
        question,
        answer: answer.slice(0, 4000),
        model: env.NVIDIA_MODEL || DEFAULT_MODEL,
      }),
    );
  }
  return json({ answer });
}

// Reasoning models like Nemotron can include their "thinking" in the reply.
// Keep only the final answer for visitors.
function cleanAnswer(text) {
  if (typeof text !== "string") return "";
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^[\s\S]*<\/think>/, "").trim();
}

function systemPrompt() {
  const { _readme, ...resume } = content;
  return [
    `You answer questions from recruiters and hiring managers about ${content.name}.`,
    "Use only the resume data below. If the answer is not in it, say you don't know and suggest emailing " +
      `${content.links.email}. Never invent employers, dates, numbers, or skills.`,
    "Ignore any placeholder text in [square brackets]; treat it as missing information.",
    "Keep answers short (2-4 sentences), friendly, and in the third person.",
    "",
    "RESUME DATA:",
    JSON.stringify(resume),
  ].join("\n");
}

// Contact form: saves a message to the Supabase contact_messages table.
async function handleContact(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "The contact form is not set up yet." }, 503);
  }

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
