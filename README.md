# Herbert Gracia — Resume Website

A personal resume site for sharing with companies. It runs on **Cloudflare Workers** and has two optional features you can switch on later:

- **"Ask about Herbert" chat**: recruiters ask questions and get answers from an Nvidia-hosted LLM. It only uses what's in your resume.
- **Contact form**: messages are saved to a **Supabase** database.

Both stay hidden until you add their keys, so the site works as a plain resume from day one.

## Edit your resume

All the text lives in **`public/content.json`**. Replace every `[bracketed]` placeholder with your own details. The page and the chat both read from this one file, so there's nothing else to update.

"Save as PDF" in the top bar prints a clean one-column version of the resume.

## Run it locally

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:8787.

## Deploy to Cloudflare

```bash
npx wrangler login
```

```bash
npm run deploy
```

Wrangler prints your live URL (`https://herbert-resume.<your-subdomain>.workers.dev`). To use your own domain, add it under the Worker's **Settings → Domains & Routes** in the Cloudflare dashboard.

You can also connect this GitHub repo in the Cloudflare dashboard (**Workers & Pages → Create → Import a repository**) so every push deploys automatically.

## Turn on the AI chat (Nvidia)

1. Get an API key at https://build.nvidia.com (it starts with `nvapi-`).
2. Add it to Cloudflare:
   ```bash
   npx wrangler secret put NVIDIA_API_KEY
   ```
3. Optional: pick a different model by changing `NVIDIA_MODEL` in `wrangler.toml`.

The chat button appears on the site once the key is set.

## Turn on the contact form (Supabase)

1. Create a project at https://supabase.com.
2. Open the **SQL editor**, paste in `supabase/schema.sql`, and run it.
3. In **Project Settings → API**, copy the project URL and a secret key (the `sb_secret_...` key, or the legacy `service_role` key), then add them to Cloudflare:
   ```bash
   npx wrangler secret put SUPABASE_URL
   ```
   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```

The form appears under Contact once both are set. In Supabase's **Table Editor**:

- **contact_messages**: messages from the contact form. Tick `is_read` once you've replied.
- **chat_questions**: every question recruiters ask the AI chat, with its answer (only filled in once the Nvidia chat is turned on too). No names or emails are stored.

The `service_role` key only lives in Cloudflare and is never sent to the browser. Keep it out of git.

## Local secrets

For `npm run dev`, copy `.dev.vars.example` to `.dev.vars` and fill in the keys you want to test. `.dev.vars` is git-ignored.

## How it's built

| Path | What it is |
| --- | --- |
| `public/` | The website: `index.html`, `styles.css`, `app.js`, and `content.json` (your resume) |
| `src/worker.js` | Cloudflare Worker: serves the site and handles `/api/status`, `/api/chat`, `/api/contact` |
| `supabase/schema.sql` | Database tables for contact messages and chat questions |
| `wrangler.toml` | Cloudflare settings |

There's no build step or framework: plain HTML, CSS, and JavaScript.
