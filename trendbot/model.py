"""Deterministic merge rules: vendors, demand signals and ranked opportunities."""
import re
import unicodedata

MAX_OPPORTUNITIES = 10
MAX_QUOTES = 6
ANON = {"es": "miembro …", "en": "member …"}
SENTIMENTS = {"positive", "mixed", "negative"}
TYPE_STRENGTH = {"featured": 0, "self-promotion": 1, "recommendation": 2}


# ---- names and privacy ----

def norm(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def slug(s):
    return norm(s).replace(" ", "-")[:60] or "vendor"


def display_person(name, lang):
    """WhatsApp senders without a saved name come through as numeric ids."""
    name = re.sub(r"^Unknown \((\d+)\)$", r"\1", str(name or "").strip())
    name = re.sub(r"\s*\(\d+\)$", "", name)
    return ANON[lang] + name[-4:] if re.fullmatch(r"\d+", name) else name


_CBU = re.compile(r"\b\d{22}\b")
_PHONE = re.compile(r"\+?\d[\d\s().-]{8,}\d")


class Scrubber:
    def __init__(self, privacy, people):
        names = set(privacy.get("extra_names", []))
        if privacy.get("scrub_child_names"):
            for p in people:
                m = re.search(r"\b(?:mam[aá]|pap[aá])\s+(?:de\s+)?([A-ZÁÉÍÓÚ][\wáéíóúñ]+)", p or "", re.I)
                if m:
                    names.add(m.group(1))
        self.child = (re.compile(r"\b(" + "|".join(sorted(map(re.escape, names), key=len, reverse=True)) + r")\b", re.I)
                      if privacy.get("scrub_child_names") and names else None)

    def __call__(self, text):
        text = _PHONE.sub("[tel]", _CBU.sub("[cuenta]", str(text or "")))
        return self.child.sub("[niño/a]", text) if self.child else text


# ---- vendors ----

def merge_vendor(vendors, mention, cfg, scrub):
    """Fold one analysed vendor mention into the vendor table. Returns the vendor id."""
    lang = cfg["lang"]
    vid = mention.get("matches_existing")
    if vid not in vendors:
        key = norm(mention["vendor"])
        vid = next((i for i, v in vendors.items()
                    if key and (key == norm(v["doc"]["name"]) or key in map(norm, v.get("aliases", [])))), None)
    by = [display_person(p, lang) for p in mention.get("recommended_by") or []]
    dates = sorted(set(mention.get("dates") or []))
    sentiment = mention.get("sentiment") if mention.get("sentiment") in SENTIMENTS else "positive"

    if vid is None:
        vid = slug(mention["vendor"])
        base, n = vid, 2
        while vid in vendors:
            vid, n = f"{base}-{n}", n + 1
        doc = {"name": mention["vendor"], "category": mention.get("category") or "Otro",
               "service": mention.get("service") or "", "location": mention.get("location") or "",
               "contact": mention.get("contact") or "", "recommendedBy": ", ".join(dict.fromkeys(by)),
               "mentions": max(len(dates), 1), "sentiment": sentiment, "dates": dates, "note": "",
               "quote": scrub(mention.get("evidence")), "source": "chat"}
        if cfg["vendor_mode"] == "type":
            doc["type"] = mention.get("type") if mention.get("type") in cfg["vendor_types"] else cfg["vendor_types"][0]
        vendors[vid] = {"doc": doc, "aliases": [mention["vendor"]]}
        return vid

    rec, doc = vendors[vid], dict(vendors[vid]["doc"])
    doc["dates"] = sorted(set(doc.get("dates", [])) | set(dates))
    doc["mentions"] = max(len(doc["dates"]), 1)
    people = [p for p in (doc.get("recommendedBy") or "").split(", ") if p]
    doc["recommendedBy"] = ", ".join(dict.fromkeys(people + by))
    if sentiment != doc.get("sentiment"):
        doc["sentiment"] = "mixed"
    service = mention.get("service") or ""
    if service and norm(service) not in norm(doc.get("service")) and len(doc.get("service", "")) < 240:
        doc["service"] = " / ".join(filter(None, [doc.get("service"), service]))
    for field in ("location", "contact"):
        if not doc.get(field) and mention.get(field):
            doc[field] = mention[field]
    if cfg["vendor_mode"] == "type" and TYPE_STRENGTH.get(mention.get("type"), -1) > TYPE_STRENGTH.get(doc.get("type"), -1):
        doc["type"] = mention["type"]
    if mention["vendor"] not in rec.get("aliases", []):
        rec.setdefault("aliases", []).append(mention["vendor"])
    rec["doc"] = doc
    return vid


# ---- opportunities ----

def opportunity_docs(clusters, signals, lang, scrub):
    """Rank clusters by demand and build the docs the page shows (top 10)."""
    by_key = {}
    for s in signals:
        if s.get("opp") in clusters:
            by_key.setdefault(s["opp"], []).append(s)
    built = []
    for key, rows in by_key.items():
        c = clusters[key]
        ans = [r.get("answered", "partial") for r in rows]
        yes, no = ans.count("yes") / len(ans), ans.count("no") / len(ans)
        gap = c.get("gap") or ("served" if yes >= 0.6 else "open" if no >= 0.5 else "partial")
        order = {"no": 0, "partial": 1, "yes": 2}
        ranked = sorted(rows, key=lambda r: (order.get(r.get("answered"), 1), r["date"]))
        picked, seen = [], set()
        for r in ranked:  # one quote per person first, unanswered first
            if r["asker"] not in seen and len(picked) < MAX_QUOTES and len(r.get("quote", "").strip()) > 3:
                seen.add(r["asker"]); picked.append(r)
        for r in ranked:
            if len(picked) >= MAX_QUOTES:
                break
            if r not in picked and len(r.get("quote", "").strip()) > 3:
                picked.append(r)
        picked.sort(key=lambda r: r["date"])
        dates = sorted(r["date"] for r in rows)
        built.append({
            "title": c["title"], "summary": c.get("summary", ""), "offer": c.get("offer", ""),
            "alternatives": c.get("alternatives", ""), "gap": gap, "signals": len(rows),
            "people": len({r["asker"] for r in rows}), "firstDate": dates[0], "lastDate": dates[-1],
            "quotes": [{"date": r["date"], "who": display_person(r["asker"], lang), "text": scrub(r["quote"])} for r in picked],
        })
    built.sort(key=lambda o: (-o["signals"], -o["people"], o["title"]))
    built = built[:MAX_OPPORTUNITIES]
    for i, o in enumerate(built, 1):
        o["rank"] = i
    return {f"opp-{o['rank']:02d}": o for o in built}
