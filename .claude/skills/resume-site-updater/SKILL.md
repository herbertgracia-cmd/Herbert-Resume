---
name: resume-site-updater
description: Update Herbert Gracia's resume website in this repo. Use when Herbert asks to add, change, or remove anything on his site, such as a new job, a promotion, new numbers, a certificate, a headline, work samples (images, YouTube or Vimeo links), skills, or links, or asks to refresh the link-preview image. Follows the site's content rules, tests the change, and publishes it.
---

# Resume site updater

Herbert's site is a Cloudflare Worker serving plain HTML, CSS, and JavaScript. Almost every change is an edit to **`public/content.json`**; the page reads from it.

## Where things live

| What | Where |
|---|---|
| All resume text | `public/content.json` |
| Page layout | `public/index.html`, `public/app.js`, `public/styles.css` |
| Work images | `public/work/` |
| Link-preview image and iPhone icon | `public/og.png` and `public/apple-touch-icon.png`, rebuilt with `node scripts/make-og.mjs` |
| Welcome pop-up and contact API | `src/worker.js` |
| Cloudflare settings | `wrangler.toml` |
| Database setup | `supabase/schema.sql` |

## Content rules

These keep the site short enough for a recruiter to skim in 30 seconds.

- **Facts only.** Use only what Herbert tells you or what is already in the file. Never invent numbers, clients, dates, budgets, or results. If something is vague, ask.
- **Headline (`role`)**: one line, about 50 characters, leading with the job he wants, with parts separated by " · ". Currently "Head of Brand & Creative", with `specialties` ("Creative Direction · Brand Strategy · ...") as one line under it. The first two parts become the browser-tab title.
- **Keep the page short and never repeat a fact in two places on screen.** The site shows about 750 words; everything longer sits behind "More" or a click. Add detail to the long fields, not the short ones.
- **Tagline (`tagline`)**: one short line ("I build brands, lead creative teams, and turn ideas into experiences that connect."). **Summary (`summary`)**: short paragraphs separated by a blank line (`\n\n`). `tagline_accent` is the part set in italic color. **Summary (`summary`)**: two to four sentences under it, ending with what he's ready to lead.
- **Page order** (in `public/index.html`): hero (with stats), Experience, Selected Work & Brand Impact, Certification, Leadership & Expertise, Contact. The printed PDF puts Experience before Work.
- **Stats**: exactly 4, each label 6 words or fewer.
- **Partners (`partners`)**: well-known brands he collaborated with, shown under the stats (not employers). Each `value` is short (like "20+" or "+10%"); a long text value is allowed for at most one. Don't repeat the same fact twice.
- **Jobs (`experience`)**, newest first. Each job has:
  - `role`, `company`, `start`, `end` ("Present" if current), and `location`.
  - `line` and `points`: what the page shows: one short line, then 2-3 points of 12 words or fewer. Founder roles add `exit` ("Exit: Full Company Acquisition · 2019"); `exit_note` shows under "More" and on the printed resume.
  - `summary` and `key`: the fuller version for the **printed resume** (the PDF he uploads to job applications) and "More". Put ATS keywords here in real sentences ("Label: text" makes the label bold). Never make `key` identical to `points`, or the resume loses detail.
- **`seeking`**: target titles, printed under his name so recruiters' title searches match. Keep it to roles he's applying for.
- **Printed resume**: must stay at 2 pages and include every job's `summary` and `key`, earlier Fromm roles, Education, and tools. It uses `resume_summary` (a keyword-rich version of `summary`) instead of the page summary, and a print-only Education section. Partners and industries are hidden in print to save space. Check the page count with `pdfinfo` after any content change.
- **Downloadable PDF** (`public/Herbert-Gracia-Resume.pdf`): the "Resume (PDF)" buttons download this file. After any change to content or print styles, rebuild it with the local server running (`npm run dev`):
  ```bash
  NODE_PATH=$(npm root -g) node scripts/make-resume-pdf.mjs
  ```
  Restart `npm run dev` first if the PDF is new, since files added after it starts aren't served.
  - `summary`: the fuller description, shown under "More about this role" and on the printed resume.
  - `key` (under "More" and on the printed resume): bullets of about 25 words or fewer. The current role (Fromm) has 6, each starting with a bold label ("Creative & Brand Leadership: ..."; a colon near the start makes that text bold); State of Flux and FAZE have 4 plain bullets each. Adding bullets may push the resume to 3 pages, so check.
  - `exit` (founder roles): how it ended, shown as a label under the title, e.g. "Full company acquisition · 2019" or "Partner buyout · 2024". Don't make the two exits sound financially equal.
  - `tags`: the skills used in the role, shown as small chips. Every job includes leadership and sales; use business terms (DTC, B2B, wholesale, go-to-market).
  - `areas` (optional): what goes into each part of the role, shown as boxes, e.g. `{"name": "Technology", "items": [...]}`. The Fromm job has Creative, Technology, Marketing, Communications, and PR. Areas and tags show on the website only; the printed PDF shows the `key` bullets instead.
  - Optional details behind "More about this role": `creative` (brand, design & creative direction work), `highlights` (each starting with "Label: "), and `earlier_roles` (`title`, `years`, `note`).
- **Work (`work`)**: each item needs `title`, `category`, and `summary`.
  - `category` is one name, or a list of names, from Web design, Product design, Project design, Print design, Marketing, Video, Events, Storytelling, Collaborations, Technology, AI. A card shows under each of its filters. "Project design" means designed spaces: stores, pop-ups, and trade-show booths.
  - Exactly **3** items have `"featured": true` (FAZE, State of Flux, Fromm Institute), and they are listed first. They show in "Selected Work & Brand Impact", which comes after Experience, so each should prove both creative leadership and business results. Featured items are case studies: `challenge`, `role` (his part), `approach`, and `outcome`, each a sentence or two, from facts only. An outcome still in progress says so ("Running through 2026").
  - `caption` (12 words or fewer) and `tag` (e.g. "Brand · Product") are what the tiles and the All work list show; `summary` shows when the piece is opened. A featured piece with no image can use `cover` (one big word, like "AI") and `cover_note`.
  - Optional: `year`, `details`, `role`, `collaborators`, `tags`, `image`, `imageAlt`, `video`, `link`.
- **Leadership & Expertise**: `skills_short` is the list on the page (leadership categories, plus AI Innovation & Agentic Workflows); `tools` is one smaller line under it; `skills` and `industries` show under "All skills, tools & industries". `skills` groups stay short (6 items or fewer each); `certifications` get their own Certification section: the one with `"featured": true` (Certificate in Applied Agentic AI) shows as a large card with its `description`; each has `name`, `issuer`, `year`, and `status`; `education` uses the first entry only on the page.
- **Welcome pop-up**: its text, choices, and delay are in the `intro` block. Reason ids (`hiring`, `project`, `collab`, `looking`) must match the check in `supabase/schema.sql`; if you add one, update both.

## Adding work samples

1. Put images in `public/work/` with lowercase, hyphenated names (`faze-lookbook-2016.jpg`). Resize to about 1600px wide and keep each under 500 KB:
   ```bash
   npx --yes sharp-cli -i input.jpg -o public/work/name.jpg resize 1600
   ```
   If that isn't available, ask Herbert for a smaller export.
2. Set `"image": "/work/name.jpg"` and a short `imageAlt` describing the picture.
3. For video, set `"video"` to the YouTube or Vimeo link. YouTube links also give the card its picture.
4. Only use images Herbert owns or has the right to show. Ask if unsure, especially for client or partner work.

## After any edit

1. **Check the JSON parses:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('public/content.json','utf8'))"
   ```
2. **Check the stats and featured counts:**
   ```bash
   node -e "const d=require('./public/content.json');console.log('stats',d.stats.length,'featured',d.work.filter(w=>w.featured).length,'key',d.experience.map(j=>j.key?.length))"
   ```
   Expect 4 stats, 3 featured, and key bullets of 6, 4, 4.
3. **If the headline, name, availability, location, or first 3 stats changed**, rebuild the preview image with `node scripts/make-og.mjs` and look at `public/og.png`. Make sure the bottom row fits.
4. **Build check:** run `npm run check`; it must finish without errors.
5. **Look at it** if you changed layout or added images: run `npm run dev` and open http://localhost:8787 on a desktop width and a phone width (390px). No sideways scrolling, and no errors in the console.
6. **Rebuild the resume PDF** if content or print styles changed (see "Downloadable PDF" above) and confirm it's still 2 pages.
7. **Publish:** commit with a plain-English message saying what changed, then push. Cloudflare deploys the repo's default branch automatically within a couple of minutes.

## Don't

- Don't put secrets (Supabase keys) in any file. They live in Cloudflare as Secrets.
- Don't re-add long sections (About, What I bring, Community); that content stays in the JSON but isn't shown.
- Don't commit the `applications/` folder; it's private.
