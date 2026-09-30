// src/app/layout.tsx
import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist, Playfair_Display } from "next/font/google";

import { ClerkProvider } from "@clerk/nextjs";
import { facetClerkAppearance } from "~/lib/clerk/theme";
import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "~/context/theme-context";
import { AuthProvider } from "~/context/auth-context";
import { MotionConfig } from "motion/react";
import { IconoirProvider } from "iconoir-react";
import { Navigation, NavigationTransitionHandler } from "~/app/_components";
import { SetupRedirect } from "~/app/_components/SetupRedirect";
import { WebGLErrorHandler } from "~/components/ui/webgl-error-handler";
import {
  ChunkLoadErrorBoundary,
  ChunkLoadErrorHandler,
} from "~/components/ui/ChunkLoadErrorBoundary";
import { Toaster } from "~/components/ui/toast";
import { withBasePath } from "~/lib/base-path";
import { headers } from "next/headers";
import { isStandaloneRequest } from "~/lib/system/standalone-detection";
import { MapPrefetcher } from "~/app/_components/MapPrefetcher";
import { GlobalLinkTooltips } from "~/components/wiki-os/shared/GlobalLinkTooltipProvider";

import { AbilityProvider } from "~/components/providers/AbilityProvider";
import { IxTimeProvider } from "~/context/IxTimeContext";
import { ExecutiveNotificationProvider } from "~/context/ExecutiveNotificationContext";
import { WikiContextProvider } from "~/components/wiki-os/shared/WikiContext";
import { LazyGameProviders } from "~/components/providers/LazyGameProviders";
import { CuelumeSoundProvider } from "~/components/providers/CuelumeSoundProvider";

// Removed force-dynamic to enable static generation and ISR where possible
// Dynamic data is handled through proper React boundaries and tRPC

// Check if Clerk is configured with valid keys
const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith("pk_") &&
  process.env.CLERK_SECRET_KEY.startsWith("sk_")
);

export const metadata: Metadata = {
  title: "IxStats — Nations, economy, lore",
  description: "Statistics and simulation game",
  icons: [{ rel: "icon", url: withBasePath("/favicon.ico") }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const ICON_DEFAULTS = { strokeWidth: 2 } as const;

function AppContent({
  children,
  isStandalone,
}: {
  children: React.ReactNode;
  isStandalone: boolean;
}) {
  return (
    <TRPCReactProvider>
      <ThemeProvider>
        {/*
          Icons were migrated from lucide-react (stroke 2) to iconoir-react (default stroke 1.5)
          at the same Tailwind sizes, so small icons (h-3 / h-3.5 / h-4) drew 0.75-1px strokes
          that looked faint and crunchy. One provider restores lucide-weight strokes site-wide;
          an explicit strokeWidth prop on an icon still wins.
        */}
        <IconoirProvider iconProps={ICON_DEFAULTS}>
          {/* One switch honours prefers-reduced-motion for every `motion` element in the tree. */}
          <MotionConfig reducedMotion="user">
            <AbilityProvider>
              <IxTimeProvider>
                <ExecutiveNotificationProvider>
                  <WikiContextProvider>
                    <LazyGameProviders>
                      <WebGLErrorHandler />
                      <MapPrefetcher />
                      <GlobalLinkTooltips />
                      <NavigationTransitionHandler />
                      <CuelumeSoundProvider />
                      <div className="flex min-h-screen flex-col">
                        <Navigation />
                        {!isStandalone && <SetupRedirect />}
                        {/* Media providers + MiniPlayer live in the (wiki-os) layout (narrator only). */}
                        <main className="flex flex-1 flex-col">{children}</main>
                      </div>
                    </LazyGameProviders>
                    <Toaster />
                  </WikiContextProvider>
                </ExecutiveNotificationProvider>
              </IxTimeProvider>
            </AbilityProvider>
          </MotionConfig>
        </IconoirProvider>
      </ThemeProvider>
    </TRPCReactProvider>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const isStandalone = isStandaloneRequest(headersList);
  const dashboardPath = withBasePath("/dashboard");
  const signInPath = withBasePath("/sign-in");
  const signUpPath = withBasePath("/sign-up");

  if (!isClerkConfigured) {
    throw new Error(
      "Clerk keys are not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (pk_*) and CLERK_SECRET_KEY (sk_*) to run IxStats."
    );
  }

  return (
    <html
      lang="en"
      className={`dark ${geist.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen transition-colors duration-200">
        <ChunkLoadErrorHandler />
        <ChunkLoadErrorBoundary>
          <ClerkProvider
            publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
            nonce={headersList.get("x-csp-nonce") ?? undefined}
            signInUrl={signInPath}
            signUpUrl={signUpPath}
            signInFallbackRedirectUrl={dashboardPath}
            appearance={facetClerkAppearance}
          >
            <AuthProvider>
              <AppContent isStandalone={isStandalone}>{children}</AppContent>
            </AuthProvider>
          </ClerkProvider>
        </ChunkLoadErrorBoundary>
      </body>
    </html>
  );
}
