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
      <div className="container mx-auto px-4 py-4 sm:py-6 md:py-8">
        {/* The router reads ?realm= and friends, which needs a Suspense boundary. */}
        <Suspense fallback={null}>
          <ExchangeRouter />
        </Suspense>
        {children}
      </div>
    </div>
  );
}
