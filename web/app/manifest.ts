import type { MetadataRoute } from "next";

// Lets the site be installed (home screen, dock, launcher) with the platform icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WhatsApp Trend Pages",
    short_name: "Trend pages",
    description: "Vendors people recommended in WhatsApp groups, updated every Monday.",
    start_url: "/",
    display: "standalone",
    background_color: "#eff1ee",
    theme_color: "#1b201c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
