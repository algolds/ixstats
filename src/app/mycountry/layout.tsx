"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { DevCountryViewProvider } from "~/context/DevCountryViewContext";
import { DemoModeProvider, useDemoMode } from "~/context/DemoModeContext";
import { DevCountryViewToolbar, ViewingAsBanner } from "~/components/dev";
import { AlertTriangle } from "lucide-react";

interface MyCountryLayoutProps {
  children: ReactNode;
}

function DemoModeBanner() {
  const { isDemoActive } = useDemoMode();
  if (!isDemoActive) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-md">
      <AlertTriangle className="h-4 w-4" />
      <span>DEMO MODE — Viewing seeded demo data. Changes are not saved.</span>
    </div>
  );
}

export default function MyCountryLayout({ children }: MyCountryLayoutProps) {
  return (
    <Suspense fallback={null}>
      <DemoModeProvider>
        <DevCountryViewProvider>
          <DemoModeBanner />
          <ViewingAsBanner />
          {children}
          <DevCountryViewToolbar />
        </DevCountryViewProvider>
      </DemoModeProvider>
    </Suspense>
  );
}
