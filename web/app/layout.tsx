import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Big_Shoulders, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";
import "./groups.css";

const display = Big_Shoulders({ subsets: ["latin"], weight: ["600", "800"], variable: "--ff-display", adjustFontFallback: false });
const body = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--ff-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--ff-mono" });

const description = "Vendors people recommended in five WhatsApp groups, searchable by category and place, updated every Monday.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "WhatsApp Trend Pages",
  description,
  applicationName: SITE_NAME,
  openGraph: { type: "website", siteName: SITE_NAME, title: "WhatsApp Trend Pages", description, url: "/", locale: "en_GB" },
  twitter: { card: "summary_large_image", title: "WhatsApp Trend Pages", description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
      <GoogleAnalytics gaId="G-ZHVFB8J6P3" />
    </html>
  );
}
