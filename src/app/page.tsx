"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { EnhancedCommandCenter } from "./_components/EnhancedCommandCenter";
import { IxStatsSplashPage } from "./_components/IxStatsSplashPage";

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    document.title = isSignedIn ? "Command Center - IxStats" : "IxStats - Economic Simulation Platform";
  }, [isSignedIn]);

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