"use client";

import { useUser } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { EnhancedCommandCenter } from "./_components/EnhancedCommandCenter";
import { IxStatsSplashPage } from "./_components/IxStatsSplashPage";

export default function Home() {
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show splash page for guests, dashboard for signed-in users
  if (!isSignedIn) {
    return <IxStatsSplashPage />;
  }

  return <EnhancedCommandCenter />;
}
