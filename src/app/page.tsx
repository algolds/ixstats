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
    return null;
  }

  // Show splash page for guests, dashboard for signed-in users
  if (!isSignedIn) {
    return <IxStatsSplashPage />;
  }

  return <EnhancedCommandCenter />;
}
