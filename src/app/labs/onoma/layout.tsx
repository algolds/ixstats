import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { Suspense } from "react";
import { withBasePath } from "~/lib/base-path";

// src/app/labs/onoma/layout.tsx
// Onoma Lab — Layout Wrapper & Favicon Metadata

export const metadata: Metadata = {
  title: "Onoma — Linguistic Engine",
  description:
    "A linguistic engine for creating, modeling, and evolving language. Build the language behind your world.",
  icons: [
    { rel: "icon", url: withBasePath("/images/onoma-favicon.svg"), type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: withBasePath("/images/onoma-favicon.svg") },
  ],
};

/**
 * Onoma's own accent (Facet 3.1, spec §16.0 — v2 brand): the electric azure #0091FF as a scoped
 * tint, so `text-tint`, `bg-tint-fill`, focus, selection and the glass hero wash/border read as
 * Onoma inside the lab. It reuses the tint slots the `[data-app]` scopes resolve (facet/tokens.css):
 * dark is the brand azure (6.5:1 on black) with the azure-300 step; light steps down to the Onoma
 * light primaries (#0066b8, 5.8:1 on white) so tinted text stays AA. Portalled dialogs and menus keep
 * the Labs (maps) tint via PortalTintSync.
 */
const ONOMA_TINT = {
  "--tint-light": "#0066b8",
  "--tint-light-strong": "#005599",
  "--on-tint-light": "#ffffff",
  "--tint-dark": "#0091ff",
  "--tint-dark-strong": "#33a7ff",
  "--on-tint-dark": "#0b0c0f",
} as CSSProperties;

export default function OnomaLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="bg-background text-tint flex h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="border-tint h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
            <span className="text-body font-medium">Loading Onoma Lab...</span>
          </div>
        </div>
      }
    >
      <div data-app="maps" className="contents" style={ONOMA_TINT}>
        {children}
      </div>
    </Suspense>
  );
}
