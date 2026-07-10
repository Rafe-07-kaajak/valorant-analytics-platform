import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Navbar } from "@repo/ui";
import { ThemeToggle } from "../components/ThemeToggle";
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
  title: "Valorant Analytics Platform",
  description: "Explainable predictions for professional VALORANT matches.",
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
        <Navbar
          logo={
            <Link href="/" className="text-sm font-semibold text-foreground">
              Valorant Analytics
            </Link>
          }
          links={navLinks}
          actions={<ThemeToggle />}
        />
        <main>{children}</main>
      </body>
    </html>
  );
}
