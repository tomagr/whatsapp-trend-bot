import { expect, test } from "vitest";
import { contactActions } from "@/lib/contact";

const kinds = (c: string) => contactActions(c).actions.map((a) => [a.kind, a.href]);

test("links full URLs, www hosts and bare domains", () => {
  expect(kinds("https://www.masquecamper.com/producto/x/")).toEqual([["site", "https://www.masquecamper.com/producto/x/"]]);
  expect(kinds("www.stockcenter.com.ar")).toEqual([["site", "https://www.stockcenter.com.ar/"]]);
  expect(kinds("ultrahuman.com")).toEqual([["site", "https://ultrahuman.com/"]]);
  expect(kinds("fitgearsource.com/lefit-and-ping-an-health/")).toEqual([["site", "https://fitgearsource.com/lefit-and-ping-an-health/"]]);
  expect(contactActions("eu.formswim.com").actions[0].label).toBe("eu.formswim.com");
});

test("labels LinkedIn and Instagram links", () => {
  expect(contactActions("https://www.linkedin.com/in/josetedin").actions[0]).toMatchObject({ kind: "linkedin", label: "LinkedIn" });
  expect(kinds("Instagram @msb_estilodeco")).toEqual([["instagram", "https://instagram.com/msb_estilodeco"]]);
  expect(kinds("instagram: sulfibra_argentina")).toEqual([["instagram", "https://instagram.com/sulfibra_argentina"]]);
});

test("emails become mailto and are not mistaken for domains or handles", () => {
  expect(kinds("manuel.leschik@beurer.de")).toEqual([["email", "mailto:manuel.leschik@beurer.de"]]);
});

test("phones get WhatsApp and call actions", () => {
  expect(kinds("+54 9 1123 45-6789")).toEqual([["whatsapp", "https://wa.me/5491123456789"], ["call", "tel:+5491123456789"]]);
});

test("digits inside URLs are not phone numbers", () => {
  expect(kinds("https://www.nature.com/articles/s41586-026-01234-9")).toEqual([["site", "https://www.nature.com/articles/s41586-026-01234-9"]]);
  expect(kinds("https://podcasts.apple.com/us/podcast/x/id1234567890?i=1000712345678")).toHaveLength(1);
});

test("vCards and private contacts point to the group; addresses stay plain text", () => {
  expect(contactActions("vCard compartida 'Leandro - Calefacción'")).toEqual({ actions: [], inGroup: true });
  expect(contactActions("Contacto de Marcos por privado (Esteban)")).toEqual({ actions: [], inGroup: true });
  expect(contactActions("Vélez Sársfield 1234, Munro")).toEqual({ actions: [], inGroup: false });
  expect(contactActions("Av. Mitre").actions).toEqual([]);
  expect(contactActions("vCard compartida: Anfora 9d; también en Mercado Libre").actions).toEqual([]);
});

test("never produces a non-web href", () => {
  for (const c of ["javascript:alert(1)", "data:text/html,x", "vbscript:x", "<a href=x>"]) {
    expect(contactActions(c).actions.every((a) => /^(https:|mailto:|tel:)/.test(a.href))).toBe(true);
  }
});
