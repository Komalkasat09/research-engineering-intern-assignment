// FILE: app/layout.tsx

/**
 * Root layout — wraps every page in the app.
 *
 * Responsibilities:
 *   1. Inject Geist Sans + Geist Mono as CSS variables
 *      (used via var(--font-sans) and var(--font-mono) in globals.css)
 *   2. Set global metadata (title, description, OG tags)
 *   3. Apply the `dark` class to <html> for consistent color rendering
 *      (Signal is a dark-theme-only app — no light mode)
 *
 * The Zustand store is initialized client-side, so no server-side
 * hydration issues. All state lives in the browser.
 */

import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title:       "Signal — Narrative Intelligence",
  description:
    "Trace how political discourse moves from fringe subreddits to mainstream attention. " +
    "UMAP semantic maps, narrative velocity, coordinated behavior detection, and OSINT chatbot. " +
    "Built for SimPPL research.",
  keywords:    ["narrative intelligence", "social media analysis", "OSINT", "BERTopic", "SimPPL"],
  openGraph: {
    title:       "Signal — Narrative Intelligence",
    description: "Trace how narratives emerge, spread, and mutate across social media.",
    type:        "website",
    siteName:    "Signal",
  },
  robots: { index: false },  // Research tool, not for public indexing
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor:  "#0A0C0E",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}