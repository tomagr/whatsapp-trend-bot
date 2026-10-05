You update a weekly analysis of a WhatsApp group. Work only from the text below; do not use any tools. Reply with ONE JSON object and nothing else.

## Group and current state
{{INPUT_JSON}}

`lang` is the language for every text you write (es = Argentine Spanish, en = English). `existing_vendors` and `existing_opportunities` are what the page already shows; reuse them instead of creating duplicates.

## Context lines (already analysed last week; use them only to understand replies, extract nothing from them)
{{CONTEXT_LINES}}

## New messages (analyse these)
{{NEW_MESSAGES}}

Line format: `[YYYY-MM-DD HH:MM:SS] Sender: message`. Senders shown as long numbers are members without a saved name; copy them as-is.

## What to extract

1. **vendors** — businesses, professionals, products, services, venues or events that someone in the NEW messages recommends, says they used with a good or bad result, shares as a contact (`<contact: Name>`) in answer to a request, or (only when `vendor_mode` is "type") presents as their own company. Skip generic brands with no seller and mere mentions without an endorsement.
   If it is the same as an existing vendor, set `matches_existing` to that vendor's `id` and keep its name.

2. **signals** — demand signals in the NEW messages: someone asks where to find/buy/hire something or for a trustworthy provider, complains something is hard to find, expensive, slow or unreliable, proposes a group purchase, organises a recurring hassle a service could solve, or says "+1 / me too". In community groups also count intro requests, hiring posts and "looking for…" lines.
   Assign each signal to the existing opportunity whose title/summary covers the same underlying need (`opportunity` = its `key`). Only when none fits and the need is a real business opportunity, create a new one in `new_opportunities` and use its new `key`. If a signal fits nothing and is too minor for a new opportunity, set `opportunity` to "none".

## Privacy
Never output bank details (CBU/CVU/alias), ID numbers, private phone numbers or personal emails. In parents' groups replace children's first names in quotes with "[niño/a]".

## Output schema
{
  "vendors": [
    {"vendor": "name", "matches_existing": "existing id or null", "category": "short category in lang",
     "service": "what they do / why recommended (short, lang)", "location": "or null", "contact": "business phone/instagram/web or null",
     "recommended_by": ["sender as shown"], "sentiment": "positive|mixed|negative",
     "type": "only when vendor_mode is type: one of vendor_types", "dates": ["YYYY-MM-DD"], "evidence": "verbatim quote < 200 chars"}
  ],
  "signals": [
    {"need": "short normalized label in English", "date": "YYYY-MM-DD", "asker": "sender as shown",
     "answered": "yes|partial|no (did the group give a concrete solution?)", "quote": "verbatim < 200 chars",
     "opportunity": "existing key, a new key from new_opportunities, or none"}
  ],
  "new_opportunities": [
    {"key": "short-kebab-key", "title": "lang", "summary": "what people keep asking for (lang)",
     "offer": "what a business could offer (lang)", "alternatives": "what people use today (lang)"}
  ]
}
Return empty arrays when there is nothing to report.
