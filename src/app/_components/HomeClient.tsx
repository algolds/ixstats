"use client";

import { useUser } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { DashboardRouter } from "~/components/dashboard/DashboardRouter";
import { IxStatsSplashPage } from "./IxStatsSplashPage";

export function HomeClient() {
  const { isSignedIn, isLoaded } = useUser();

  usePageTitle({
    title: isSignedIn ? "Dashboard" : "Home",
  });

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="border-tint h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
          <p className="text-label-secondary text-body">Loading</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <IxStatsSplashPage />;
  }

  return <DashboardRouter />;
}
