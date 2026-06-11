// src/app/(wiki-os)/wiki/layout.tsx
// WikiOS Layout — wraps all wiki pages with the WikiOS chrome
// Uses a separate layout from IxStats to provide wiki-specific navigation

import "~/styles/wiki-os.css";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s — IxWiki",
    default: "IxWiki — WikiOS",
  },
  description:
    "IxWiki powered by WikiOS — the modern wiki experience for collaborative worldbuilding",
  openGraph: {
    siteName: "IxWiki",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
  // Prevent Cloudflare hotlink blocking — don't send referer to ixwiki.com resources
  referrer: "no-referrer-when-downgrade",
  alternates: {
    canonical: "https://ixwiki.com/wiki/Main_Page",
  },
};

export default function WikiOSLayout({ children }: { children: React.ReactNode }) {
  return <div className="wikios-root min-h-screen">{children}</div>;
}
