"use client";

// src/app/labs/vexel/layout.tsx
// Vexel Lab — Layout Wrapper

import type { ReactNode } from "react";
import { Suspense } from "react";

export default function VexelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex h-screen items-center justify-center text-amber-500">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <span className="text-sm font-medium tracking-wide">Loading Vexel Heraldry...</span>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
