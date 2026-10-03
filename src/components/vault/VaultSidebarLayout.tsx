"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { stripBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
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
}

export function VaultSidebarLayout({ children, heroSection, alerts }: VaultSidebarLayoutProps) {
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
          <div className="z-raised relative hidden shrink-0 lg:block">
            <div className="sticky top-(--shell-top-offset) space-y-4">
              <DashboardPlayerWidget />
              <VaultWidget />
              <DashboardQuickLinks />
            </div>
          </div>

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            {/* Mobile: Horizontal nav strip (hidden under the new shell: the TabBar lists it) */}
            <div data-app-subnav="" className="mb-4 lg:hidden">
              <div className="bg-surface border-separator rounded-row scrollbar-none overflow-x-auto border p-1">
                <div className="flex min-w-max gap-1">
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
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "text-footnote focus-visible:outline-tint rounded-control duration-fast px-3 py-2 font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
                          isActive
                            ? "bg-tint-fill text-tint"
                            : "text-label-secondary hover:text-label hover:bg-fill-3"
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
