"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid3x3, Package, Hammer, Download } from "lucide-react";
import { cn } from "~/lib/utils";

export type VaultSection = "dashboard" | "cards" | "acquire" | "create" | "import";

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
    id: "acquire",
    href: "/vault/acquire",
    icon: Package,
    title: "Acquire",
    gradient: "from-blue-500 to-cyan-500",
    activeGlow: "shadow-blue-500/30",
  },
  {
    id: "create",
    href: "/vault/create",
    icon: Hammer,
    title: "Create",
    gradient: "from-emerald-500 to-teal-500",
    activeGlow: "shadow-emerald-500/30",
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
export function getSectionFromPathname(pathname: string): VaultSection {
  if (pathname === "/vault" || pathname === "/vault/") return "dashboard";

  // Cards section: /vault/cards, /vault/inventory, /vault/collections, /vault/lore-gallery
  if (
    pathname.startsWith("/vault/cards") ||
    pathname.startsWith("/vault/inventory") ||
    pathname.startsWith("/vault/collections") ||
    pathname.startsWith("/vault/lore-gallery")
  )
    return "cards";

  // Acquire section: /vault/acquire, /vault/packs, /vault/market
  if (
    pathname.startsWith("/vault/acquire") ||
    pathname.startsWith("/vault/packs") ||
    pathname.startsWith("/vault/market")
  )
    return "acquire";

  // Create section: /vault/create, /vault/crafting, /vault/trading
  if (
    pathname.startsWith("/vault/create") ||
    pathname.startsWith("/vault/crafting") ||
    pathname.startsWith("/vault/trading")
  )
    return "create";

  // Import section: /vault/import, /vault/ns-library
  if (
    pathname.startsWith("/vault/import") ||
    pathname.startsWith("/vault/ns-library")
  )
    return "import";

  return "dashboard";
}

/** Map a pathname to the sub-tab within its section */
export function getSubTabFromPathname(pathname: string): string | null {
  // Cards section sub-tabs
  if (pathname.startsWith("/vault/collections")) return "collections";
  if (pathname.startsWith("/vault/lore-gallery")) return "lore-gallery";
  if (pathname.startsWith("/vault/inventory") || pathname.startsWith("/vault/cards")) return "inventory";

  // Acquire section sub-tabs
  if (pathname.startsWith("/vault/market")) return "market";
  if (pathname.startsWith("/vault/packs") || pathname.startsWith("/vault/acquire")) return "packs";

  // Create section sub-tabs
  if (pathname.startsWith("/vault/trading")) return "trading";
  if (pathname.startsWith("/vault/crafting") || pathname.startsWith("/vault/create")) return "crafting";

  // Import section sub-tabs
  if (pathname.startsWith("/vault/ns-library")) return "ns-library";
  if (pathname.startsWith("/vault/import")) return "import-deck";

  return null;
}

interface VaultSidebarNavProps {
  activeSection?: VaultSection;
  onNavigate?: (section: VaultSection) => void;
  /** "desktop" (default) = icon rail with tooltips, "mobile" = horizontal pill bar */
  variant?: "desktop" | "mobile";
}

export function VaultSidebarNav({ activeSection, onNavigate, variant = "desktop" }: VaultSidebarNavProps) {
  const pathname = usePathname();
  const activeId = activeSection ?? getSectionFromPathname(pathname);
  const isControlled = !!onNavigate;

  /* ── Mobile: horizontal pill bar ── */
  if (variant === "mobile") {
    return (
      <nav className="glass-hierarchy-child overflow-hidden rounded-xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-md dark:bg-black/10">
        <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
          {VAULT_NAV_ITEMS.map((item) => {
            const isActive = item.id === activeId;
            const Icon = item.icon;
            const cls = cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
              isActive
                ? cn("bg-gradient-to-r text-white shadow-md", item.gradient)
                : "text-muted-foreground hover:bg-white/10 hover:text-foreground dark:hover:bg-white/5",
            );

            return isControlled ? (
              <button key={item.id} onClick={() => onNavigate(item.id)} className={cls} aria-current={isActive ? "page" : undefined}>
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
              </button>
            ) : (
              <Link key={item.id} href={item.href} className={cls} aria-current={isActive ? "page" : undefined}>
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  /* ── Desktop: icon rail with tooltip labels ── */
  return (
    <nav className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/60 p-1.5 shadow-sm backdrop-blur-lg dark:bg-white/5">
      {VAULT_NAV_ITEMS.map((item) => {
        const isActive = item.id === activeId;
        const Icon = item.icon;

        const iconEl = (
          <div
            className={cn(
              "group/tip relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200",
              isActive
                ? cn("bg-gradient-to-br text-white shadow-md", item.gradient, item.activeGlow)
                : "text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10",
            )}
          >
            <Icon className={cn("h-[18px] w-[18px] transition-transform duration-150", !isActive && "group-hover/tip:scale-110")} />

            {/* Tooltip — appears to the right */}
            <span
              className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 dark:bg-gray-100 dark:text-gray-900"
            >
              {item.title}
              <span className="absolute -left-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-100" />
            </span>
          </div>
        );

        return isControlled ? (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-lg"
            aria-label={item.title}
            aria-current={isActive ? "page" : undefined}
          >
            {iconEl}
          </button>
        ) : (
          <Link
            key={item.id}
            href={item.href}
            className="outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-lg"
            aria-label={item.title}
            aria-current={isActive ? "page" : undefined}
          >
            {iconEl}
          </Link>
        );
      })}
    </nav>
  );
}
