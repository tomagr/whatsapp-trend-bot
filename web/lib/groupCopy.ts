// Page copy ported verbatim from the artifact pages (artifact/*.html), one template per language.
export type GroupKey = "overland" | "sombreros" | "members" | "briefings" | "moves";
export const GROUP_KEYS: GroupKey[] = ["overland", "sombreros", "members", "briefings", "moves"];

export type GroupCopy = {
  eyebrowName: string;
  h1: [string, string];
  lede: string;
  chatFrom: string;            // first chat date, formatted as on the original page
  placeholder: string;
  filters: [string, string][]; // [value, label] after the "all" button
  addNote: string;
  catPlaceholder: string;
  quotePlaceholder: string;
  footer: (from: string, through: string) => string;
  community: string;
  indexMeta: string;
  indexDesc: string;
};

export const T = {
  es: {
    locale: "es-AR", eyebrow: "Grupo de WhatsApp · ", vendors: "proveedores", cats: "rubros",
    chat: ["chat del ", " al "] as const, updated: "Actualizado",
    tabVendors: "Proveedores", tabOpps: "Oportunidades", tabsLabel: "Proveedores / Oportunidades de negocio",
    searchLabel: "Buscar proveedores", filterLabel: "Filtrar por opinión", all: "Todas", add: "+ Sumar proveedor",
    chipsLabel: "Filtrar por rubro", allCats: "Todos los rubros", addTitle: "Sumar proveedor",
    f: { name: "Nombre *", cat: "Rubro *", service: "Qué hace / para qué lo recomendás *", loc: "Ubicación", locPh: "Ciudad, provincia",
         contact: "Contacto", contactPh: "Teléfono, Instagram o web", by: "Recomendado por", byPh: "Tu nombre", sent: "Opinión", quote: "Comentario" },
    sent: { positive: "Positiva", mixed: "Con reparos", negative: "Negativa" } as Record<string, string>,
    type: {} as Record<string, string>,
    save: "Guardar", cancel: "Cancelar", saving: "Guardando…", saved: (n: string) => `Listo, sumaste a ${n}.`,
    saveErr: "No se pudo guardar. Probá de nuevo en un momento.", fieldErr: "Revisá el campo marcado.",
    badge: "sumado acá", where: "Dónde", contact: "Contacto", recBy: () => "Lo recomendó",
    mention: (n: number) => (n === 1 ? " mención" : " menciones"), del: "Borrar", delSure: "¿Seguro? Borrar",
    said: "Qué se dijo en el grupo", dates: (n: number) => (n > 1 ? "Fechas: " : "Fecha: "),
    noMatch: "Nada coincide con esa búsqueda. Probá con otra palabra o sacá el filtro de rubro.",
    noVendors: "Todavía no hay proveedores cargados.",
    oppsLede: "Lo que la gente del grupo pide una y otra vez y nadie termina de resolver. Ordenadas por cuántas veces se mencionó.",
    oppsMethod: "Cada oportunidad agrupa preguntas, quejas y pedidos de “¿alguien conoce…?” del chat. “Pedidos” cuenta los mensajes; “personas”, cuántos miembros distintos lo pidieron.",
    signals: "pedidos", people: "personas", gap: { open: "Sin resolver", partial: "Resuelto a medias", served: "Ya hay oferta" } as Record<string, string>,
    offer: "Qué ofrecer", alts: "Lo que hoy se usa", evidence: "Qué se dijo en el grupo", oppsEmpty: "Todavía no hay oportunidades cargadas.",
    hashVendors: "#proveedores", hashOpps: "#oportunidades",
    filters: "Filtros", clear: "Limpiar", close: "Cerrar", by: "por", call: "Llamar",
    results: (n: number) => (n === 1 ? "1 resultado" : `${n} resultados`),
    show: (n: number) => (n === 1 ? "Ver 1 proveedor" : `Ver ${n} proveedores`),
    copy: "Copiar contacto", copied: "Copiado", askGroup: "El contacto se compartió en el grupo: pedilo ahí.",
    opinion: "Opinión", saidBy: "Lo dijo",
    topPicks: "Los más recomendados", explore: "Explorá por rubro", recent: "Mencionados hace poco", allVendors: "Todos los proveedores",
    seeContact: "Ver contacto", membersOnly: "Solo para miembros", oppsCta: "Ver oportunidades", oppsFirst: "La primera:",
    oppsTeaser: (n: number) => (n === 1 ? "1 cosa que el grupo pide y nadie resuelve" : `${n} cosas que el grupo pide y nadie resuelve`),
  },
  en: {
    locale: "en-GB", eyebrow: "WhatsApp group · ", vendors: "vendors", cats: "categories",
    chat: ["chat from ", " to "] as const, updated: "Updated",
    tabVendors: "Vendors", tabOpps: "Opportunities", tabsLabel: "Vendors / Business opportunities",
    searchLabel: "Search vendors", filterLabel: "Filter by source", all: "All", add: "+ Add vendor",
    chipsLabel: "Filter by category", allCats: "All categories", addTitle: "Add vendor",
    f: { name: "Name *", cat: "Category *", service: "What they do / why you recommend them *", loc: "Location", locPh: "City, country",
         contact: "Contact", contactPh: "Website, LinkedIn or email", by: "Recommended by", byPh: "Your name", sent: "Opinion", quote: "Comment" },
    sent: { positive: "Positive", mixed: "Mixed", negative: "Negative" } as Record<string, string>,
    type: { recommendation: "Recommended", "self-promotion": "Self-introduced", featured: "Featured" } as Record<string, string>,
    save: "Save", cancel: "Cancel", saving: "Saving…", saved: (n: string) => `Done, ${n} was added.`,
    saveErr: "Couldn’t save. Try again in a moment.", fieldErr: "Check the highlighted field.",
    badge: "added here", where: "Where", contact: "Contact",
    recBy: (type: string | null) => (type === "self-promotion" ? "Introduced by" : type === "featured" ? "Featured by" : "Recommended by"),
    mention: (n: number) => (n === 1 ? " mention" : " mentions"), del: "Delete", delSure: "Sure? Delete",
    said: "What was said in the group", dates: (n: number) => (n > 1 ? "Dates: " : "Date: "),
    noMatch: "Nothing matches that search. Try another word or clear the category filter.",
    noVendors: "No vendors yet.",
    oppsLede: "What members keep asking for that nobody fully solves yet. Ranked by how often it came up.",
    oppsMethod: "Each opportunity groups questions, complaints and “does anyone know…?” requests from the chat. “Requests” counts messages; “people” counts distinct members who raised it.",
    signals: "requests", people: "people", gap: { open: "Unmet", partial: "Partly served", served: "Already served" } as Record<string, string>,
    offer: "What to offer", alts: "What people use today", evidence: "What was said in the group", oppsEmpty: "No opportunities loaded yet.",
    hashVendors: "#vendors", hashOpps: "#opportunities",
    filters: "Filters", clear: "Clear", close: "Close", by: "by", call: "Call",
    results: (n: number) => (n === 1 ? "1 result" : `${n} results`),
    show: (n: number) => (n === 1 ? "Show 1 vendor" : `Show ${n} vendors`),
    copy: "Copy contact", copied: "Copied", askGroup: "The contact was shared in the group: ask for it there.",
    opinion: "Source", saidBy: "Said by",
    topPicks: "Most recommended", explore: "Browse by category", recent: "Mentioned recently", allVendors: "All vendors",
    seeContact: "See contact", membersOnly: "Members only", oppsCta: "See opportunities", oppsFirst: "Top of the list:",
    oppsTeaser: (n: number) => (n === 1 ? "1 thing the group keeps asking for" : `${n} things the group keeps asking for`),
  },
};

export const COPY: Record<GroupKey, GroupCopy> = {
  overland: {
    eyebrowName: "Argentina Overland Trucks",
    h1: ["Recomendaciones de ", "Argentina Overland Trucks"],
    lede: "Talleres, comercios y contactos que la gente del grupo recomendó en el chat. Buscá por nombre, rubro o ciudad.",
    chatFrom: "29/03/2026",
    placeholder: "Buscar: cubiertas, Victron, Mendoza, Sergio…",
    filters: [["positive", "Positivas"], ["mixed", "Con reparos"]],
    addNote: "Lo ve todo el que abra esta página. Poné solo lo que sepas de primera mano o te hayan recomendado en el grupo.",
    catPlaceholder: "Ej.: Neumáticos",
    quotePlaceholder: "Cómo te fue, precios, tiempos…",
    footer: (from, through) => `Lista armada a partir de los mensajes del grupo entre el ${from} y el ${through}, más lo que se fue sumando acá. Las menciones cuentan los días distintos en que alguien recomendó al proveedor. Cuando no hay nombre guardado, el que recomendó aparece como “miembro …1234” (últimos dígitos de su ID de WhatsApp). Antes de contratar, confirmá datos y precios con el proveedor.`,
    community: "Communities",
    indexMeta: "ES · since Mar 2026",
    indexDesc: "Workshops, tires, camper builders and electricians for truck campers, plus the gaps overlanders keep running into.",
  },
  sombreros: {
    eyebrowName: "Sombreros misteriosos",
    h1: ["Recomendaciones de ", "Sombreros misteriosos"],
    lede: "Comercios, profesionales y lugares que las familias del grado recomendaron en el chat. Buscá por nombre, rubro o barrio.",
    chatFrom: "09/09/2025",
    placeholder: "Buscar: tortas, pediatra, Munro, cumple…",
    filters: [["positive", "Positivas"], ["mixed", "Con reparos"], ["negative", "Negativas"]],
    addNote: "Lo ve todo el que abra esta página. No pongas datos personales de chicos ni datos bancarios.",
    catPlaceholder: "Ej.: Cumpleaños y eventos",
    quotePlaceholder: "Cómo te fue, precios, horarios…",
    footer: (from, through) => `Lista armada a partir de los mensajes del grupo entre el ${from} y el ${through}, más lo que se fue sumando acá. Las menciones cuentan los días distintos en que alguien recomendó al proveedor. Cuando no hay nombre guardado, quien recomendó aparece como “miembro …1234” (últimos dígitos de su ID de WhatsApp). Antes de contratar, confirmá datos y precios con el proveedor.`,
    community: "Communities",
    indexMeta: "ES · since Sep 2025",
    indexDesc: "Shops, clubs, camps and outings the class families recommend, and what parents spend most of the chat organizing.",
  },
  members: {
    eyebrowName: "🙋Members",
    h1: ["Recommendations from ", "Members"],
    lede: "Companies, products and professionals recommended or introduced in the community chat. Search by name, category or country.",
    chatFrom: "Sep 10, 2025",
    placeholder: "Search: wearables, coaching, Germany…",
    filters: [["recommendation", "Recommended"], ["self-promotion", "Self-introduced"]],
    addNote: "Everyone who opens this page sees it. Add what you know first-hand or what was recommended in the group.",
    catPlaceholder: "e.g. Wearables",
    quotePlaceholder: "Your experience, pricing, results…",
    footer: (from, through) => `Built from the group’s messages between ${from} and ${through}, plus anything added here. “Self-introduced” means a member presented their own company; “Recommended” means someone else vouched for it. Mentions count the distinct days a vendor came up. When no name is saved, the person appears as “member …1234” (last digits of their WhatsApp ID).`,
    community: "Fitness & health tech",
    indexMeta: "EN · since Sep 2025",
    indexDesc: "Companies members introduced or vouched for, and the intros, hires and insight they keep asking for.",
  },
  briefings: {
    eyebrowName: "📈Briefings",
    h1: ["Recommendations from ", "Briefings"],
    lede: "Companies, products and services that came up in the industry briefings: featured in the news, recommended by members, or introduced by their founders.",
    chatFrom: "Sep 9, 2025",
    placeholder: "Search: wearables, Basic-Fit, longevity…",
    filters: [["recommendation", "Recommended"], ["self-promotion", "Self-introduced"], ["featured", "Featured in briefings"]],
    addNote: "Everyone who opens this page sees it. Add what you know first-hand or what was recommended in the group.",
    catPlaceholder: "e.g. Wearables",
    quotePlaceholder: "Your experience, pricing, results…",
    footer: (from, through) => `Built from the group’s messages between ${from} and ${through}, plus anything added here. “Self-introduced” means a member presented their own company; “Recommended” means someone else vouched for it; “Featured” means it was highlighted in a news briefing. Mentions count the distinct days a vendor came up. When no name is saved, the person appears as “member …1234” (last digits of their WhatsApp ID).`,
    community: "Fitness & health tech",
    indexMeta: "EN · since Sep 2025",
    indexDesc: "Products and companies featured in the industry briefings, and the data members asked for.",
  },
  moves: {
    eyebrowName: "🏃‍♀️Moves",
    h1: ["Recommendations from ", "Moves"],
    lede: "Companies, ventures and services members announced or vouched for while sharing their career moves.",
    chatFrom: "Sep 9, 2025",
    placeholder: "Search: recruiting, wearables, Berlin…",
    filters: [["recommendation", "Recommended"], ["self-promotion", "Self-introduced"]],
    addNote: "Everyone who opens this page sees it. Add what you know first-hand or what was recommended in the group.",
    catPlaceholder: "e.g. Wearables",
    quotePlaceholder: "Your experience, pricing, results…",
    footer: (from, through) => `Built from the group’s messages between ${from} and ${through}, plus anything added here. “Self-introduced” means a member presented their own company; “Recommended” means someone else vouched for it. Mentions count the distinct days a vendor came up. When no name is saved, the person appears as “member …1234” (last digits of their WhatsApp ID).`,
    community: "Fitness & health tech",
    indexMeta: "EN · since Sep 2025",
    indexDesc: "New ventures and wearables shared alongside career moves, and the partners and testers founders look for.",
  },
};

// What the pages know about a group. Groups added from /admin have no hand-written COPY entry, so their copy comes
// from copyFor()'s template; it runs on the server and in GroupView, so it has to stay a pure function.
export type GroupInfo = { key: string; name: string; lang: string; vendorMode: string; description?: string | null; addedAt?: string | Date | null };

export const ADDED_SECTION = "Added groups";
export const isBuiltIn = (key: string): key is GroupKey => (GROUP_KEYS as string[]).includes(key);

const MONTHS = { es: "ene feb mar abr may jun jul ago sep oct nov dic".split(" "), en: "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ") };

export function copyFor(g: GroupInfo): GroupCopy {
  if (isBuiltIn(g.key)) return COPY[g.key];
  const es = g.lang !== "en";
  const added = g.addedAt ? new Date(g.addedAt) : null;
  const since = added ? `${MONTHS[es ? "es" : "en"][added.getUTCMonth()]} ${added.getUTCFullYear()}` : "";
  const typed = g.vendorMode === "type";
  return {
    eyebrowName: g.name,
    h1: es ? ["Recomendaciones de ", g.name] : ["Recommendations from ", g.name],
    lede: g.description?.trim() || (es
      ? "Comercios, profesionales y contactos que la gente del grupo recomendó en el chat. Buscá por nombre, rubro o lugar."
      : "Companies, products and professionals recommended in the group chat. Search by name, category or place."),
    chatFrom: "",
    placeholder: es ? "Buscar por nombre, rubro o lugar…" : "Search by name, category or place…",
    filters: typed
      ? (es ? [["recommendation", "Recomendados"], ["self-promotion", "Se presentaron"]] : [["recommendation", "Recommended"], ["self-promotion", "Self-introduced"]])
      : (es ? [["positive", "Positivas"], ["mixed", "Con reparos"]] : [["positive", "Positive"], ["mixed", "Mixed"]]),
    addNote: "",
    catPlaceholder: "",
    quotePlaceholder: "",
    footer: (_from, through) => es
      ? `Lista armada a partir de los mensajes del grupo${through ? ` hasta el ${through}` : ""}. Las menciones cuentan los días distintos en que alguien recomendó al proveedor. Antes de contratar, confirmá datos y precios con el proveedor.`
      : `Built from the group’s messages${through ? ` through ${through}` : ""}. Mentions count the distinct days a vendor came up. Check details and prices with the vendor before hiring.`,
    community: ADDED_SECTION,
    indexMeta: `${es ? "ES" : "EN"}${since ? ` · added ${since}` : ""}`,
    indexDesc: g.description?.trim() || (es ? "Recomendaciones del grupo de WhatsApp." : "Recommendations from the WhatsApp group."),
  };
}
