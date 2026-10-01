"use client";

// src/app/labs/vexel/layout.tsx
// Vexel Lab — Layout Wrapper

import type { ReactNode } from "react";
import { Suspense } from "react";

export default function VexelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="bg-background text-tint flex h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="border-tint h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
            <span className="text-body font-medium">Loading Vexel Heraldry...</span>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
