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
| Link-preview image | `public/og.png`, rebuilt with `node scripts/make-og.mjs` |
| Welcome pop-up and contact API | `src/worker.js` |
| Cloudflare settings | `wrangler.toml` |
| Database setup | `supabase/schema.sql` |

## Content rules

These keep the site short enough for a recruiter to skim in 30 seconds.

- **Facts only.** Use only what Herbert tells you or what is already in the file. Never invent numbers, clients, dates, budgets, or results. If something is vague, ask.
- **Headline (`role`)**: one line, under about 50 characters, leading with the job he wants. Currently "Brand & Creative Director, now building with AI".
- **Summary (`tagline`)**: one sentence.
- **Stats**: exactly 4. Each `value` is short (like "20+" or "+10%"); a long text value is allowed for at most one. Don't repeat the same fact twice.
- **Jobs (`experience`)**, newest first. Each job has:
  - `role`, `company`, `start`, `end` ("Present" if current), and `location`.
  - `summary`: one sentence.
  - `key`: **exactly 3** bullets, each under about 20 words, with no "Label: " prefix (a colon near the start makes that text bold).
  - Optional details behind "More about this role": `creative` (brand, design & creative direction work), `highlights` (each starting with "Label: "), and `earlier_roles` (`title`, `years`, `note`).
- **Work (`work`)**: each item needs `title`, `category`, and `summary`.
  - `category` is one of Design, Marketing, Video, Events, Storytelling, Collaborations, Technology, AI.
  - Exactly **6** items have `"featured": true`, and they are listed first.
  - Optional: `year`, `details`, `role`, `collaborators`, `tags`, `image`, `imageAlt`, `video`, `link`.
- **Everything else**: `skills` groups stay short (6 items or fewer each); `certifications` have `name`, `issuer`, and `year`; `education` uses the first entry only on the page.
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
   Expect 4 stats, 6 featured, and 3 key bullets per job.
3. **If the headline, name, availability, location, or first 3 stats changed**, rebuild the preview image with `node scripts/make-og.mjs` and look at `public/og.png`. Make sure the bottom row fits.
4. **Build check:** run `npm run check`; it must finish without errors.
5. **Look at it** if you changed layout or added images: run `npm run dev` and open http://localhost:8787 on a desktop width and a phone width (390px). No sideways scrolling, and no errors in the console.
6. **Publish:** commit with a plain-English message saying what changed, then push. Cloudflare deploys the repo's default branch automatically within a couple of minutes.

## Don't

- Don't put secrets (Supabase keys) in any file. They live in Cloudflare as Secrets.
- Don't re-add long sections (About, What I bring, Community); that content stays in the JSON but isn't shown.
- Don't commit the `applications/` folder; it's private.
