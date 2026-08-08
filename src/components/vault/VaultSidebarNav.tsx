"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid3x3, ShoppingCart, Download } from "lucide-react";
import { cn } from "~/lib/utils";
import { stripBasePath } from "~/lib/base-path";
import { useTheme } from "~/context/theme-context";

import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";

export type VaultSection = "dashboard" | "cards" | "marketplace" | "import" | "achievements" | "leaderboards";

export const VAULT_NAV_ITEMS: {
  id: VaultSection;
  href: string;
  icon: typeof Home;
  title: string;
  gradient: string;
  activeGlow: string;
}[] = [
  {
    id: "dashboard",
    href: "/vault",
    icon: Home,
    title: "Dashboard",
    gradient: "from-purple-500 to-pink-500",
    activeGlow: "shadow-purple-500/30",
  },
  {
    id: "cards",
    href: "/vault/cards",
    icon: Grid3x3,
    title: "Cards",
    gradient: "from-amber-500 to-yellow-500",
    activeGlow: "shadow-amber-500/30",
  },
  {
    id: "marketplace",
    href: "/vault/marketplace",
    icon: ShoppingCart,
    title: "Marketplace",
    gradient: "from-blue-500 to-cyan-500",
    activeGlow: "shadow-blue-500/30",
  },
  {
    id: "import",
    href: "/vault/import",
    icon: Download,
    title: "Import",
    gradient: "from-rose-500 to-orange-500",
    activeGlow: "shadow-rose-500/30",
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
    pathname.startsWith("/vault/ns-library")
  )
    return "gallery";
  if (pathname.startsWith("/vault/inventory") || pathname.startsWith("/vault/cards"))
    return "inventory";

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
      <nav className="glass-hierarchy-child border-border overflow-hidden rounded-xl border p-1.5 backdrop-blur-md">
        <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
          {filteredNavItems.map((item) => {
            const isActive = item.id === activeId;
            const Icon = item.icon;
            const cls = cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
              isActive
                ? cn("bg-gradient-to-r text-white shadow-md", item.gradient)
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            );

            return isControlled ? (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cls}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
              </button>
            ) : (
              <Link
                key={item.id}
                href={item.href}
                className={cls}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  /* ── Desktop: cutout card navigation ── */
  return (
    <CutoutCard
      className={cn(cutoutCardSurfaceClassName, "w-48 overflow-hidden rounded-xl")}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.06}
    >
      {/* Cutout tab header */}
      <div className="relative bg-purple-500/10 px-3 pt-2.5 pb-4">
        <div className="text-card-foreground flex items-center gap-1.5 text-xs font-bold">
          <svg
            className="h-3.5 w-3.5 animate-pulse text-purple-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
          Vault Sections
        </div>
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={16} />
      </div>
      <CutoutCardContent className="space-y-1.5 p-2.5 pt-1">
        {filteredNavItems.map((item) => {
          const isActive = item.id === activeId;
          const Icon = item.icon;

          const rowEl = (
            <div
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-200",
                isActive
                  ? cn("bg-gradient-to-r text-white shadow-md", item.gradient, item.activeGlow)
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate text-xs font-medium">{item.title}</span>
            </div>
          );

          return isControlled ? (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full rounded-lg border-none bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              aria-current={isActive ? "page" : undefined}
            >
              {rowEl}
            </button>
          ) : (
            <Link
              key={item.id}
              href={item.href}
              className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              aria-current={isActive ? "page" : undefined}
            >
              {rowEl}
            </Link>
          );
        })}
      </CutoutCardContent>
    </CutoutCard>
  );
}
