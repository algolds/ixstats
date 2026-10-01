"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeSimple as Home,
  ViewGrid as Grid3x3,
  Cart as ShoppingCart,
  Download,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { stripBasePath } from "~/lib/base-path";
import { useTheme } from "~/context/theme-context";

import { CutoutCard, CutoutCardHeader } from "~/components/ui/cutout-card";
import { facetAccentStyle, type FacetAccent } from "~/lib/design/identity";

export type VaultSection =
  "dashboard" | "cards" | "marketplace" | "import" | "achievements" | "leaderboards";

/**
 * The current section's row (Facet 3.1, spec §16.8): each row carries its hue as
 * `style={facetAccentStyle(accent)}` — fill, rim and icon read `--facet-accent`, and `facet-retint`
 * re-tints the row's focus ring with the hue's AA ink.
 */
const ACTIVE_ROW =
  "bg-facet-accent-fill border-facet-accent/30 text-label shadow-card font-semibold";

export const VAULT_NAV_ITEMS: {
  id: VaultSection;
  href: string;
  icon: typeof Home;
  title: string;
  /** Active-row classes; the hue comes from `accent` (`bg-facet-accent-fill`, rim, icon). */
  activeColor: string;
  /** v2 per-section hue (Dashboard amber, Cards indigo, Marketplace blue, Import cyan). */
  accent: FacetAccent;
}[] = [
  {
    id: "dashboard",
    href: "/vault",
    icon: Home,
    title: "Dashboard",
    activeColor: ACTIVE_ROW,
    accent: "yellow",
  },
  {
    id: "cards",
    href: "/vault/cards",
    icon: Grid3x3,
    title: "Cards",
    activeColor: ACTIVE_ROW,
    accent: "indigo",
  },
  {
    id: "marketplace",
    href: "/vault/marketplace",
    icon: ShoppingCart,
    title: "Marketplace",
    activeColor: ACTIVE_ROW,
    accent: "blue",
  },
  {
    id: "import",
    href: "/vault/import",
    icon: Download,
    title: "Import",
    activeColor: ACTIVE_ROW,
    accent: "cyan",
  },
];

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

interface VaultSidebarNavProps {
  activeSection?: VaultSection;
  onNavigate?: (section: VaultSection) => void;
  /** "desktop" (default) = cutout widget, "mobile" = horizontal pill bar */
  variant?: "desktop" | "mobile";
}

export function VaultSidebarNav({
  activeSection,
  onNavigate,
  variant = "desktop",
}: VaultSidebarNavProps) {
  const pathname = usePathname();
  const activeId = activeSection ?? getSectionFromPathname(pathname);
  const isControlled = !!onNavigate;

  const { showNsImporter } = useTheme();

  const isImportActive = pathname.startsWith("/vault/import");
  const shouldShowImport = isImportActive || showNsImporter;

  const filteredNavItems = VAULT_NAV_ITEMS.filter((item) => {
    if (item.id === "import") return shouldShowImport;
    return true;
  });

  /* ── Mobile: horizontal pill bar ── */
  if (variant === "mobile") {
    return (
      <nav
        aria-label="Vault sections"
        className="bg-surface border-separator rounded-row overflow-hidden border p-1"
      >
        <div className="hide-scrollbar flex gap-1 overflow-x-auto">
          {filteredNavItems.map((item) => {
            const isActive = item.id === activeId;
            const Icon = item.icon;
            const cls = cn(
              "facet-retint focus-visible:outline-tint text-footnote facet-press facet-press-sm pointer-coarse:min-h-11 flex shrink-0 items-center gap-2 rounded-control border px-3 py-2 font-medium focus-visible:outline-2 focus-visible:-outline-offset-2",
              isActive
                ? item.activeColor
                : "text-label-secondary hover:bg-fill-3 hover:text-label border-transparent"
            );

            return isControlled ? (
              <button
                type="button"
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cls}
                style={facetAccentStyle(item.accent)}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  aria-hidden
                  className={cn("size-3.5 shrink-0", isActive && "text-facet-accent")}
                />
                <span className="whitespace-nowrap">{item.title}</span>
              </button>
            ) : (
              <Link
                key={item.id}
                href={item.href}
                className={cls}
                style={facetAccentStyle(item.accent)}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  aria-hidden
                  className={cn("size-3.5 shrink-0", isActive && "text-facet-accent")}
                />
                <span className="whitespace-nowrap">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  /* ── Desktop: v2 (c5c6b382) cutout card navigation — copper tab header, dot texture ── */
  return (
    <CutoutCard
      variant="card"
      role="navigation"
      aria-label="Vault sections"
      className="w-48"
      trackPointerHover={false}
      texture="dots"
    >
      <CutoutCardHeader icon={<Grid3x3 />} as="h2" cornerSize={16} className="px-3 pt-2 pb-4">
        Vault sections
      </CutoutCardHeader>
      <div className="space-y-1 p-2 pt-1">
        {filteredNavItems.map((item) => {
          const isActive = item.id === activeId;
          const Icon = item.icon;
          const cls = cn(
            "facet-retint focus-visible:outline-tint text-body facet-press flex w-full cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-left font-medium outline-none focus-visible:outline-2 focus-visible:-outline-offset-2",
            isActive ? item.activeColor : "text-label hover:bg-fill-4 border-transparent"
          );
          const content = (
            <>
              <Icon
                aria-hidden
                className={cn(
                  "size-4 shrink-0",
                  isActive ? "text-facet-accent" : "text-label-secondary"
                )}
              />
              <span className="truncate">{item.title}</span>
            </>
          );

          return isControlled ? (
            <button
              type="button"
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cls}
              style={facetAccentStyle(item.accent)}
              aria-current={isActive ? "page" : undefined}
            >
              {content}
            </button>
          ) : (
            <Link
              key={item.id}
              href={item.href}
              className={cls}
              style={facetAccentStyle(item.accent)}
              aria-current={isActive ? "page" : undefined}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </CutoutCard>
  );
}
