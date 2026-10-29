# Herbert Gracia — Resume Website

A personal resume site for sharing with companies. It runs on **Cloudflare Workers** and has two optional features you can switch on later:

- **Welcome pop-up**: asks visitors what brings them here and saves who they are to **Supabase**.
- **Contact form**: messages are saved to a **Supabase** database.

They stay hidden until you add the Supabase keys, so the site works as a plain resume from day one.

## Edit your resume

All the text lives in **`public/content.json`**. The page reads from this one file, so there's nothing else to update. Each job shows its `key` bullets; `creative`, `highlights`, and `earlier_roles` sit behind a "More about this role" link. Work items marked `"featured": true` show first.

"Save as PDF" in the top bar prints a clean two-page version of the resume.

**Link preview:** `public/og.png` is the image shown when the link is shared on LinkedIn, Slack, or email. If you change your headline, ask Claude to regenerate it.

## Add your work (design, video, storytelling, collaborations)

The **Selected work** section is the `work` list in `public/content.json`. Each item is one card; visitors can filter by type and click a card to see it larger.

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
- **image:** put the picture in `public/work/` (JPG or PNG, about 1600px wide, under 500 KB).
- **video:** a YouTube or Vimeo link plays right on the page. YouTube links also give the card its picture automatically.
- Everything except `title`, `category`, and `summary` is optional. Cards with no picture get a colored cover with the title.

## Welcome pop-up

About 15 seconds after someone arrives (or once they scroll 40% of the page), a small pop-up asks "What brings you here?" with four choices: hiring, a project, a collaboration, or just looking. Except for "just looking", it then asks for a name and email (company, title, and message are optional) and saves the answer to Supabase. Each visitor sees it once; closing it hides it for good on that browser. Change the wording, choices, or delay in the `intro` block of `content.json`. It only appears once Supabase is connected.

## Claude skills

This repo includes four Claude Code skills in `.claude/skills/`. Open the repo in Claude Code and just ask; Claude picks the right one.

| Skill | Ask something like | What you get |
|---|---|---|
| `job-application-tailor` | "Tailor my resume to this job: [paste posting]" | Fit summary, match table, tailored bullets, cover letter, interview stories, and honest gaps. Saved (if you ask) to the private, git-ignored `applications/` folder. |
| `resume-site-updater` | "Add my new role" / "Here are FAZE lookbook photos" | Updates `content.json` following the site's rules (3 bullets per job, 6 featured works), rebuilds the preview image if needed, tests, and publishes. |
| `brand-voice-writer` | "Write Instagram and email copy for Fromm's 50th" | Three options per channel in the brand's voice, from profiles in `brand-voices/` (Fromm and Herbert are starter drafts to confirm). |
| `creative-brief-builder` | "Turn these notes into a creative brief" | A one-page brief (objective, audience, message, deliverables, timeline) plus questions for anything missing. |

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
| `public/` | The website: `index.html`, `styles.css`, `app.js`, and `content.json` (your resume) |
| `src/worker.js` | Cloudflare Worker: serves the site, fills in link-preview tags, and handles `/api/status`, `/api/intro`, `/api/contact` |
| `supabase/schema.sql` | Database tables for contact messages and welcome pop-up answers |
| `wrangler.toml` | Cloudflare settings |

There's no build step or framework: plain HTML, CSS, and JavaScript.
