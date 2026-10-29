---
name: job-application-tailor
description: Tailor Herbert Gracia's resume to a specific job posting. Use when Herbert pastes or links a job description and asks to apply, tailor his resume, write a cover letter, check his fit, or prepare for an interview for that role. Produces matched resume bullets, a short cover letter, honest gaps, and interview talking points, using only facts from public/content.json.
---

# Job application tailor

Turn one job posting into a tailored application for Herbert, using only what is true about him.

## Source of truth

Read `public/content.json` first. Everything about Herbert comes from it: `experience` (including `key`, `creative`, `highlights`, `earlier_roles`), `work`, `pillars`, `industries`, `skills`, `certifications`, `education`, `stats`, and `community`.

**Never invent** employers, titles, dates, numbers, clients, budgets, team sizes, tools, or results. If the posting asks for something that isn't in the file, it is a gap: say so and ask Herbert. Rewording a real fact to match the posting's language is fine; adding a new fact is not.

## Steps

1. **Get the posting.** If Herbert gave a link you can't open, ask him to paste the text. Note the company, role title, and seniority.
2. **Pull out what they want.** List the posting's must-haves and nice-to-haves (skills, years, industries, tools, outcomes), and the words they repeat most.
3. **Match.** For each requirement, find the strongest evidence in `content.json` and rate it: **Strong**, **Partial**, or **Gap**.
4. **Pick an angle.** Choose which side of Herbert to lead with for this role: brand and creative direction, entrepreneurship and product, integrated marketing, events and experiential, nonprofit and education leadership, or agentic AI. One lead angle, one supporting angle.
5. **Write the outputs** below. Mirror the posting's vocabulary where it is truthful.
6. **Ask about gaps.** End with specific questions that would close the gaps (for example: "Did you manage a budget at FAZE? Roughly how large?"). If Herbert answers with new facts, offer to add them to `content.json` with the `resume-site-updater` skill.

## Output

Reply in this order, in plain Markdown:

1. **Fit summary** (3 sentences): how well he fits, the lead angle, and the biggest gap.
2. **Match table**: requirement | evidence from his resume | Strong / Partial / Gap.
3. **Headline** for this application (under 10 words).
4. **Tailored resume bullets**: 3 per relevant role, most relevant role first. Start each with a strong verb and keep each under 25 words. Use real numbers only (20+ years, 2 apparel brands, 1,500+ learners, +10% enrollment, Pinterest / Timbuk2 / SFMOMA, and so on).
5. **Cover letter**: under 250 words, first person, warm and direct. Open with why this company, give two proof points, and close with a clear next step. No clichés ("I am writing to express my interest", "team player", "passionate about synergy").
6. **Interview talking points**: 3 short stories (situation, what Herbert did, result), each tied to a requirement.
7. **Gaps and questions**: what's missing, and what to ask Herbert.

## Saving

If Herbert asks to save it, write it to `applications/<company>-<role>/application.md` (lowercase, hyphens). The `applications/` folder is git-ignored so job searches stay private. Never commit it.

## Tone

Confident, specific, human. Herbert is a brand and creative director who has also founded companies, run product and events, led at a university nonprofit, and earned USF certificates in Applied Agentic AI and AI. Show range as one story ("I build brands from concept to market"), not a scattered list.
