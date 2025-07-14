// src/app/layout.tsx
import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "~/context/theme-context";
import { Navigation } from "~/app/_components/navigation";
import { SetupRedirect } from "~/app/_components/SetupRedirect";

export const metadata: Metadata = {
  title: "IxStats - Alpha version",
  description: "IxStats - Automated Economic Statistics for Ixnay",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const RootLayout = ({
  children,
}: Readonly<{ children: React.ReactNode }>) => {
  return (
    <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
      <body className="min-h-screen transition-colors duration-200">
        <ClerkProvider>
          <TRPCReactProvider>
            <ThemeProvider>
              <div className="min-h-screen flex flex-col">
                <Navigation />
                <SetupRedirect />
                <main className="flex-1">
                  {children}
                </main>
              </div>
            </ThemeProvider>
          </TRPCReactProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

export default RootLayout;