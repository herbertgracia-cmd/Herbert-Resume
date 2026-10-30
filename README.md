# Herbert Gracia — Resume Website

A personal resume site for sharing with companies. It runs on **Cloudflare Workers** and has two optional features you can switch on later:

- **Welcome pop-up**: asks visitors what brings them here and saves who they are to **Supabase**.
- **Contact form**: messages are saved to a **Supabase** database.

Without the Supabase keys, the contact form stays hidden and pop-up answers can't be saved.

## Edit your resume

All the text lives in **`public/content.json`**. The page reads from this one file, so there's nothing else to update. Each job shows its `key` bullets; `creative`, `highlights`, and `earlier_roles` sit behind a "More about this role" link. Work items marked `"featured": true` show first.

"Save as PDF" in the top bar and "Download resume" in the hero both print a clean resume (Experience first, then featured work).

**Link preview:** `public/og.png` is the image shown when the link is shared on LinkedIn, Slack, or email, and `public/apple-touch-icon.png` is the iPhone home-screen icon. Rebuild both with `node scripts/make-og.mjs` after changing your headline or stats.

**Search engines:** the Worker writes your headline, summary, key numbers, and experience straight into the page, adds structured data describing you (a schema.org `Person`), and serves `robots.txt` and `sitemap.xml`. Once you connect your own domain, set `SITE_URL` in `wrangler.toml` (for example `"https://herbertgracia.com"`) so Google and link previews use that one address.

## Add your work (design, video, storytelling, collaborations)

The **Featured work** section is the `work` list in `public/content.json`. Each item is one card; visitors can filter by type and click a card to see it larger. It comes right after the hero, before Experience (the printed PDF puts Experience first).

```json
{
  "title": "Spring catalog redesign",
  "category": "Design",
  "year": "2025",
  "summary": "One or two sentences shown on the card.",
  "details": "Optional longer story shown when the card is opened.",
  "role": "Optional: what you did",
  "collaborators": "Optional: who you worked with",
  "image": "/work/spring-catalog.jpg",
  "video": "https://www.youtube.com/watch?v=...",
  "link": "https://example.com",
  "tags": ["Print", "Brand"]
}
```

- **category:** one of `Design`, `Marketing`, `Video`, `Events`, `Storytelling`, `Collaborations`, `Technology`, `AI`.
- **featured:** `true` to show it in the first six; the rest appear under "See all work".
- **challenge, approach, outcome:** turn a piece into a case study. Opening it then shows The challenge, My role (`role`), Approach, and Outcome, and the card says "Read the case study".
- **image:** put the picture in `public/work/` (JPG or PNG, about 1600px wide, under 500 KB).
- **images:** for several photos, use a list like `[{"src": "/work/a.jpg", "alt": "..."}, ...]`. The first is the card's cover, and opening the card shows them all in a swipeable strip.
- **Your portrait** is `public/herbert.jpg` (set by `photo` in `content.json`); it also appears in the link-preview image.
- **video:** a YouTube or Vimeo link plays right on the page. YouTube links also give the card its picture automatically.
- Everything except `title`, `category`, and `summary` is optional. Cards with no picture get a colored cover with the title.

## Welcome pop-up

About 5 seconds after someone arrives, a small pop-up asks "What brings you here?" with four choices: hiring, a project, a collaboration, or just looking. Except for "just looking", it then asks for a name, an optional email, company, title, and "How can I help?". Visitors only need to fill in one of name, email, or note, and the answer is saved straight to Supabase (no email app opens). Supabase must be connected for answers to save.

- It shows on **every visit and every refresh**. Once closed, it stays closed until the next page load.
- On phones it starts as a slim bar at the bottom that opens when tapped.
- It never opens on top of a work piece someone is viewing.
- Add `?intro` to the address to see it right away, anytime.
- Change the wording, choices, or delay in the `intro` block of `content.json`.

## Claude skills

This repo includes four Claude Code skills in `.claude/skills/`. Open the repo in Claude Code and just ask; Claude picks the right one.

| Skill | Ask something like | What you get |
|---|---|---|
| `job-application-tailor` | "Tailor my resume to this job: [paste posting]" | Fit summary, match table, tailored bullets, cover letter, interview stories, and honest gaps. Saved (if you ask) to the private, git-ignored `applications/` folder. |
| `resume-site-updater` | "Add my new role" / "Here are FAZE lookbook photos" | Updates `content.json` following the site's rules (3 bullets per job, 6 featured works), rebuilds the preview image if needed, tests, and publishes. |
| `brand-voice-writer` | "Write Instagram and email copy for Fromm's 50th" | Three options per channel in the brand's voice, from profiles in `brand-voices/` (Fromm and Herbert are starter drafts to confirm). |
| `creative-brief-builder` | "Turn these notes into a creative brief" | A one-page brief (objective, audience, message, deliverables, timeline) plus questions for anything missing. |

## Review agents

Six reviewer agents live in `.claude/agents/`. They only review and report (they never change files), so you can run them anytime. In Claude Code, ask for one by name ("have the recruiter-reviewer look at my site") or say "run the full site review" to run all six in parallel and get one combined, prioritized list.

| Agent | Looks at |
|---|---|
| `recruiter-reviewer` | The site as a headhunter sees it in 30 seconds: headline, proof, story, red flags |
| `copy-editor` | Every visible line: strength, length, consistency, tone |
| `design-critic` | Screenshots on desktop and phone, light and dark: hierarchy, type, spacing, polish |
| `accessibility-checker` | Automated audits, contrast, keyboard and screen-reader use, speed |
| `search-sharing-checker` | Google results, link previews, structured data |
| `security-reviewer` | Server code, forms, Supabase, secrets, privacy |

A full review uses noticeably more usage than a single request, so run it occasionally (for example before a job push) and single agents in between.

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

## Turn on the welcome pop-up and contact form (Supabase)

1. Create a project at https://supabase.com.
2. Open the **SQL editor**, paste in `supabase/schema.sql`, and run it. It's safe to run again whenever the file changes.
3. In **Project Settings → API**, copy the project URL and a secret key (the `sb_secret_...` key, or the legacy `service_role` key), then add them to Cloudflare:
   ```bash
   npx wrangler secret put SUPABASE_URL
   ```
   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```

The pop-up and the contact form appear once both are set. Each allows 5 submissions a minute per visitor, to stop spam. In Supabase's **Table Editor**:

- **contact_messages**: messages from the contact form. Tick `is_read` once you've replied.
- **visitor_intros**: answers from the welcome pop-up ("What brings you here?"): the reason (hiring, project, collab, or just looking), plus name, email, company, title, and message when the visitor shares them. Tick `is_read` once you've followed up.

The `service_role` key only lives in Cloudflare and is never sent to the browser. Keep it out of git.

## Local secrets

For `npm run dev`, copy `.dev.vars.example` to `.dev.vars` and fill in the keys you want to test. `.dev.vars` is git-ignored.

## How it's built

| Path | What it is |
| --- | --- |
| `public/` | The website: `index.html`, `styles.css`, `app.js`, `content.json` (your resume), and `_headers` (security headers for static files) |
| `src/worker.js` | Cloudflare Worker: serves the site, fills in the page for search engines and link previews, adds security headers, serves `robots.txt` and `sitemap.xml`, and handles `/api/status`, `/api/intro`, `/api/contact` |
| `supabase/schema.sql` | Database tables for contact messages and welcome pop-up answers |
| `wrangler.toml` | Cloudflare settings |

There's no build step or framework: plain HTML, CSS, and JavaScript.
