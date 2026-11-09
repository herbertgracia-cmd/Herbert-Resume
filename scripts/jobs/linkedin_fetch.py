"""Fetch public LinkedIn job pages (no login) with curl and summarize: open or closed, pay, posted, applicants, work arrangement.

Usage: python3 -I scripts/jobs/linkedin_fetch.py <outdir> <slug> [<slug> ...]
(<slug> is the part of a linkedin.com/jobs/view/ link after "/view/".)
Writes <outdir>/<slug>.txt (posting text) and appends a JSON line per job to <outdir>/summary.jsonl.
"""
import html, json, re, subprocess, sys, time

outdir, slugs = sys.argv[1], sys.argv[2:]
for s in slugs:
    url = f"https://www.linkedin.com/jobs/view/{s}"
    code, t = "", ""
    for attempt in range(4):
        r = subprocess.run(["curl", "-sS", "-m", "25", "-w", "\n%{http_code}", url], capture_output=True, text=True)
        t, _, code = r.stdout.rpartition("\n")
        if code == "200":
            break
        time.sleep(20)
    m = re.search(r"show-more-less-html__markup[^>]*>(.*?)</div>", t, re.S)
    body = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", m.group(1)))) if m else ""
    open(f"{outdir}/{s}.txt", "w").write(body)
    posted = re.search(r"posted-time-ago__text[^>]*>\s*(.*?)\s*<", t, re.S)
    appl = re.search(r"num-applicants__caption[^>]*>\s*(.*?)\s*<", t, re.S)
    low = body.lower()
    modes = [w for w in ("hybrid", "on-site", "onsite", "in-office", "in office", "in person", "in-person", "remote") if w in low]
    # Days in the office, e.g. "3 days a week" or "8 days per month". Treat "modes" as hints only: perks lists
    # also mention "in office", so confirm the work setup by reading the posting text.
    days = re.search(r"(\d+|one|two|three|four|five)\s*days?\s*(?:a|per|each)\s*(?:week|month)", low)
    # Pay comes from the posting text only: the page also lists similar jobs with their own pay.
    pay_in_text = re.findall(r"\$\s?\d[\d,]*(?:\.\d+)?\s*(?:k|K)?(?:\s*USD)?(?:\s*(?:/|per)\s*(?:hour|hr|year|yr))?\s*(?:-|–|to)\s*\$\s?\d[\d,]*(?:\.\d+)?\s*(?:k|K)?", body)
    rec = {
        "slug": s, "http": code, "closed": "No longer accepting" in t, "words": len(body.split()),
        "posted": posted.group(1).strip() if posted else None,
        "applicants": appl.group(1).strip() if appl else None,
                "salary_text": pay_in_text[:2], "modes": modes, "days_per_week": days.group(0) if days else None,
        "intro": body[:300],
    }
    open(f"{outdir}/summary.jsonl", "a").write(json.dumps(rec) + "\n")
    print(f"{code} closed={rec['closed']} | {s[:70]} | pay={rec['salary_text'] or 'not in posting text'} | {modes} {rec['days_per_week'] or ''} | {rec['posted']} | {rec['applicants']}")
    time.sleep(7)
