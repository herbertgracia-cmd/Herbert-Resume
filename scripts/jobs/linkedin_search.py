"""Search LinkedIn's public job listings (no login) with curl and collect unique postings.

Usage: python3 -I scripts/jobs/linkedin_search.py <out.json> "<query>" ["<query>" ...]
Searches the San Francisco Bay Area (and US remote with the suffix " |remote") for the past 14 days; returns the first 10 results per query.
"""
import html, json, re, subprocess, sys, time, urllib.parse

out, queries = sys.argv[1], sys.argv[2:]
try:
    jobs = json.load(open(out))
except Exception:
    jobs = {}

for q in queries:
    remote = q.endswith(" |remote")
    kw = q.replace(" |remote", "")
    params = {"keywords": kw, "f_TPR": "r1209600"}  # past 14 days
    if remote:
        params.update({"location": "United States", "f_WT": "2"})
    else:
        params["location"] = "San Francisco Bay Area"
    url = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        r = subprocess.run(["curl", "-sS", "-m", "25", "-w", "\n%{http_code}", url], capture_output=True, text=True)
        body, _, code = r.stdout.rpartition("\n")
        if code == "200":
            break
        time.sleep(15)
    cards = re.findall(
        r'href="(https://www\.linkedin\.com/jobs/view/[^"?]+)[^"]*".*?base-search-card__title">\s*(.*?)\s*</h3>'
        r'.*?base-search-card__subtitle">.*?>\s*(.*?)\s*</a>.*?job-search-card__location">\s*(.*?)\s*</span>'
        r'(?:.*?<time[^>]*datetime="([^"]+)")?',
        body, re.S)
    n = 0
    for u, t, c, loc, dt in cards:
        if u not in jobs:
            jobs[u] = {"title": html.unescape(t).strip(), "company": html.unescape(c).strip(),
                       "location": html.unescape(loc).strip(), "date": dt, "query": kw, "remote_search": remote}
            n += 1
    print(f"[{code}] {q}: {len(cards)} cards, {n} new")
    time.sleep(6)

json.dump(jobs, open(out, "w"), indent=1)
print("total unique:", len(jobs))
