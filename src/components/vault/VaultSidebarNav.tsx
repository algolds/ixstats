import { stripBasePath } from "~/lib/base-path";
export type VaultSection =
  "dashboard" | "cards" | "marketplace" | "import" | "achievements" | "leaderboards";

/** Map any vault pathname to its parent section + optional sub-tab */
export function getSectionFromPathname(rawPathname: string): VaultSection {
  const pathname = stripBasePath(rawPathname);
  if (pathname === "/vault" || pathname === "/vault/") return "dashboard";

  // Cards section: /vault/cards, /vault/inventory, /vault/collections, /vault/gallery, /vault/lore-gallery, /vault/ns-library
  if (
    pathname.startsWith("/vault/cards") ||
    pathname.startsWith("/vault/inventory") ||
    pathname.startsWith("/vault/collections") ||
    pathname.startsWith("/vault/gallery") ||
    pathname.startsWith("/vault/lore-gallery") ||
    pathname.startsWith("/vault/ns-library")
  )
    return "cards";

  // Marketplace section: /vault/marketplace, /vault/acquire, /vault/create, /vault/packs, /vault/trading, /vault/market
  if (
    pathname.startsWith("/vault/marketplace") ||
    pathname.startsWith("/vault/acquire") ||
    pathname.startsWith("/vault/packs") ||
    pathname.startsWith("/vault/create") ||
    pathname.startsWith("/vault/trading") ||
    pathname.startsWith("/vault/market")
  )
    return "marketplace";

  // Import section: /vault/import
  if (pathname.startsWith("/vault/import")) return "import";

  // Achievements section: /achievements
  if (pathname.startsWith("/achievements")) return "achievements";

  // Leaderboards section: /leaderboards
  if (pathname.startsWith("/leaderboards")) return "leaderboards";

  return "dashboard";
}

/** Map a pathname to the sub-tab within its section */
export function getSubTabFromPathname(rawPathname: string): string | null {
  const pathname = stripBasePath(rawPathname);
  // Cards section sub-tabs
  if (pathname.startsWith("/vault/collections")) return "collections";
  if (
    pathname.startsWith("/vault/gallery") ||
    pathname.startsWith("/vault/lore-gallery") ||
    pathname.startsWith("/vault/ns-library") ||
    pathname.startsWith("/vault/cards")
  )
    return "gallery";
  if (pathname.startsWith("/vault/inventory")) return "inventory";

  // Marketplace section sub-tabs
  if (pathname.startsWith("/vault/packs") || pathname.startsWith("/vault/acquire")) return "store";
  if (pathname.startsWith("/vault/market")) return "auctions";
  if (
    pathname.startsWith("/vault/trading") ||
    pathname.startsWith("/vault/create") ||
    pathname.startsWith("/vault/marketplace")
  )
    return "trading";

  // Import section sub-tabs
  if (pathname.startsWith("/vault/import")) return "import-deck";

  return null;
}
