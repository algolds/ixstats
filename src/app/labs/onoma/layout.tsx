"use client";

// src/app/labs/onoma/layout.tsx
// Onoma Lab — Layout Wrapper

import type { ReactNode } from "react";
import { Suspense } from "react";

export default function OnomaLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex h-screen items-center justify-center text-[#0091ff]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0091ff] border-t-transparent" />
            <span className="text-sm font-medium tracking-wide">Loading Onoma Lab...</span>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
