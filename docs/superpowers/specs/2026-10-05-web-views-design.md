# Web views: replace the artifact pages with a Next.js site

Date: 2026-10-05 · Status: approved design, pending spec review

## Goal

Replace the six claude.ai artifact pages (index + one page per WhatsApp group) with a Next.js site on Vercel backed by the Postgres database in `.env` (`DATABASE_URL`, database `trend_bot`). The weekly job writes its results straight to Postgres, so the manual `/publicar-tendencias` step disappears.

### Decisions (from the user)

| Topic | Decision |
|---|---|
| Audience | Deployed, shareable link, no login (anyone with the link can view and add vendors, as today) |
| Publishing | The weekly job writes directly to Postgres; no review step |
| Existing artifacts | One-time import of their data (incl. hand-added vendors and deletions), then stop updating them; do not delete them |
| Scope | 1:1 port of today's pages: same tabs, filters, add/delete vendor, look |
| Hosting | Vercel |
| Architecture | Database layer lives only in the web project (Prisma); Python pipeline unchanged up to "merge" |

### Non-goals

- Login, roles, or per-user data.
- Redirects from the old artifact URLs.
- New features or a redesign (later, separately).
- Editing vendors on the site (today's pages only add and delete).

## 1. Data model (Prisma, `web/prisma/schema.prisma`)

**Group**: one row per WhatsApp group.

| Field | Type | Source |
|---|---|---|
| `key` (PK) | string | `groups.json` key: `overland`, `sombreros`, `members`, `briefings`, `moves` |
| `name` | string | `groups.json` |
| `lang` | `es` \| `en` | `groups.json` |
| `vendorMode` | `sentiment` \| `type` | `groups.json` |
| `checkedAt` | date, nullable | `state/<key>/meta.json` `checkedAt` |
| `messagesThrough` | date, nullable | `state/<key>/meta.json` `messagesThrough` |

**Vendor**

| Field | Type | Notes |
|---|---|---|
| `id` (PK) | cuid | |
| `groupKey` | FK → Group | |
| `slug` | string, nullable | pipeline vendor id (e.g. `andres-garcia-lubricentro`); null for manual vendors; unique per group (`@@unique([groupKey, slug])`) |
| `name`, `category`, `service`, `location`, `contact`, `recommendedBy`, `note`, `quote` | string (default `""`) | same meaning as today's vendor doc |
| `mentions` | int | |
| `sentiment` | `positive` \| `mixed` \| `negative` \| null | Spanish groups |
| `type` | `recommendation` \| `self-promotion` \| `featured` \| null | English groups |
| `dates` | string[] (ISO dates) | |
| `source` | `chat` \| `manual` | `chat` = from the pipeline; `manual` = added on the site |
| `createdAt`, `updatedAt` | timestamps | |
| `deletedAt` | timestamp, nullable | soft delete |

**Opportunity**

| Field | Type |
|---|---|
| `groupKey` + `key` (composite PK) | FK → Group, string (`opp-01`…) |
| `rank` | int |
| `title`, `summary`, `offer`, `alternatives`, `gap` | string |
| `signals`, `people` | int |
| `firstDate`, `lastDate` | string (ISO date) |
| `quotes` | JSON: `[{date, who, text}]` |

Rules:

- A delete on the site sets `deletedAt`. Sync never clears it, so a deleted vendor stays deleted even if the chat mentions it again.
- Sync never reads or writes `source = manual` rows.
- Opportunities are replaced as a whole set per group on every sync. They are fully derived from `state/`.

## 2. Site (`web/`, Next.js App Router, TypeScript)

The current five group pages are two templates with per-group copy:

- **Spanish, sentiment filters**: overland, sombreros.
- **English, type filters**: members, briefings, moves; briefings adds a "Featured in briefings" filter.

### Routes

- `/`: index. The groups listed by community, with name, description, colour swatch and last-check date. Ported from `artifact/index.html`.
- `/[group]`: the group page. It has a Vendors tab (search, category chips, sentiment or type filter, "add vendor" form, delete on manual vendors) and an Opportunities tab (ranked list with summary, offer, alternatives, gap, signal and people counts, quotes). An unknown key returns 404.

### Rendering

- The server component reads the Group, its non-deleted Vendors and its Opportunities through Prisma. It renders dynamically on every request (`dynamic = "force-dynamic"`) so data is always current.
- A single client component, `GroupView`, holds the tabs, search (120 ms debounce), chips, filters and the add form, ported from the current page script. Keyboard navigation of the tabs and the ARIA roles are kept.

### Writes (server actions)

- `addVendor(groupKey, fields)` creates a `source: "manual"` vendor with `mentions: 1` and `dates: [today]`, then revalidates the page.
- `deleteVendor(id)` sets `deletedAt` and revalidates the page. It only works on `manual` vendors, and the button only appears on them.
  - Today only the artifact owner sees a delete button, on every vendor. With no login there is no owner, so the site limits deletion to vendors people added by hand; a visitor cannot remove pipeline vendors.
  - The two-click "¿Seguro? Borrar" / "Sure? Delete" confirmation is kept.
- The live-connection indicator ("en vivo" / "live") is dropped. Pages render fresh data on every request instead of subscribing to updates.
- Validation runs on the server (zod):
  - `groupKey` must exist;
  - `name` is required, at most 120 characters;
  - other text fields at most 500 characters;
  - `sentiment` and `type` must be valid enum values.
  
  Invalid input returns a field error that the form displays.

### Look

- Today's CSS is ported almost verbatim into a global stylesheet: tokens, light/dark mode with `data-theme`, layout, and the 16 px phone gutter.
- Fonts: Big Shoulders Display, Public Sans and IBM Plex Mono via `next/font/google`.
- Per-group copy lives in `web/lib/groupCopy.ts`: page title, eyebrow, description, search placeholder, accent/signal colours (light and dark), extra filter buttons and footnote text.
- The status line ("revisado el … · mensajes hasta …" / "checked … · messages through …") comes from the `Group` row.

## 3. Sync and weekly job

### Python side

- `trendbot plan` is replaced by `trendbot export`, which writes `state/<key>/site.json` for every group:

  ```json
  {"group": {"key", "name", "lang", "vendorMode", "checkedAt", "messagesThrough"},
   "vendors": {"<slug>": <vendor doc>},
   "opportunities": {"<key>": <opportunity doc incl. rank>}}
  ```

  The docs come from the existing `build_docs`, so ranking and privacy scrubbing stay in Python.
- `trendbot run` calls `export` where it called `plan`.
- New `trendbot sync` runs `web/scripts/sync.ts` (see below) under a 5-minute limit. Exit code 0 means success.
- Removed:
  - `pending/` folders and `published.json`;
  - `trendbot commit`;
  - the pending-writes part of `trendbot status` and `summary`;
  - the `.claude/skills/publicar-tendencias` skill;
  - the SessionStart hook in `.claude/settings.json`.

### Sync script (`web/scripts/sync.ts`, run with `tsx`)

For each `state/<key>/site.json`, in one transaction per group:

1. Upsert `Group`.
2. For each vendor slug: if a row `(groupKey, slug)` exists with `deletedAt` set, skip it. Otherwise upsert it with `source: "chat"`, overwriting its fields.
3. Delete the group's opportunities and insert the snapshot's.

Further behaviour:

- Running it twice gives the same result. A failed group does not stop the others, and the exit code is non-zero if any group failed.
- It prints one line per group: vendors upserted / skipped-deleted, opportunities written.
- It loads `DATABASE_URL` from the project-root `.env`.

### `scripts/run_weekly.sh`

- After `trendbot run`, it runs `trendbot sync` with a time limit.
- The notification click opens the site URL instead of the artifact hub.
- The message says "N vendors, M opportunities updated" in place of "corré /publicar-tendencias".
- If the sync fails, the notification reads "falló" and points to the log.

## 4. One-time import from the artifacts

1. **Export (Claude, interactive).** For each group's artifact (URLs in `groups.json`), list the `vendors` collection with `ArtifactData`, paging through all of it. Save the result to `web/import/<key>.json`.
2. **Load (`web/scripts/import-artifacts.ts`).** Run once, before the first sync:
   - Docs with `source: "manual"` are inserted as manual vendors, keeping `createdAt`.
   - Deletions to carry over are the slugs present in `state/<key>/published.json` (as `vendors/<slug>`) but absent from the artifact export. They are inserted as `chat` vendors with only `slug`/`name` from state, plus `deletedAt = now`.
   - The script prints counts per group. The counts are checked against the artifact listings before continuing.
3. Run the first `sync`.
4. `published.json` files are deleted only after the import has been verified.

The artifacts are neither modified nor deleted.

## 5. Layout, deploy, testing, cutover

### Layout

```
web/
  app/            layout.tsx, page.tsx (index), [group]/page.tsx, actions.ts, globals.css
  components/     GroupView.tsx (+ small presentational pieces)
  lib/            db.ts (Prisma client singleton), groupCopy.ts, validation.ts
  prisma/         schema.prisma, migrations/
  scripts/        sync.ts, import-artifacts.ts
  import/         artifact exports (one-time; deleted after import)
  tests/          sync.test.ts, actions.test.ts
```

The web app never reads `state/`. Only the scripts do, locally.

### Database

- Before migrating, list the existing tables in `trend_bot`. If anything conflicts with the new tables, stop and ask.
- Run `prisma migrate deploy`.

### Deploy

- New Vercel project with root directory `web/` and `DATABASE_URL` set for Production and Preview.
- Prisma uses the standard Node driver with `connection_limit` kept small (5) for serverless.
- If Vercel can't reach RDS (security group or network), stop and tell the user what to open. AWS is not changed.

### Testing

- **Vitest, sync rules.** Run against a throwaway Postgres schema in the same database, created and dropped by the test. Cases:
  - insert a new vendor;
  - update an existing vendor;
  - skip a deleted vendor;
  - leave manual vendors untouched;
  - replace opportunities;
  - a second run gives the same result.
- **Vitest, action validation.** Reject a missing name, overlong fields, a bad enum or an unknown group.
- **Browser check of the deployed site.**
  - The index, `/overland` and `/members` render with data.
  - Filters and search narrow the list.
  - The tabs switch.
  - Add a test vendor, see it, delete it, see it gone. The test row is then removed from the database.

### Cutover order

1. Scaffold the project and migrate the database.
2. Artifact export and import.
3. First sync, then verify counts.
4. Deploy to Vercel and run the browser check.
5. Switch `run_weekly.sh` to sync; remove the publish skill, the hook and `pending`/`published.json`.
6. Update the launchd notification link.
