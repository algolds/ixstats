// src/app/layout.tsx
import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "~/context/theme-context";
import { AuthProvider } from "~/context/auth-context";
import { createUrl } from "~/lib/url-utils";
import { Navigation } from "~/app/_components/navigation";
import { GlobalActivityMarquee } from "~/app/_components/GlobalActivityMarquee";
import { SetupRedirect } from "~/app/_components/SetupRedirect";
import { WebGLErrorHandler } from "~/components/webgl-error-handler";
import { ToasterProvider } from "~/components/ToasterProvider";
import { IxTimeProvider } from "~/contexts/IxTimeContext";
import { ExecutiveNotificationProvider } from "~/contexts/ExecutiveNotificationContext";
import { GlobalNotificationSystem } from "~/components/notifications/GlobalNotificationSystem";
import { ToastProvider } from "~/components/ui/toast";
import { NotificationBadgeProvider } from "~/components/notifications/NotificationBadgeProvider";
import { withBasePath } from "~/lib/base-path";

export const dynamic = 'force-dynamic';

// Check if Clerk is configured with valid keys
const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && 
  process.env.CLERK_SECRET_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_') &&
  process.env.CLERK_SECRET_KEY.startsWith('sk_')
);

export const metadata: Metadata = {
  title: "IxStats - Nation Simulation Platform",
  description: "Build your country from the ground up. Design government systems, shape culture and identity, manage diplomacy, and watch your nation evolve",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const RootLayout = ({
  children,
}: Readonly<{ children: React.ReactNode }>) => {
  const dashboardPath = withBasePath('/dashboard');
  const signInPath = withBasePath('/sign-in');
  const signUpPath = withBasePath('/sign-up');

  const AppContent = () => (
    <TRPCReactProvider>
      <ThemeProvider>
        <IxTimeProvider>
          <ExecutiveNotificationProvider>
            <ToastProvider>
              <NotificationBadgeProvider>
                <GlobalNotificationSystem>
                  <WebGLErrorHandler />
                  <div className="min-h-screen flex flex-col">
                    <Navigation />
                    {/* <GlobalActivityMarquee /> */}
                    <SetupRedirect />
                    <main className="flex-1">
                      {children}
                    </main>
                  </div>
                </GlobalNotificationSystem>
              </NotificationBadgeProvider>
            </ToastProvider>
          </ExecutiveNotificationProvider>
        </IxTimeProvider>
      </ThemeProvider>
    </TRPCReactProvider>
  );

  if (!isClerkConfigured) {
    throw new Error(
      "Clerk keys are not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (pk_*) and CLERK_SECRET_KEY (sk_*) to run IxStats."
    );
  }

  return (
    <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
      <body className="min-h-screen transition-colors duration-200">
        <ClerkProvider
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
          signInUrl={signInPath}
          signUpUrl={signUpPath}
          signInFallbackRedirectUrl={dashboardPath}
          redirectUrl={dashboardPath}
        >
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ClerkProvider>
        <ToasterProvider />
      </body>
    </html>
  );
}

export default RootLayout;
