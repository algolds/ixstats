import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { withBasePath } from "~/lib/base-path";

// src/app/labs/onoma/layout.tsx
// Onoma Lab — Layout Wrapper & Favicon Metadata

export const metadata: Metadata = {
  title: "⟨ONOMA⟩ Linguistic Engine — Language, engineered.",
  description:
    "A linguistic engine for creating, modeling, and evolving language. Build the language behind your world.",
  icons: [
    { rel: "icon", url: withBasePath("/images/onoma-favicon.svg"), type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: withBasePath("/images/onoma-favicon.svg") },
  ],
};

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
