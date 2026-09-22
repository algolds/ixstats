"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { DevCountryViewProvider } from "~/context/DevCountryViewContext";
import { DemoModeProvider, useDemoMode } from "~/context/DemoModeContext";
import { DevCountryViewToolbar, ViewingAsBanner } from "~/components/dev";
import { WarningTriangle as AlertTriangle } from "iconoir-react";
import { MyCountryHalo } from "~/components/halo/plugins";

interface MyCountryLayoutProps {
  children: ReactNode;
}

function DemoModeBanner() {
  const { isDemoActive } = useDemoMode();
  if (!isDemoActive) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/15 px-4 py-1.5 text-xs font-semibold tracking-wide text-amber-600 backdrop-blur-md dark:text-amber-400">
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>DEMO MODE — Viewing seeded demo data. Changes are not saved.</span>
    </div>
  );
}

export default function MyCountryLayout({ children }: MyCountryLayoutProps) {
  return (
    <Suspense fallback={null}>
      <DemoModeProvider>
        <DevCountryViewProvider>
          <div className="relative flex min-h-screen flex-1 flex-col">
            <MyCountryHalo />
            <DemoModeBanner />
            <ViewingAsBanner />
            {children}
            <DevCountryViewToolbar />
          </div>
        </DevCountryViewProvider>
      </DemoModeProvider>
    </Suspense>
  );
}
