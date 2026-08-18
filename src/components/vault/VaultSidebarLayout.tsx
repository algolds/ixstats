"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { stripBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import type { VaultSection } from "./VaultSidebarNav";
import { DashboardPlayerWidget } from "~/components/dashboard/sidebar/DashboardPlayerWidget";
import { VaultWidget } from "~/components/mycountry/shell/VaultWidget";
import { DashboardQuickLinks } from "~/components/dashboard/sidebar/DashboardQuickLinks";
import { useTheme } from "~/context/theme-context";

interface VaultSidebarLayoutProps {
  children: ReactNode;
  /** Hero section or page header rendered above the grid */
  heroSection?: ReactNode;
  /** Alerts/banners rendered above the main content */
  alerts?: ReactNode;
  /** Controlled mode: active section for sidebar nav */
  activeSection?: VaultSection;
  /** Controlled mode: callback for sidebar nav clicks (instant switching) */
  onNavigate?: (section: VaultSection) => void;
}

export function VaultSidebarLayout({
  children,
  heroSection,
  alerts,
  activeSection,
  onNavigate,
}: VaultSidebarLayoutProps) {
  const pathname = stripBasePath(usePathname());
  const { showNsImporter } = useTheme();

  const isImportActive = pathname.startsWith("/vault/import");
  const shouldShowImport = isImportActive || showNsImporter;

  const mobileNavItems = [
    { id: "dashboard", href: "/vault", label: "Wallet" },
    { id: "cards", href: "/vault/cards", label: "Collection" },
    {
      id: "marketplace",
      href: "/vault/marketplace",
      label: "Marketplace",
    },
    { id: "import", href: "/vault/import", label: "Import" },
    {
      id: "achievements",
      href: "/achievements",
      label: "Achievements",
    },
  ].filter((item) => {
    if (item.id === "import") return shouldShowImport;
    return true;
  });

  return (
    <div className="space-y-0">
      {/* Hero Section */}
      {heroSection && <div className="container mx-auto px-4 pt-4 sm:pt-6">{heroSection}</div>}

      <div className="container mx-auto px-4 py-4 sm:py-6 md:py-8">
        {/* Alerts */}
        {alerts && <div className="mb-4 space-y-3 sm:mb-6">{alerts}</div>}

        {/* Main Layout — sidebar widgets + content */}
        <div className="flex gap-4 sm:gap-6">
          {/* Desktop: Fixed sidebar widgets */}
          <div className="relative z-30 hidden shrink-0 lg:block">
            <div className="sticky top-6 space-y-4">
              <DashboardPlayerWidget />
              <VaultWidget />
              <DashboardQuickLinks />
            </div>
          </div>

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            {/* Mobile: Horizontal nav strip */}
            <div className="mb-4 lg:hidden">
              <div className="glass-hierarchy-child border-border bg-background/60 scrollbar-none overflow-x-auto rounded-xl border p-1.5 backdrop-blur-md dark:bg-black/30">
                <div className="flex min-w-max gap-1.5">
                  {mobileNavItems.map((item) => {
                    const isActive =
                      item.id === "dashboard"
                        ? pathname === "/vault" || pathname === "/vault/"
                        : item.id === "achievements"
                          ? pathname.startsWith("/achievements")
                          : item.id === "cards"
                            ? pathname.startsWith("/vault/cards") ||
                              pathname.startsWith("/vault/inventory") ||
                              pathname.startsWith("/vault/collections") ||
                              pathname.startsWith("/vault/gallery") ||
                              pathname.startsWith("/vault/lore-gallery") ||
                              pathname.startsWith("/vault/ns-library")
                            : item.id === "marketplace"
                              ? pathname.startsWith("/vault/marketplace") ||
                                pathname.startsWith("/vault/acquire") ||
                                pathname.startsWith("/vault/packs") ||
                                pathname.startsWith("/vault/create") ||
                                pathname.startsWith("/vault/trading") ||
                                pathname.startsWith("/vault/market")
                              : pathname.startsWith(`/vault/${item.id}`);

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all duration-200",
                          isActive
                            ? "border-purple-500/30 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-600 shadow-sm dark:text-purple-400"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent"
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
