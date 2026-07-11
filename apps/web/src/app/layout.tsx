import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Footer } from "@repo/ui";
import { SiteNavbar } from "../components/SiteNavbar";
import { MotionProvider } from "../components/MotionProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Valorant Analytics Platform",
    template: "%s",
  },
  description: "Explainable predictions for professional VALORANT matches.",
  openGraph: {
    title: "Valorant Analytics Platform",
    description: "Explainable predictions for professional VALORANT matches.",
    type: "website",
  },
};

const navLinks = [{ label: "Prediction Studio", href: "/prediction-studio" }];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <MotionProvider>
          <SiteNavbar links={navLinks} />
          <main>{children}</main>
          <Footer
            logo={
              <Link href="/" className="text-sm font-semibold text-foreground">
                Valorant Analytics
              </Link>
            }
            tagline="Explainable predictions for professional VALORANT matches."
            links={navLinks}
          />
        </MotionProvider>
      </body>
    </html>
  );
}
