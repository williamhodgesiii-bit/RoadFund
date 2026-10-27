import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Overpass } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/toast";

// Atkinson Hyperlegible was designed for low-vision readers; Overpass descends from Highway Gothic, the US road-sign face.
const body = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const heading = Overpass({ subsets: ["latin"], variable: "--font-heading", display: "swap", weight: ["600", "700", "800", "900"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Road Fund: dues and records for private roads", template: "%s · Road Fund" },
  description:
    "Collect road dues from every neighbor, pay the plow contractor from the road's own account, and keep a record anyone can trust. Neighbors pay from a text. No app, no password.",
  applicationName: "Road Fund",
  appleWebApp: { capable: true, title: "Road Fund", statusBarStyle: "default" },
  openGraph: {
    title: "Road Fund",
    description: "Dues, records and closing letters for private roads.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1F5E3B",
  width: "device-width",
  initialScale: 1,
};

// Applies the saved "larger text" choice before first paint.
const textSizeScript = `try{if(localStorage.getItem("rf:text")==="large")document.documentElement.dataset.text="large"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: textSizeScript }} />
      </head>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift">
          Skip to content
        </a>
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
