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

import { Card } from "~/components/ui/card";

export type VaultSection =
  "dashboard" | "cards" | "marketplace" | "import" | "achievements" | "leaderboards";

const ACTIVE_ROW = "bg-tint-fill border-separator text-label font-semibold";

export const VAULT_NAV_ITEMS: {
  id: VaultSection;
  href: string;
  icon: typeof Home;
  title: string;
}[] = [
  { id: "dashboard", href: "/vault", icon: Home, title: "Dashboard" },
  { id: "cards", href: "/vault/cards", icon: Grid3x3, title: "Cards" },
  { id: "marketplace", href: "/vault/marketplace", icon: ShoppingCart, title: "Marketplace" },
  { id: "import", href: "/vault/import", icon: Download, title: "Import" },
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
  /** "desktop" (default) = card, "mobile" = horizontal pill bar */
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
              "focus-visible:outline-tint text-footnote pointer-coarse:min-h-11 flex shrink-0 items-center gap-2 rounded-control border px-3 py-2 font-medium focus-visible:outline-2 focus-visible:-outline-offset-2",
              isActive
                ? ACTIVE_ROW
                : "text-label-secondary hover:bg-fill-3 hover:text-label border-transparent"
            );

            return isControlled ? (
              <button
                type="button"
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cls}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon aria-hidden className={cn("size-3.5 shrink-0", isActive && "text-tint")} />
                <span className="whitespace-nowrap">{item.title}</span>
              </button>
            ) : (
              <Link
                key={item.id}
                href={item.href}
                className={cls}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon aria-hidden className={cn("size-3.5 shrink-0", isActive && "text-tint")} />
                <span className="whitespace-nowrap">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  /* ── Desktop: card navigation ── */
  return (
    <Card role="navigation" aria-label="Vault sections" className="w-48">
      <h2 className="text-eyebrow text-label-secondary px-4 pt-3 pb-1">Vault sections</h2>
      <div className="space-y-1 p-2 pt-1">
        {filteredNavItems.map((item) => {
          const isActive = item.id === activeId;
          const Icon = item.icon;
          const cls = cn(
            "focus-visible:outline-tint text-body flex w-full cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-left font-medium outline-none focus-visible:outline-2 focus-visible:-outline-offset-2",
            isActive ? ACTIVE_ROW : "text-label hover:bg-fill-4 border-transparent"
          );
          const content = (
            <>
              <Icon
                aria-hidden
                className={cn("size-4 shrink-0", isActive ? "text-tint" : "text-label-secondary")}
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
              aria-current={isActive ? "page" : undefined}
            >
              {content}
            </button>
          ) : (
            <Link
              key={item.id}
              href={item.href}
              className={cls}
              aria-current={isActive ? "page" : undefined}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
