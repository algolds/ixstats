// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/components/wiki-os/shared/WikiOSLayout.tsx
// WikiOS content wrapper with standard DashboardSidebarLayout.

"use client";

import { type ReactNode, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useWikiOSShortcuts } from "~/components/wiki-os/shared/useWikiOSShortcuts";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";
import { WIKIOS_VERSION } from "~/lib/buildVersion";
import { stripBasePath } from "~/lib/base-path";
import { DashboardSidebarLayout } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import { StatusIndicator } from "~/components/status-indicator";
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

import type { TocEntry } from "~/lib/wiki-os/html-transformer";

export function WikiOSLayout({
  title,
  sidebarVariant = "wiki",
  hideTitleHeading = false,
  sections,
  children,
}: {
  title?: string;
  sidebarVariant?: "wiki" | "dashboard";
  hideTitleHeading?: boolean;
  sections?: TocEntry[];
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
    stripBasePath(pathname) === "/wiki/Main_Page" ||
    stripBasePath(pathname) === "/wiki/Main_Page/";

  // Active Country Context Query
  const { data: countryData } = api.countries.getByIdBasic.useQuery(
    { id: activeTitle },
    {
      enabled:
        !!activeTitle &&
        activeTitle.trim() !== "" &&
        !isMainPage &&
        !activeTitle.includes(":") &&
        ![
          "Stashes",
          "Blurbs",
          "Repository",
          "Lorewards",
          "Wiki & Lore",
          "Recent Changes",
          "Search",
          "Random",
        ].includes(activeTitle),
      retry: false,
    }
  );

  const { isSignedIn } = useAuth();

  const getActiveId = () => {
    const p = stripBasePath(pathname);
    if (p.includes("/talk")) return "talk";
    if (p.includes("/edit")) return "edit";
    if (p.includes("/wiki/recent")) return "recent";
    if (p.includes("/wiki/lorewards")) return "lorewards";
    if (p.includes("/blurbs")) return "blurbs";
    if (p.includes("/stashes")) return "stashes";
    if (p.includes("/wiki/repository")) return "images";
    if (p.includes("/wiki/watchlist")) return "stashes";
    if (p.includes("/wiki/random")) return "random";
    if (p.includes("/wiki/search")) return "search";
    if (p.includes("/wiki/history")) return "history";
    if (p === "/wiki/Main_Page") return "main";
    return null;
  };

  const activeId = getActiveId();

  const isSpecialPage =
    pathname.includes("/wiki/") || pathname.includes("/blurbs") || isMainPage;

  const sidebarContent = (
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
      sections={sections}
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
        expandedWidthClassName="w-48"
        expandedWidthStyle="12rem"
      >
        <WikiOSContentWrapper title={hideTitleHeading ? undefined : title}>
          {children}
        </WikiOSContentWrapper>
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
