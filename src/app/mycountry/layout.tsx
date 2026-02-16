"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { DevCountryViewProvider } from "~/context/DevCountryViewContext";
import { DevCountryViewToolbar, ViewingAsBanner } from "~/components/dev";

interface MyCountryLayoutProps {
  children: ReactNode;
}

export default function MyCountryLayout({ children }: MyCountryLayoutProps) {
  return (
    <Suspense fallback={null}>
      <DevCountryViewProvider>
        <ViewingAsBanner />
        {children}
        <DevCountryViewToolbar />
      </DevCountryViewProvider>
    </Suspense>
  );
}
