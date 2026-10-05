// Reads WhatsApp group messages through WhatsApp Web (headless Chrome with a saved login).
//
//   node export.mjs login    opens a visible WhatsApp Web window; scan the QR with the phone once
//   node export.mjs check    exit 0 when the saved login works, 3 when WhatsApp Web needs a QR scan
//   node export.mjs export   stdin {"groups": [{"name", "since"}]} -> stdout {"groups": {name: {chat, messages} | {error}}}
//
// `since` is a unix timestamp; messages at or after it are returned. Progress goes to stderr.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import wwebjs from 'whatsapp-web.js';
import injected from 'whatsapp-web.js/src/util/Injected/Utils.js';

const { Client, LocalAuth } = wwebjs;
const { LoadUtils } = injected;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SESSION_DIR = path.join(ROOT, '.wa-session');
const READY_TIMEOUT_MS = 180_000;
const SETTLE_MS = 20_000; // let messages received while offline arrive before reading
const LOGIN_TIMEOUT_MS = 600_000;

const log = (...a) => console.error('[wa]', ...a);

function makeClient(headless) {
  // Chrome reopens the tabs of a run that did not exit cleanly; WhatsApp Web then reports
  // "open in another window" and never loads. Start every run with a single fresh tab.
  fs.rmSync(path.join(SESSION_DIR, 'session', 'Default', 'Sessions'), { recursive: true, force: true });
  return new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
    puppeteer: { headless },
    // Always load the live WhatsApp Web; a cached copy of an older build conflicts with the saved session.
    webVersionCache: { type: 'none' },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  });
}

// Runs inside WhatsApp Web: is it synced, and are the library's helpers (window.WWebJS) loaded?
function pageState() {
  try {
    return { synced: !!window.require('WAWebSocketModel').Socket.hasSynced, utils: typeof window.WWebJS !== 'undefined' };
  } catch {
    return { synced: false, utils: false };
  }
}

// Resolves 'ready' once logged in, or 'qr' when WhatsApp Web asks for a scan (unless waitForScan).
function start(client, { waitForScan = false, timeout = READY_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    let poll;
    const timer = setTimeout(() => { clearInterval(poll); reject(new Error(`WhatsApp Web did not load within ${timeout / 1000}s`)); }, timeout);
    const done = () => { clearTimeout(timer); clearInterval(poll); };
    client.on('qr', () => {
      if (waitForScan) { log('scan the QR code in the WhatsApp Web window with your phone'); return; }
      done(); resolve('qr');
    });
    client.on('loading_screen', (pct) => log(`loading ${pct}%`));
    client.on('change_state', (st) => log(`state ${st}`));
    client.on('auth_failure', (m) => { done(); reject(new Error(`auth failure: ${m}`)); });
    client.on('ready', () => { done(); resolve('ready'); });
    // WhatsApp Web sometimes reloads itself right after logging in (e.g. to switch to a new build). That cuts
    // the library's setup short and 'ready' never fires, although the page ends up synced and usable.
    // So once authenticated, also accept a page that stays synced with the helpers loaded for 3 checks in a row.
    client.on('authenticated', () => {
      log('authenticated');
      let stable = 0, missing = 0;
      poll = setInterval(async () => {
        const st = await client.pupPage.evaluate(pageState).catch(() => null);
        if (st?.synced && !st.utils && ++missing >= 5) { missing = 0; await client.pupPage.evaluate(LoadUtils).catch(() => {}); }
        stable = st?.synced && st.utils ? stable + 1 : 0;
        if (stable >= 3) { log('ready (page synced; library ready event did not fire)'); done(); resolve('ready'); }
      }, 1_000);
    });
    client.initialize().catch((e) => { done(); reject(e); });
  });
}

// Runs inside WhatsApp Web. Lighter than client.getChats(), which loads every group's metadata.
function listGroups() {
  return window.require('WAWebCollections').Chat.getModelsArray()
    .filter((c) => c.id.server === 'g.us')
    .map((c) => ({ id: c.id._serialized, name: c.formattedTitle || c.name || '', archived: !!c.archive }));
}

function findGroup(groups, name) {
  let hits = groups.filter((c) => c.name === name);
  if (!hits.length) hits = groups.filter((c) => (c.name || '').toLowerCase().includes(name.toLowerCase()));
  if (!hits.length) throw new Error(`no group found matching ${JSON.stringify(name)}`);
  if (hits.length > 1) throw new Error(`several groups match ${JSON.stringify(name)}: ${hits.map((c) => c.name).join(', ')}`);
  return hits[0];
}

// Runs inside WhatsApp Web: page back through the chat until `since`, then serialize what we need.
async function readChat(chatId, since) {
  const chat = await window.WWebJS.getChat(chatId, { getAsModel: false });
  const loader = window.require('WAWebChatLoadMessages'); // keep `this`: the loader breaks when destructured
  const key = (m) => String(m.id); // message keys have no _serialized, unlike chat and contact ids
  const byId = new Map(chat.msgs.getModelsArray().map((m) => [key(m), m]));
  const oldest = () => Math.min(...[...byId.values()].map((m) => m.t));
  const stats = { initial: byId.size, pages: 0 };
  for (; stats.pages < 2000 && !(byId.size && oldest() < since); stats.pages++) {
    const more = await loader.loadEarlierMsgs({ chat });
    if (!more || !more.length) break;
    for (const m of more) byId.set(key(m), m);
  }
  const all = [...byId.values()].map((m) => m.t);
  stats.loaded = all.length;
  stats.range = all.length ? [Math.min(...all), Math.max(...all)].map((t) => new Date(t * 1000).toISOString().slice(0, 16)) : null;

  const msgs = [...byId.values()].filter((m) => m.t >= since).sort((a, b) => a.t - b.t);
  const names = {};
  for (const jid of new Set(msgs.map((m) => (m.author ? String(m.author) : null)).filter(Boolean))) {
    try {
      const c = await window.WWebJS.getContact(jid);
      names[jid] = c.name || c.pushname || c.verifiedName || null;
      if (!names[jid] && c.id?.user) names[jid] = c.id.user; // phone number when WhatsApp maps the LID to one
    } catch { names[jid] = null; }
  }
  return { stats, messages: msgs.map((m) => {
    const author = m.author ? String(m.author) : null;
    return {
      id: m.id.id,
      t: m.t,
      type: m.isNotification ? 'notification' : m.type,
      from_me: m.id.fromMe,
      author,
      author_name: m.id.fromMe ? 'Me' : names[author] || m.notifyName || (author ? author.split('@')[0] : null),
      body: m.directPath ? m.caption || '' : m.body || '',
      caption: m.caption || null,
      filename: m.filename || null,
      title: m.title || m.pollName || m.eventName || null,
      url: m.matchedText || m.canonicalUrl || null,
      lat: m.lat ?? null,
      lng: m.lng ?? null,
      vcard_name: m.vcardFormattedName || null,
      starred: !!m.star,
    };
  }) };
}

async function readStdin() {
  let s = '';
  for await (const chunk of process.stdin) s += chunk;
  return JSON.parse(s || '{}');
}

async function main() {
  const cmd = process.argv[2] || 'check';
  const login = cmd === 'login';
  const opts = { waitForScan: login, timeout: login ? LOGIN_TIMEOUT_MS : READY_TIMEOUT_MS };
  const client = makeClient(!login);
  let code = 0;
  try {
    const state = await start(client, opts);
    if (state === 'qr') {
      console.log('not-linked');
      code = 3;
    } else if (login) {
      log('linked; waiting for WhatsApp Web to sync recent chats');
      await new Promise((r) => setTimeout(r, 60_000));
      console.log('ok');
    } else if (cmd === 'check') {
      console.log('ok');
    } else if (cmd === 'export') {
      const req = await readStdin();
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      const groups = await client.pupPage.evaluate(listGroups);
      const out = { groups: {} };
      for (const { name, since } of req.groups || []) {
        try {
          const chat = findGroup(groups, name);
          log(`reading ${chat.name} since ${new Date(since * 1000).toISOString()}`);
          const { stats, messages } = await client.pupPage.evaluate(readChat, chat.id, since || 0);
          out.groups[name] = {
            chat,
            messages,
          };
          log(`${chat.name}: ${messages.length} new of ${stats.loaded} loaded (${stats.initial} in memory, ${stats.pages} pages, ${stats.range?.join(' → ') || 'none'})`);
        } catch (e) {
          out.groups[name] = { error: String(e.message || e) };
        }
      }
      process.stdout.write(JSON.stringify(out));
    } else {
      throw new Error(`unknown command ${cmd}`);
    }
  } catch (e) {
    log(e.stack || e);
    code = 1;
  }
  await shutdown(client);
  process.exit(code);
}

// Unload WhatsApp Web before closing Chrome, so the next run is not told it is open in another window.
async function shutdown(client) {
  await client.pupPage?.goto('about:blank', { timeout: 15_000 }).catch(() => {});
  await client.destroy().catch(() => {});
}

// The library sometimes rejects in the background (e.g. reading a response while the page navigates).
process.on('unhandledRejection', (e) => log('ignored:', String(e?.message || e).slice(0, 200)));

main();
