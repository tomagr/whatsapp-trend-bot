import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Shared look for the link-preview images: the page's own palette, display face and eyebrow style.
export const OG_SIZE = { width: 1200, height: 630 };

// Group names carry WhatsApp emoji ("🙋Members"); the image fonts have no emoji glyphs.
export const stripEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}‍️]/gu, "").trim();

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));

type Palette = { bg: string; ink: string; muted: string; line: string; accent: string; signal: string };

// photo: the WhatsApp group photo as a data: URL, shown as a circle in the top-right corner.
export async function ogImage({ palette: p, eyebrow, title, subtitle, footer, swatches, photo }: {
  palette: Palette; eyebrow: string; title: string; subtitle: string; footer: string[]; swatches?: string[]; photo?: string | null;
}) {
  const [display, body, bodyBold, mono] = await Promise.all([
    font("BigShoulders-ExtraBold.ttf"), font("PublicSans-Regular.ttf"), font("PublicSans-SemiBold.ttf"), font("IBMPlexMono-Medium.ttf"),
  ]);
  const titleSize = title.length > 22 ? 104 : 132;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", background: p.bg, color: p.ink, fontFamily: "Public Sans" }}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> only
          <img src={photo} alt="" width={168} height={168}
            style={{ position: "absolute", top: 64, right: 72, width: 168, height: 168, borderRadius: 84, border: `6px solid ${p.accent}`, objectFit: "cover" }} />
        )}
        <div style={{ display: "flex", height: 18, background: p.accent }} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "56px 72px 48px" }}>
          <div style={{ display: "flex", fontFamily: "IBM Plex Mono", fontSize: 26, letterSpacing: 2, textTransform: "uppercase", color: p.muted }}>{eyebrow}</div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", borderBottom: `5px solid ${p.ink}`, paddingBottom: 28 }}>
            <div style={{ display: "flex", fontFamily: "Big Shoulders", fontSize: titleSize, lineHeight: 0.95, textTransform: "uppercase", paddingRight: photo ? 220 : 0 }}>{title}</div>
            <div style={{ display: "flex", marginTop: 18, fontSize: 40, fontWeight: 600, color: p.accent }}>{subtitle}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 28, fontFamily: "IBM Plex Mono", fontSize: 26, color: p.muted }}>
            {footer.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <div style={{ display: "flex", width: 10, height: 10, borderRadius: 5, background: p.signal, margin: "0 22px" }} />}
                {f}
              </div>
            ))}
            {swatches && (
              <div style={{ display: "flex", marginLeft: "auto" }}>
                {swatches.map((c) => <div key={c} style={{ display: "flex", width: 34, height: 34, borderRadius: 6, background: c, marginLeft: 10 }} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Big Shoulders", data: display, weight: 800, style: "normal" },
        { name: "Public Sans", data: body, weight: 400, style: "normal" },
        { name: "Public Sans", data: bodyBold, weight: 600, style: "normal" },
        { name: "IBM Plex Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}
