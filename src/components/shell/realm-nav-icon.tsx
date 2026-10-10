import type { SVGProps } from "react";
import type { AppDefinition, NavIcon } from "~/lib/navigation/app-sections";
import { assetUrl } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import type { NavRealm } from "./use-forum-nav-flags";

const YOUR_REALM_ID = "your-realm";

/** An image drawn where a row's icon goes: decorative, since the row's label names it, and sized by the row. */
function imageIcon(src: string): NavIcon {
  return function RealmMark({ className }: SVGProps<SVGSVGElement>) {
    return <img src={src} alt="" className={cn("rounded-sm object-cover", className)} />;
  };
}

/** One icon per image, so a row keeps the same component (and its DOM) across renders. */
const icons = new Map<string, NavIcon>();

function iconFor(src: string): NavIcon {
  let icon = icons.get(src);
  if (!icon) {
    icon = imageIcon(src);
    icons.set(src, icon);
  }
  return icon;
}

/** The realm's emblem, else its thumbnail; null when it has neither (the row keeps its realms icon). */
export function realmMarkSrc(realm: NavRealm | null): string | null {
  return assetUrl(realm?.emblemUrl) ?? assetUrl(realm?.thumbnail);
}

/** `apps` with the "Your realm" row showing `src` (from `realmMarkSrc`) as its icon; unchanged without one. */
export function withRealmMark(apps: AppDefinition[], src: string | null): AppDefinition[] {
  if (!src) return apps;
  const icon = iconFor(src);
  return apps.map((app) =>
    app.sections.some((s) => s.id === YOUR_REALM_ID)
      ? {
          ...app,
          sections: app.sections.map((s) => (s.id === YOUR_REALM_ID ? { ...s, icon } : s)),
        }
      : app
  );
}
