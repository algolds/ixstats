// src/app/layout.tsx
import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist, Playfair_Display } from "next/font/google";

import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "~/context/theme-context";
import { AuthProvider } from "~/context/auth-context";
import { Navigation, NavigationTransitionHandler, RackFocusBlurWrapper } from "~/app/_components";
import { SetupRedirect } from "~/app/_components/SetupRedirect";
import { WebGLErrorHandler } from "~/components/webgl-error-handler";
import { ChunkLoadErrorBoundary, ChunkLoadErrorHandler } from "~/components/ChunkLoadErrorBoundary";
import { ToastProvider } from "~/components/ui/toast";
import { withBasePath } from "~/lib/base-path";
import { headers } from "next/headers";
import { isStandaloneRequest } from "~/lib/system";
import { MapPrefetcher } from "~/app/_components/MapPrefetcher";
import { GlobalLinkTooltipProvider } from "~/components/wiki/GlobalLinkTooltipProvider";
import { ConsentManager } from "../components/consent-manager";
import { MediaContextProvider } from "~/components/media/MediaContext";
import { MiniPlayer } from "~/components/media/MiniPlayer";

import { AbilityProvider } from "~/components/providers/AbilityProvider";
import { IxTimeProvider } from "~/context/IxTimeContext";
import { ExecutiveNotificationProvider } from "~/context/ExecutiveNotificationContext";
import { WikiContextProvider } from "~/components/wiki-os/shared/WikiContext";
import { LazyGameProviders } from "~/components/providers/LazyGameProviders";

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const isStandalone = isStandaloneRequest(headersList);
  const dashboardPath = withBasePath("/dashboard");
  const signInPath = withBasePath("/sign-in");
  const signUpPath = withBasePath("/sign-up");

  const AppContent = () => (
    <TRPCReactProvider>
      <GlobalLinkTooltipProvider>
        <ThemeProvider>
          <AbilityProvider>
            <IxTimeProvider>
              <ExecutiveNotificationProvider>
                <WikiContextProvider>
                  <ToastProvider>
                    <LazyGameProviders>
                      <WebGLErrorHandler />
                      <MapPrefetcher />
                      <NavigationTransitionHandler />
                      {isStandalone ? (
                        <div className="flex min-h-screen flex-col">
                          <Navigation />
                          <main className="flex flex-1 flex-col">
                            <RackFocusBlurWrapper>{children}</RackFocusBlurWrapper>
                          </main>
                        </div>
                      ) : (
                        <div className="flex min-h-screen flex-col">
                          <Navigation />
                          {/* <GlobalActivityMarquee /> */}
                          <SetupRedirect />
                          <main className="flex flex-1 flex-col">
                            <RackFocusBlurWrapper>{children}</RackFocusBlurWrapper>
                          </main>
                          <MiniPlayer />
                        </div>
                      )}
                    </LazyGameProviders>
                  </ToastProvider>
                </WikiContextProvider>
              </ExecutiveNotificationProvider>
            </IxTimeProvider>
          </AbilityProvider>
        </ThemeProvider>
      </GlobalLinkTooltipProvider>
    </TRPCReactProvider>
  );

  if (!isClerkConfigured) {
    throw new Error(
      "Clerk keys are not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (pk_*) and CLERK_SECRET_KEY (sk_*) to run IxStats."
    );
  }

  return (
    <html lang="en" className={`${geist.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body className="min-h-screen transition-colors duration-200">
        <ConsentManager>
          <ChunkLoadErrorHandler />
          <ChunkLoadErrorBoundary>
            <ClerkProvider
              publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
              nonce={headersList.get("x-csp-nonce") ?? undefined}
              signInUrl={signInPath}
              signUpUrl={signUpPath}
              signInFallbackRedirectUrl={dashboardPath}
            >
              <AuthProvider>
                <MediaContextProvider>
                  <AppContent />
                </MediaContextProvider>
              </AuthProvider>
            </ClerkProvider>
            {/* ToasterProvider removed — DynamicIslandToastManager handles rendering */}
          </ChunkLoadErrorBoundary>
        </ConsentManager>
      </body>
    </html>
  );
}
