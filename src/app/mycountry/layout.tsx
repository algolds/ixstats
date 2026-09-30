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
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-center text-xs font-medium text-amber-800 backdrop-blur-md dark:text-amber-300"
    >
      <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="font-semibold">Demo mode.</span> You&apos;re viewing seeded demo data;
        changes aren&apos;t saved.
      </span>
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
