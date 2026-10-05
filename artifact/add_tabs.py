"""Add a vendors/opportunities tab split to the vendor pages. Idempotent per file (skips if already patched)."""
import json
import sys

STRINGS = {
    "es": {
        "tab_vendors": "Proveedores", "tab_opps": "Oportunidades de negocio",
        "opps_lede": "Lo que la gente del grupo pide una y otra vez y nadie termina de resolver. Ordenadas por cuántas veces se mencionó.",
        "signals": "pedidos", "people": "personas", "span": "período",
        "gap": {"open": "Sin resolver", "partial": "Resuelto a medias", "served": "Ya hay oferta"},
        "offer": "Qué ofrecer", "alts": "Lo que hoy se usa", "evidence": "Qué se dijo en el grupo",
        "loading": "Cargando oportunidades…", "empty": "Todavía no hay oportunidades cargadas.",
        "method": "Cada oportunidad agrupa preguntas, quejas y pedidos de “¿alguien conoce…?” del chat. “Pedidos” cuenta los mensajes; “personas”, cuántos miembros distintos lo pidieron.",
        "locale": "es-AR",
    },
    "en": {
        "tab_vendors": "Vendors", "tab_opps": "Business opportunities",
        "opps_lede": "What members keep asking for that nobody fully solves yet. Ranked by how often it came up.",
        "signals": "requests", "people": "people", "span": "period",
        "gap": {"open": "Unmet", "partial": "Partly served", "served": "Already served"},
        "offer": "What to offer", "alts": "What people use today", "evidence": "What was said in the group",
        "loading": "Loading opportunities…", "empty": "No opportunities loaded yet.",
        "method": "Each opportunity groups questions, complaints and “does anyone know…?” requests from the chat. “Requests” counts messages; “people” counts distinct members who raised it.",
        "locale": "en-GB",
    },
}

CSS = """
.tabs { display: flex; gap: 4px; margin-top: 18px; border-bottom: 1px solid var(--line); overflow-x: auto; }
.tab { border: 0; border-bottom: 3px solid transparent; border-radius: 0; background: transparent; padding: 10px 14px; font-family: var(--font-display); font-weight: 600; font-size: 20px; text-transform: uppercase; letter-spacing: .02em; color: var(--muted); white-space: nowrap; }
.tab[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--signal); }
.tab .n { font-family: var(--font-mono); font-size: 12px; font-weight: 400; margin-left: 6px; color: var(--muted); }
.opps-head { display: grid; gap: 6px; padding-block: 18px 6px; }
.opps-head p { margin: 0; color: var(--muted); max-width: 70ch; }
.opps { display: grid; gap: 14px; margin-top: 10px; }
.opp { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 18px; }
.opp > * { min-width: 0; }
.rank { grid-row: 1 / span 6; font-family: var(--font-display); font-weight: 800; font-size: 44px; line-height: .9; color: var(--signal); font-variant-numeric: tabular-nums; min-width: 1.4ch; }
.opp h3 { margin: 0; font-size: 18px; font-weight: 600; text-wrap: balance; }
.opp .sum { margin: 2px 0 0; color: var(--ink); max-width: 72ch; }
.demand { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; margin-top: 8px; font-family: var(--font-mono); font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.demand b { color: var(--ink); font-weight: 500; font-size: 15px; }
.bar { flex: 1 1 120px; max-width: 220px; height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--signal); }
.gap { font-family: var(--font-body); font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
.gap.open { color: var(--neg); background: var(--neg-bg); }
.gap.partial { color: var(--mix); background: var(--mix-bg); }
.gap.served { color: var(--pos); background: var(--pos-bg); }
.opp dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 14px; margin: 10px 0 0; font-size: 14px; }
.opp dt { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); padding-top: 3px; }
.opp dd { margin: 0; overflow-wrap: anywhere; }
.opp details { margin-top: 8px; font-size: 13.5px; }
.opp summary { cursor: pointer; color: var(--muted); font-size: 13px; width: fit-content; }
.opp ul { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 6px; }
.opp li { border-left: 3px solid var(--line); padding: 2px 0 2px 10px; }
.opp li .who { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted); display: block; }
.opps-method { margin-top: 18px; font-size: 12.5px; color: var(--muted); max-width: 75ch; }
@media (max-width: 760px) {
  .opp { grid-template-columns: minmax(0, 1fr); }
  .rank { grid-row: auto; font-size: 34px; }
  .opp dl { grid-template-columns: minmax(0, 1fr); }
}
"""


def html_block(L):
    return f"""
  <nav class="tabs" role="tablist" aria-label="{L['tab_vendors']} / {L['tab_opps']}">
    <button type="button" class="tab" role="tab" id="tab-btn-vendors" aria-controls="tab-vendors" aria-selected="true">{L['tab_vendors']}<span class="n" id="tab-n-vendors"></span></button>
    <button type="button" class="tab" role="tab" id="tab-btn-opps" aria-controls="tab-opps" aria-selected="false">{L['tab_opps']}<span class="n" id="tab-n-opps"></span></button>
  </nav>
"""


def opps_section(L):
    return f"""
  <section id="tab-opps" role="tabpanel" aria-labelledby="tab-btn-opps" hidden>
    <div class="opps-head"><p>{L['opps_lede']}</p></div>
    <div class="opps" id="opps"><div class="empty">{L['loading']}</div></div>
    <p class="opps-method">{L['method']}</p>
  </section>
"""


def js_block(L):
    return """
  // ---- Oportunidades / opportunities tab ----
  const OL = __L__;
  const oppState = { list: [] };
  function fmtMonth(d) {
    if (!d) return "";
    const [y, m] = String(d).split("-");
    try { return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(OL.locale, { month: "short", year: "numeric" }); } catch (e) { return d; }
  }
  function renderOpps() {
    const box = $("opps");
    $("tab-n-opps").textContent = oppState.list.length || "";
    if (!oppState.list.length) { box.replaceChildren(el("div", { class: "empty", text: OL.empty })); return; }
    const max = Math.max(...oppState.list.map((o) => o.signals || 0), 1);
    box.replaceChildren(...oppState.list.map((o) => {
      const bar = el("span", { class: "bar" }); const fill = el("i"); fill.style.width = Math.round(100 * (o.signals || 0) / max) + "%"; bar.append(fill);
      const demand = el("div", { class: "demand" },
        el("span", {}, el("b", { text: o.signals || 0 }), " " + OL.signals),
        el("span", {}, el("b", { text: o.people || 0 }), " " + OL.people),
        bar,
        o.firstDate ? el("span", { text: fmtMonth(o.firstDate) + (o.lastDate && o.lastDate.slice(0, 7) !== o.firstDate.slice(0, 7) ? " – " + fmtMonth(o.lastDate) : "") }) : null,
        el("span", { class: "gap " + (o.gap || "open"), text: OL.gap[o.gap] || OL.gap.open }));
      const dl = el("dl");
      if (o.offer) dl.append(el("dt", { text: OL.offer }), el("dd", { text: o.offer }));
      if (o.alternatives) dl.append(el("dt", { text: OL.alts }), el("dd", { text: o.alternatives }));
      const card = el("article", { class: "opp" },
        el("div", { class: "rank", text: o.rank }),
        el("h3", { text: o.title }),
        o.summary ? el("p", { class: "sum", text: o.summary }) : null,
        demand, dl);
      if (Array.isArray(o.quotes) && o.quotes.length) {
        card.append(el("details", {}, el("summary", { text: OL.evidence + " (" + o.quotes.length + ")" }),
          el("ul", {}, ...o.quotes.map((q) => el("li", {}, el("span", { class: "who", text: [fmtDate(q.date), q.who].filter(Boolean).join(" · ") }), q.text)))));
      }
      return card;
    }));
  }
  function showTab(which) {
    const opps = which === "opps";
    $("tab-btn-vendors").setAttribute("aria-selected", String(!opps));
    $("tab-btn-opps").setAttribute("aria-selected", String(opps));
    $("tab-vendors").hidden = opps; $("tab-opps").hidden = !opps;
    try { history.replaceState(null, "", opps ? "#oportunidades" : "#proveedores"); } catch (e) {}
  }
  $("tab-btn-vendors").addEventListener("click", () => showTab("vendors"));
  $("tab-btn-opps").addEventListener("click", () => showTab("opps"));
  document.querySelector(".tabs").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = $("tab-btn-vendors").getAttribute("aria-selected") === "true" ? "opps" : "vendors";
    showTab(next); $(next === "opps" ? "tab-btn-opps" : "tab-btn-vendors").focus();
  });
  if (/oportunidades|opportunities/.test(location.hash)) showTab("opps");
""".replace("__L__", json.dumps(L, ensure_ascii=False))


def patch(path, lang):
    L = STRINGS[lang]
    s = open(path, encoding="utf-8").read()
    if 'id="tab-opps"' in s:
        print("already patched", path); return
    def sub(a, b):
        nonlocal s
        assert s.count(a) == 1, (path, a[:50], s.count(a))
        s = s.replace(a, b)
    sub("@media (max-width: 760px) {", CSS.strip() + "\n\n@media (max-width: 760px) {")
    sub("  </header>\n", "  </header>\n" + html_block(L) + '\n  <div id="tab-vendors" role="tabpanel" aria-labelledby="tab-btn-vendors">\n')
    sub("  </main>\n", "  </main>\n  </div>\n" + opps_section(L))
    sub("  (async function boot() {", js_block(L) + "\n  (async function boot() {")
    # subscribe to opportunities right after the vendors subscription is set up
    sub('    const user = await api.use("user");',
        '    db.collection("opportunities").orderBy("rank").onSnapshot((snap) => {\n'
        '      oppState.list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));\n'
        '      renderOpps();\n'
        '    }, () => {});\n\n'
        '    const user = await api.use("user");')
    # vendor count on the tab
    sub("    $(\"st-total\").textContent = state.vendors.length;",
        "    $(\"st-total\").textContent = state.vendors.length;\n    $(\"tab-n-vendors\").textContent = state.vendors.length;")
    open(path, "w", encoding="utf-8").write(s)
    print("patched", path)


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        p, lang = arg.split(":")
        patch(p, lang)
