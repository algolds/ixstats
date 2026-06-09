// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/components/wikios/shared/WikiOSLayout.tsx
// WikiOS content wrapper with standard DashboardSidebarLayout.

"use client";

import { type ReactNode, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useWikiOSShortcuts } from "~/components/wikios/shared/useWikiOSShortcuts";
import { useWikiContext } from "~/components/wikios/shared/WikiContext";
import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";
import { WIKIOS_VERSION } from "~/lib/buildVersion";
import { stripBasePath } from "~/lib/base-path";
import { DashboardSidebarLayout, useSidebar } from "~/components/dashboard/DashboardSidebarLayout";
import { ServerDiscordBadge } from "~/components/dashboard/ServerDiscordBadge";
import { StatusIndicator } from "~/components/status-indicator";
import { DashboardPlayerWidget } from "~/components/dashboard/DashboardPlayerWidget";
import { VaultWidget } from "~/components/mycountry/VaultWidget";
import { DashboardQuickLinks } from "~/components/dashboard/DashboardQuickLinks";
import { cn } from "~/lib/utils";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
} from "~/components/ui/popover";

// Sibling component imports
import { SearchModal } from "./SearchModal";
import { WikiOSUnifiedSidebar } from "./WikiOSUnifiedSidebar";
import { WikiOSContentWrapper } from "./WikiOSContentWrapper";

function MergedSidebarContent({
  activeId,
  onSearchClick,
  activeTitle,
  slug,
  isSignedIn,
  setActiveModal,
  countryData,
  isSpecialPage,
  pathname,
  discordBadge,
}: {
  activeId: string | null;
  onSearchClick: () => void;
  activeTitle: string;
  slug: string | null;
  isSignedIn: boolean;
  setActiveModal: (modal: "history" | "backlinks" | null) => void;
  countryData: any;
  isSpecialPage: boolean;
  pathname: string;
  discordBadge?: ReactNode;
}) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex h-full items-stretch">
      {/* Standard sidebar widgets (collapsible) */}
      <div
        className={cn(
          "flex flex-col gap-3 transition-all duration-300 ease-in-out",
          isCollapsed ? "w-0 opacity-0 pointer-events-none overflow-hidden" : "w-48 opacity-100"
        )}
      >
        <DashboardPlayerWidget />
        <VaultWidget />
        <DashboardQuickLinks discordBadge={discordBadge} />
      </div>

      {/* Vertical divider line */}
      {!isCollapsed && <div className="mx-1.5 w-px bg-white/5" />}

      {/* Wiki Icon Rail (permanently in icon-only mode) */}
      <div className="w-14 shrink-0">
        <WikiOSUnifiedSidebar
          activeId={activeId}
          onSearchClick={onSearchClick}
          title={activeTitle}
          slug={slug}
          isSignedIn={isSignedIn}
          setActiveModal={setActiveModal}
          countryData={countryData}
          isSpecialPage={isSpecialPage}
          pathname={pathname}
          forceCollapsed={true}
        />
      </div>
    </div>
  );
}

export function WikiOSLayout({
  title,
  sidebarVariant = "wiki",
  children,
}: {
  title?: string;
  sidebarVariant?: "wiki" | "dashboard";
  children: ReactNode;
}) {
  useWikiOSShortcuts();
  const { articleTitle, setActiveModal } = useWikiContext();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  // Global Cmd+K to open search
  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const activeTitle = title || articleTitle || "";
  const slug = activeTitle ? encodeURIComponent(activeTitle.replace(/ /g, "_")) : null;

  const isMainPage =
    activeTitle === "Main Page" ||
    activeTitle === "Main_Page" ||
    stripBasePath(pathname) === "/w/Main_Page" ||
    stripBasePath(pathname) === "/w/Main_Page/";

  // Active Country Context Query
  const { data: countryData } = api.countries.getByIdBasic.useQuery(
    { id: activeTitle },
    {
      enabled:
        !!activeTitle &&
        activeTitle.trim() !== "" &&
        !isMainPage &&
        !activeTitle.includes(":") &&
        !["Stashes", "Blurbs", "Repository", "Lorewards", "Wiki & Lore", "Recent Changes", "Search", "Random"].includes(activeTitle),
      retry: false,
    }
  );

  const { isSignedIn } = useAuth();

  const getActiveId = () => {
    const p = stripBasePath(pathname);
    if (p.includes("/talk")) return "talk";
    if (p.includes("/edit")) return "edit";
    if (p.includes("/w/special/recent")) return "recent";
    if (p.includes("/w/special/lorewards")) return "lorewards";
    if (p.includes("/blurbs")) return "blurbs";
    if (p.includes("/stashes")) return "stashes";
    if (p.includes("/w/repository")) return "images";
    if (p.includes("/w/special/watchlist")) return "stashes";
    if (p.includes("/w/special/random")) return "random";
    if (p.includes("/w/special/search")) return "search";
    if (p.includes("/w/special/history")) return "history";
    if (p === "/w/Main_Page") return "main";
    return null;
  };

  const activeId = getActiveId();

  const isSpecialPage =
    pathname.includes("/w/special/") || pathname.includes("/blurbs") || isMainPage;

  const useComboSidebar =
    sidebarVariant === "dashboard" ||
    (isSpecialPage && !isMainPage) ||
    pathname.includes("/w/repository") ||
    pathname.includes("/stashes");

  const discordBadge = useComboSidebar ? <ServerDiscordBadge /> : undefined;

  const sidebarContent = !useComboSidebar ? (
    <WikiOSUnifiedSidebar
      activeId={activeId}
      onSearchClick={() => setSearchOpen(true)}
      title={activeTitle}
      slug={slug}
      isSignedIn={isSignedIn}
      setActiveModal={setActiveModal}
      countryData={countryData}
      isSpecialPage={isSpecialPage}
      pathname={pathname}
    />
  ) : (
    <MergedSidebarContent
      activeId={activeId}
      onSearchClick={() => setSearchOpen(true)}
      activeTitle={activeTitle}
      slug={slug}
      isSignedIn={isSignedIn}
      setActiveModal={setActiveModal}
      countryData={countryData}
      isSpecialPage={isSpecialPage}
      pathname={pathname}
      discordBadge={discordBadge}
    />
  );

  return (
    <div className="wikios-shell wikios-root">
      <DashboardSidebarLayout
        sidebarContent={sidebarContent}
        showFloatingExpand={false}
        defaultCollapsed={true}
        disableCollapse={false}
        variant="rail"
        expandedWidthClassName={useComboSidebar ? "w-64" : "w-48"}
        expandedWidthStyle={useComboSidebar ? "16rem" : "12rem"}
      >
        <WikiOSContentWrapper title={title}>{children}</WikiOSContentWrapper>
      </DashboardSidebarLayout>

      <footer className="wikios-main-footer text-muted-foreground/40 mt-16 flex flex-col items-center justify-center gap-3 border-t border-white/5 pt-6 pb-8 text-center text-xs">
        <div className="flex items-center justify-center gap-1.5">
          <span>Powered by</span>
          <Popover>
            <PopoverTrigger className="cursor-pointer font-bold text-[var(--wikios-text)] underline decoration-dotted transition-colors select-none hover:text-blue-400">
              WikiOS
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 text-left">
              <PopoverTitle className="mb-1 text-sm font-bold text-[var(--wikios-text)]">
                About WikiOS
              </PopoverTitle>
              <PopoverDescription className="text-xs leading-relaxed text-[var(--wikios-text-muted)]">
                WikiOS is the next-generation wiki platform. It features a beautiful design,
                improved performance, modern editing tools, and more.
              </PopoverDescription>
            </PopoverContent>
          </Popover>
          <span>v{WIKIOS_VERSION}</span>
        </div>
        <StatusIndicator
          status="operational"
          label="WikiOS Online"
          size="sm"
          className="border-white/5 bg-transparent"
        />
      </footer>

      {/* Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
