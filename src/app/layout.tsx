// src/app/layout.tsx
import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "~/context/theme-context"; // Only ThemeProvider and useTheme (if needed here)
import { Navigation } from "~/app/_components/navigation"; // Import Navigation

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
      <body className="transition-colors duration-200 bg-gray-50 dark:bg-gray-900">
        <TRPCReactProvider>
          <ThemeProvider>
            <div className="min-h-screen">
              <Navigation /> {/* Use the imported Navigation component */}
              <main>{children}</main>
            </div>
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}

export default RootLayout;