import type { Metadata } from "next";
import { Geist_Mono, Inter, Space_Grotesk } from "next/font/google";
import { SiteNavbar } from "../components/SiteNavbar";
import { SiteFooter } from "../components/SiteFooter";
import { MotionProvider } from "../components/MotionProvider";
import { CursorTracker } from "../components/effects/CursorTracker";
import { CursorSpotlight } from "../components/effects/CursorSpotlight";
import { MEDIA_ASSETS } from "../constants/media";
import "./globals.css";

// TASK-050 — body/UI face (--font-body). `display: "swap"` avoids invisible
// text while loading; next/font self-hosts the file at build time (no
// runtime request to fonts.googleapis.com) and reserves layout space via a
// fallback-metrics adjustment, so there's no layout shift on load.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// TASK-050 — heading/statement face (--font-display). Clash Display and its
// approved fallbacks (Cabinet Grotesk, Satoshi, General Sans) are Fontshare-
// exclusive fonts with no next/font/google source and no licensed local
// file in this repo; per user decision this task substitutes Space
// Grotesk, a geometric Google Font in the same expressive-display register,
// until licensed files are available. See docs/38.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Valorant Analytics Platform",
    template: "%s",
  },
  description: "Explainable predictions for professional VALORANT matches.",
  openGraph: {
    title: "Valorant Analytics Platform",
    description: "Explainable predictions for professional VALORANT matches.",
    type: "website",
    images: [
      {
        url: MEDIA_ASSETS.heroFallbackImage.path,
        width: MEDIA_ASSETS.heroFallbackImage.width,
        height: MEDIA_ASSETS.heroFallbackImage.height,
        alt: "Valorant Analytics Platform",
      },
    ],
  },
};

const navLinks = [
  { label: "Prediction Studio", href: "/prediction-studio" },
  { label: "Comparison Lab", href: "/team-comparison" },
  { label: "Map Explorer", href: "/map-matchup" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Dark is the only theme the application supports. `data-theme="dark"`
    // is set here, in the server-rendered markup, rather than by a client
    // effect after mount (the previous `useTheme` mechanism) — the CSS
    // system (tokens.css's `[data-theme="dark"]` block) already expects
    // this exact attribute, and setting it here means server HTML and the
    // first client render are byte-for-byte identical from the start: no
    // "light by default, then flip to dark after hydration" step exists to
    // ever produce a flash. `colorScheme: "dark"` hints native form
    // controls/scrollbars to render dark without waiting on any CSS load.
    <html
      lang="en"
      data-theme="dark"
      style={{ colorScheme: "dark" }}
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">
        <CursorTracker />
        <CursorSpotlight />
        <MotionProvider>
          <SiteNavbar links={navLinks} />
          <main>{children}</main>
          <SiteFooter links={navLinks} />
        </MotionProvider>
      </body>
    </html>
  );
}
