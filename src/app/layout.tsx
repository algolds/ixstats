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
import { ToastProvider } from "~/components/ui/toast";
import { IxTimeProvider } from "~/contexts/IxTimeContext";
import { ExecutiveNotificationProvider } from "~/contexts/ExecutiveNotificationContext";
import { UnifiedNotificationProvider } from "~/hooks/useUnifiedNotifications";

export const dynamic = 'force-dynamic';

// Check if Clerk is configured with valid keys
const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && 
  process.env.CLERK_SECRET_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_') &&
  process.env.CLERK_SECRET_KEY.startsWith('sk_')
);

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
  const AppContent = () => (
    <TRPCReactProvider>
      <ThemeProvider>
        <AuthProvider>
          <IxTimeProvider>
            <ExecutiveNotificationProvider>
              <UnifiedNotificationProvider>
                <ToastProvider>
              <WebGLErrorHandler />
              <div className="min-h-screen flex flex-col">
                <Navigation />
                {/* <GlobalActivityMarquee /> */}
                <SetupRedirect />
                <main className="flex-1">
                  {children}
                </main>
              </div>
            </ToastProvider>
              </UnifiedNotificationProvider>
            </ExecutiveNotificationProvider>
          </IxTimeProvider>
        </AuthProvider>
      </ThemeProvider>
    </TRPCReactProvider>
  );

  return (
    <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
      <body className="min-h-screen transition-colors duration-200">
        {isClerkConfigured ? (
          <ClerkProvider
            signInUrl="https://accounts.ixwiki.com/sign-in"
            signUpUrl="https://accounts.ixwiki.com/sign-up"
            afterSignInUrl="/projects/ixstats/dashboard"
            afterSignUpUrl="/projects/ixstats/setup"
            redirectUrl="/projects/ixstats/dashboard"
          >
            <AppContent />
          </ClerkProvider>
        ) : (
          <AppContent />
        )}
        
      </body>
    </html>
  );
}

export default RootLayout;