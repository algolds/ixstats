import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { withBasePath } from "~/lib/base-path";
import { ONOMA_TINT } from "./onoma-tint";
import { OnomaPortalTint } from "./components/shared/OnomaPortalTint";

// src/app/labs/onoma/layout.tsx
// Onoma Lab: layout wrapper and favicon metadata

export const metadata: Metadata = {
  title: "Onoma · Linguistic engine",
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
        <div
          className="mx-auto max-w-7xl space-y-5 px-4 py-4 sm:px-6 sm:py-6"
          aria-busy="true"
          aria-label="Loading Onoma"
        >
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-9 w-96 max-w-full" />
          <Skeleton className="rounded-card h-[480px] w-full" />
        </div>
      }
    >
      {/* Onoma azure as a scoped tint (onoma-tint.ts); OnomaPortalTint carries it to portals. */}
      <div data-app="labs" className="contents" style={ONOMA_TINT}>
        <OnomaPortalTint />
        {children}
      </div>
    </Suspense>
  );
}
