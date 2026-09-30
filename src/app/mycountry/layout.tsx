"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { DevCountryViewProvider } from "~/context/DevCountryViewContext";
import { DemoModeProvider, useDemoMode } from "~/context/DemoModeContext";
import { DevCountryViewToolbar, ViewingAsBanner } from "~/components/dev";
import { WarningTriangle as AlertTriangle } from "iconoir-react";
import { MyCountryHalo } from "~/components/halo/plugins";
import { PortalTintSync } from "~/components/providers/PortalTintSync";

interface MyCountryLayoutProps {
  children: ReactNode;
}

function DemoModeBanner() {
  const { isDemoActive } = useDemoMode();
  if (!isDemoActive) return null;

  return (
    // Opaque status bar (no blur); it sits above the depth-2 Facet cards (z 100) as they scroll.
    <div
      role="status"
      className="border-border bg-card text-foreground sticky top-0 z-(--z-depth-overlay) flex items-center justify-center gap-2 border-b px-4 py-2 text-center text-xs font-medium"
    >
      <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0 text-orange-600" />
      <span>
        <span className="font-semibold">Demo mode.</span>{" "}
        <span className="text-muted-foreground">
          You&apos;re viewing seeded demo data; changes aren&apos;t saved.
        </span>
      </span>
    </div>
  );
}

export default function MyCountryLayout({ children }: MyCountryLayoutProps) {
  return (
    <Suspense fallback={null}>
      <DemoModeProvider>
        <DevCountryViewProvider>
          <div data-app="mycountry" className="relative flex min-h-screen flex-1 flex-col">
            <PortalTintSync />
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
