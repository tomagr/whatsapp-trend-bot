# WhatsApp Trend Bot

Reads chosen WhatsApp groups every week, uses Claude to pull out the vendors people recommend and the things members
keep asking for, and publishes one page per group on a small website.

- `trendbot/` (Python, standard library only) – the weekly pipeline: read messages → analyse with the `claude` CLI → merge → sync to the site's database.
- `wa/` (Node) – reads WhatsApp through WhatsApp Web in a headless Chrome (`whatsapp-web.js`); the login lives in `.wa-session/`.
- `web/` (Next.js + Prisma + Postgres) – the site. `/` lists the groups, `/<group>` is a group page, `/admin` queues updates and adds/removes groups. Read `web/AGENTS.md` before changing it.
- `scripts/run_weekly.sh` – the whole weekly run. `launchd/` – macOS agents: the Monday run and a once-a-minute poller (`web/scripts/poll-runs.mts`) that carries out what `/admin` asks for.
- `groups.json` – the built-in groups. Groups added from `/admin` live in the database and are mirrored to `state/groups-added.json`.

Settings are in `.env` at the project root (see `.env.example`), shared by the pipeline and the site.

## Two optional settings and their defaults

**Database.** With `DATABASE_URL` empty the site uses a Postgres on this computer: Prisma's built-in local server
(`prisma dev`, name `whatsapptrendbot`, data in `~/Library/Application Support/prisma-dev-nodejs/`). It is started
and migrated automatically the first time the site, a script or the tests need it (`web/lib/localDb.ts`), and again
after a restart. Nothing to install. With `DATABASE_URL` set, that database is used; RDS hosts are verified against
`web/certs/rds-global-bundle.pem`, other hosts against the public CAs, localhost without TLS (`web/lib/pgConfig.ts`).
Apply migrations to a hosted one with `cd web && npx prisma migrate deploy`.

**Login.** With `AUTH_SECRET`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` all set, the site uses Google sign-in limited
to `AUTH_ALLOWED_EMAIL_DOMAIN`; logged-out visitors see only the group pages, without opportunities or who recommended
whom. If any of the three is missing the site runs in **open mode** (`web/lib/authMode.ts`): no login page, every page
including `/admin` is public, and actions are recorded as "everyone". Open mode is meant for a site that only runs on
the user's own computer; do not put an open-mode site on the internet.

## Setting up for a new person

The person setting this up may not be technical. Do the work for them, explain in plain words, and ask only what is
theirs to decide (one question at a time, with a recommended option). Everything runs on a Mac that stays on.

1. **Check the tools.** macOS, `node` (Homebrew, `/opt/homebrew/bin/node`), `/usr/bin/python3`, and the `claude` CLI
   signed in (the analysis runs `claude -p`). Optional: `brew install terminal-notifier` for nicer notifications.
2. **Install.** `cd web && npm install` and `cd wa && npm install` (this also downloads Chrome for WhatsApp Web).
3. **Ask where to keep the data.**
   - *On this computer* (recommended if only they will use the site, on this Mac): leave `DATABASE_URL` empty.
   - *Online* (needed if the site goes on the internet, e.g. Vercel, or several people use it): help them create a
     free Postgres (Neon or Supabase), put its connection string in `DATABASE_URL`, then run `npx prisma migrate deploy` in `web/`.
4. **Ask about login.** No login (open mode, fine on their own computer) or Google sign-in (walk them through creating
   the OAuth client and fill the four `AUTH_*` values). Online hosting needs Google sign-in.
5. **Create `.env`** from `.env.example` with their answers (empty values are fine).
6. **Replace the groups.** `groups.json` holds the original owner's groups; set it to `[]` so they start clean and add
   their own from `/admin` → "Add group" (or write entries with the same fields by hand). A group with
   `privacy.scrub_child_names` needs `privacy.local.json` (`{"<group key>": ["child names to hide"]}`); the pipeline
   refuses to run without it.
7. **Link WhatsApp.** `python3 -m trendbot login`, then they scan the QR with their phone (WhatsApp → Linked devices).
8. **Point the hardcoded paths at this folder.** `/Users/tomas/projects/whatsappTrendBot` appears in
   `launchd/*.plist` and `app/launcher.applescript`; replace it with this project's path. In
   `scripts/run_weekly.sh`, set `HUB` to their site's address (`http://localhost:3000` for a local site).
9. **Build the launcher app and install the agents.**
   `osacompile -o "app/WhatsApp Trend Bot.app" app/launcher.applescript`, copy both plists to
   `~/Library/LaunchAgents/` and `launchctl load` each one.
10. **Run the site.** Locally: `cd web && npm run build && npm start` (http://localhost:3000). To keep it running
    after restarts, add a third LaunchAgent like the poll one with `npm start` in `web/` and `KeepAlive` true.
    Online: deploy `web/` to Vercel with the same env vars.
11. **Try it.** Open `/admin`, add a group, wait for the poller to run its first update (a minute to start, several
    minutes to finish), then open the group's page.

## Working on it

- Tests: `cd web && npm test` (each file migrates its own schema in the configured or local database), and
  `python3 -m unittest` at the root. `npx tsc --noEmit` and `npm run lint` in `web/`.
- The site never reads WhatsApp; only the Mac does, through `run_weekly.sh` and the poller, one run at a time (`logs/run.lock`).
