import type { CSSProperties, ReactNode } from "react";
import { withBasePath } from "~/lib/base-path";

const MONOGRAM_APPS = ["wiki", "mycountry", "maps", "realms"] as const;

/**
 * The whole monogram (every app's layer in one mask, unioned) as an even texture in the card's own
 * tint: a smaller tile and about half the hero's strength, so it reads as grain, not a pattern.
 */
const MONOGRAM_TEXTURE = {
  "--monogram-strength": "6%",
  maskImage: MONOGRAM_APPS.map(
    (app) => `url("${withBasePath(`/images/ix-monogram-${app}.svg`)}")`
  ).join(", "),
  maskSize: "210px 105px",
  maskRepeat: "repeat",
} as CSSProperties;

/**
 * Lays the monogram texture exactly under one Lens card, so its rim has something to bend (over the
 * flat canvas a lens shows no refraction). It stays inside the card's box: a mark peeking past the
 * edge reads as a stray, not as glass. `app` scopes the texture and the card to that app's tint;
 * without it they take the page's. When the card renders nothing the backdrop hides too, so a stack
 * keeps no empty gap; inside an overlay (where a Lens never sits) the texture is off.
 */
export function MonogramBackdrop({
  app,
  children,
}: {
  app?: "mycountry" | "wiki";
  children: ReactNode;
}) {
  return (
    <div data-app={app} className="relative has-[>:only-child]:hidden">
      <div
        aria-hidden
        className="facet-monogram rounded-card pointer-events-none absolute inset-0 in-[[role=dialog]]:hidden print:hidden"
        style={MONOGRAM_TEXTURE}
      />
      {children}
    </div>
  );
}
