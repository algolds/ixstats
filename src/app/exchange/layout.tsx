import { Suspense, type ReactNode } from "react";
import { PortalTintSync } from "~/components/providers/PortalTintSync";
import { ExchangeRouter } from "~/components/exchange/terminal/ExchangeRouter";

/**
 * The Exchange (docs/specs/2026-11-06-exchange-overhaul-design.md): its own tint scope and one router that stays
 * mounted across sidebar clicks. The pages render nothing; they only give each address a route. Public to watch.
 */
export default function ExchangeLayout({ children }: { children: ReactNode }) {
  return (
    <div data-app="exchange" className="contents">
      <PortalTintSync />
      <div className="container mx-auto max-w-7xl space-y-5 px-4 pt-(--shell-page-top) pb-6 sm:px-6 md:pb-8">
        {/* The router reads ?realm= and friends, which needs a Suspense boundary. */}
        <Suspense fallback={null}>
          <ExchangeRouter />
        </Suspense>
        {children}
      </div>
    </div>
  );
}
