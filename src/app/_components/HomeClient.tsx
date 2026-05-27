"use client";

import { useUser } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { DashboardRouter } from "~/components/dashboard/DashboardRouter";
import { IxStatsSplashPage } from "./IxStatsSplashPage";
import type { ReactNode } from "react";

interface HomeClientProps {
  /** Server-rendered Discord badge to pass into the dashboard sidebar. */
  discordBadge?: ReactNode;
}

export function HomeClient({ discordBadge }: HomeClientProps) {
  const { isSignedIn, isLoaded } = useUser();

  // Set page title based on authentication state
  usePageTitle({
    title: isSignedIn ? "Command Center" : "Home",
  });

  // Show loading state while checking auth
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Show splash page for guests, dashboard for signed-in users
  if (!isSignedIn) {
    return <IxStatsSplashPage />;
  }

  return <DashboardRouter discordBadge={discordBadge} />;
}
