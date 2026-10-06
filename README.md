# WhatsApp Trend Bot

Turns your WhatsApp groups into a small website. Once a week it reads the new messages in the groups you choose and
uses Claude to find:

- **Vendors**: the people and businesses members recommend (or warn about), with how to contact them.
- **Business opportunities**: what members keep asking for and nobody offers yet.

Each group gets its own page. An admin page lets you add or remove groups and run an update whenever you want.

## What you need

- A Mac that stays on (the weekly update runs on it every Monday at 09:00, or on wake if it was asleep).
- Your WhatsApp on your phone, to link the Mac to it once by scanning a QR code, like WhatsApp Web.
- [Claude Code](https://claude.com/claude-code), signed in. It sets the project up for you and does the analysis.

## Getting started

1. Download this project to your Mac.
2. Open the project folder in Claude Code.
3. Type: **"Set up this project for me."**

Claude Code follows the setup guide in [`CLAUDE.md`](CLAUDE.md). It installs what's needed and asks you a few
questions along the way:

- **Where to keep the data.** On your Mac (the simplest; nothing to set up) or in an online database (needed if you
  want the site on the internet for other people).
- **Whether to require a login.** Without one, anyone who can open the site sees everything, including the admin
  page. That's fine while the site only runs on your Mac. If you put it online, use Google sign-in.
- **Which WhatsApp groups to follow.** You add them from the admin page once the site is running.

Then you scan a QR code with your phone to link WhatsApp, and you're done.

## Using it

- Open the site (on your Mac: http://localhost:3000).
- **Admin → Add group** to follow a new group. Its first update starts within a minute or two.
- **Admin → Update** to read new messages now instead of waiting for Monday.
- After each update the Mac shows a notification saying how it went.

If something stops working, open the project in Claude Code and describe what you see. It can read the logs in `logs/`.

## Privacy

- Your WhatsApp messages are read only on your Mac. The site keeps only the results: vendors, opportunities and short
  quotes, not the chats.
- Phone and bank account numbers are removed from quotes (a vendor's own contact details stay), and so are
  children's names in groups where you turn that on.
- With the login on, people who aren't signed in see only the vendor lists, without who recommended whom.

## For developers

See [`CLAUDE.md`](CLAUDE.md) for how the project is laid out, its settings ([`.env.example`](.env.example)), the full
setup steps and how to run the tests.
