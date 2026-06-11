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
// ToasterProvider removed — all toasts now route through Dynamic Island
import { IxTimeProvider } from "~/contexts/IxTimeContext";
import { ExecutiveNotificationProvider } from "~/contexts/ExecutiveNotificationContext";
import { GlobalNotificationSystem } from "~/components/notifications/GlobalNotificationSystem";
import { ToastProvider } from "~/components/ui/toast";
import { NotificationBadgeProvider } from "~/components/notifications/NotificationBadgeProvider";
import { withBasePath } from "~/lib/base-path";
import { headers } from "next/headers";
import { isStandaloneRequest } from "~/lib/standalone-detection";
import { MapPrefetcher } from "~/app/_components/MapPrefetcher";
import { GlobalLinkTooltipProvider } from "~/components/wiki/GlobalLinkTooltipProvider";
import { DIPluginProvider } from "~/components/DynamicIsland";
import { WikiContextProvider } from "~/components/wiki-os/shared/WikiContext";
import { ConsentManager } from "../components/consent-manager";

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
  description:
    "Build your country from the ground up. Design government systems, shape culture and identity, manage diplomacy, and watch your nation evolve",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const RootLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const headersList = await headers();
  const isStandalone = isStandaloneRequest(headersList);
  const dashboardPath = withBasePath("/dashboard");
  const signInPath = withBasePath("/sign-in");
  const signUpPath = withBasePath("/sign-up");

  const AppContent = () => (
    <TRPCReactProvider>
      <GlobalLinkTooltipProvider>
        <ThemeProvider>
          <IxTimeProvider>
            <ExecutiveNotificationProvider>
              <ToastProvider>
                <NotificationBadgeProvider>
                  <GlobalNotificationSystem>
                    <DIPluginProvider>
                      <WikiContextProvider>
                        <WebGLErrorHandler />
                        <MapPrefetcher />
                        <NavigationTransitionHandler />
                        {isStandalone ? (
                          <div className="flex min-h-screen flex-col">
                            <Navigation />
                            <main className="flex-1 flex flex-col">
                              <RackFocusBlurWrapper>{children}</RackFocusBlurWrapper>
                            </main>
                          </div>
                        ) : (
                          <div className="flex min-h-screen flex-col">
                            <Navigation />
                            {/* <GlobalActivityMarquee /> */}
                            <SetupRedirect />
                            <main className="flex-1 flex flex-col">
                              <RackFocusBlurWrapper>{children}</RackFocusBlurWrapper>
                            </main>
                          </div>
                        )}
                      </WikiContextProvider>
                    </DIPluginProvider>
                  </GlobalNotificationSystem>
                </NotificationBadgeProvider>
              </ToastProvider>
            </ExecutiveNotificationProvider>
          </IxTimeProvider>
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
                <AppContent />
              </AuthProvider>
            </ClerkProvider>
            {/* ToasterProvider removed — DynamicIslandToastManager handles rendering */}
          </ChunkLoadErrorBoundary>
        </ConsentManager>
      </body>
    </html>
  );
};

export default RootLayout;
