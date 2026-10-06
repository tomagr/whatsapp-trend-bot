import { OG_SIZE, ogImage } from "@/lib/ogImage";

export const alt = "Trend pages: vendors and business opportunities from WhatsApp groups";
export const size = OG_SIZE;
export const contentType = "image/png";

// Light-theme index palette from globals.css (.g-index), one swatch per group.
export default function Image() {
  return ogImage({
    palette: { bg: "#eff1ee", ink: "#1b201c", muted: "#5c655e", line: "#d5dbd5", accent: "#c2620f", signal: "#c2620f" },
    eyebrow: "5 WhatsApp groups · Amalgama",
    title: "Trend pages",
    subtitle: "Vendors people recommend, and what they ask for",
    footer: ["Updated every Monday"],
    swatches: ["#3f5a2a", "#2c4f8a", "#0f6b62", "#3b4fa8", "#7a3e8f"],
  });
}
