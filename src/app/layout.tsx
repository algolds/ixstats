// src/app/layout.tsx
import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "~/context/theme-context";
import { MediaWikiProvider, MediaWikiLoadingIndicator } from "~/components/providers/MediaWikiProvider";

export const metadata: Metadata = {
  title: "IxStats - Ixnay Statistics Dashboard",
  description: "Advanced statistics and analysis platform for the Ixnay worldbuilding community",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body>
        <TRPCReactProvider>
          <ThemeProvider>
            <MediaWikiProvider>
              <main className="min-h-screen">
                {children}
              </main>
              {/* Global loading indicator for MediaWiki data */}
              <MediaWikiLoadingIndicator />
            </MediaWikiProvider>
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}