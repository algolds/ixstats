"use client";

/**
 * TabBar: the primary navigation below 1024px.
 *
 * A floating `facet-chrome` bar at the bottom (`z-chrome`, clear of the home indicator via the
 * safe-area inset) with up to four primary apps (`TAB_BAR_PRIORITY`) and "More". More opens a
 * bottom `Sheet` with detents holding the shared `SourceList` (the phone path for every app's
 * own `data-app-subnav`, plus the other apps) and the account.
 * Targets are at least 44px; the current tab and rows carry `aria-current="page"`. Content reserves
 * the bar's height through `--shell-tabbar-height` (`src/styles/facet/shell.css`).
 */

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { MoreHoriz } from "iconoir-react";

import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { springSnappy } from "~/lib/design/motion";
import { FacetMaterial } from "~/components/ui/facet";
import { SourceList } from "./SourceList";
import {
  getActiveSectionId,
  getAppForPath,
  getTintForPath,
  splitTabBarApps,
  type AppDefinition,
  type NavAction,
  type NavBadges,
  type NavIcon,
  type SearchParamsLike,
} from "~/lib/navigation/app-sections";

interface TabBarProps {
  /** Current pathname without the base path. */
  pathname: string;
  searchParams: SearchParamsLike | null;
  /** Apps this user can see (`getVisibleApps`). */
  apps: readonly AppDefinition[];
  /** Opened apps and section groups, remembered by the host. */
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  badges: NavBadges;
  onAction?: (action: NavAction) => void;
  /** The account (`AccountMenu layout="sheet"`), listed at the end of the More sheet. */
  account?: React.ReactNode;
  className?: string;
}

const tabClassName =
  "relative flex h-full min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-row px-1 text-caption transition-colors duration-fast ease-out-facet";

/** The tab focus ring, drawn just inside the tab (around the current-tab indicator). */
const tabFocusRing = cn(focusRing, "focus-visible:-outline-offset-2");

function TabIndicator() {
  return (
    <motion.span
      aria-hidden
      layoutId="tab-bar-current"
      transition={springSnappy}
      className="bg-tint-fill rounded-row absolute inset-x-1 inset-y-1"
    />
  );
}

function TabLabel({ icon: Icon, label }: { icon: NavIcon; label: string }) {
  return (
    <>
      <Icon aria-hidden className="relative size-5 shrink-0" />
      <span className="relative max-w-full truncate">{label}</span>
    </>
  );
}

export function TabBar({
  pathname,
  searchParams,
  apps,
  expanded,
  onToggle,
  badges,
  onAction,
  account,
  className,
}: TabBarProps) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const { primary } = splitTabBarApps(apps.filter((app) => app.id !== "settings"));
  const current = getAppForPath(pathname);
  const activeSectionId = current ? getActiveSectionId(current, pathname, searchParams) : undefined;
  const tint = getTintForPath(current, activeSectionId);
  const currentIsPrimary = primary.some((app) => app.id === current?.id);
  const close = () => setMoreOpen(false);

  return (
    <>
      <nav
        aria-label="Tab bar"
        data-slot="tab-bar"
        data-app={tint}
        className={cn(
          "z-chrome fixed inset-x-0 bottom-0 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden",
          className
        )}
      >
        <FacetMaterial data-slot="tab-bar-panel" className="rounded-sheet mx-auto max-w-lg">
          <ul className="relative flex h-14 items-stretch gap-1 px-1">
            {primary.map((app) => {
              const active = app.id === current?.id;
              return (
                <li key={app.id} className="flex min-w-0 flex-1">
                  <Link
                    href={app.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      tabClassName,
                      tabFocusRing,
                      active ? "text-tint font-medium" : "text-label-secondary hover:text-label"
                    )}
                  >
                    {active && <TabIndicator />}
                    <TabLabel icon={app.icon} label={app.label} />
                  </Link>
                </li>
              );
            })}
            <li className="flex min-w-0 flex-1">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen(true)}
                data-current={!currentIsPrimary && current ? "" : undefined}
                className={cn(
                  tabClassName,
                  tabFocusRing,
                  "cursor-pointer",
                  !currentIsPrimary && current
                    ? "text-tint font-medium"
                    : "text-label-secondary hover:text-label"
                )}
              >
                {!currentIsPrimary && current && <TabIndicator />}
                <TabLabel icon={MoreHoriz} label="More" />
              </button>
            </li>
          </ul>
        </FacetMaterial>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" detents={["medium", "large"]} data-app={tint}>
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
            <SheetDescription className="sr-only">
              Every app and its sections, and your account.
            </SheetDescription>
          </SheetHeader>
          <div className="-mx-2 min-h-0 flex-1 overflow-y-auto pb-2">
            <div className="px-2">
              <SourceList
                variant="sheet"
                pathname={pathname}
                searchParams={searchParams}
                apps={apps}
                expanded={expanded}
                onToggle={onToggle}
                badges={badges}
                onAction={onAction}
                onNavigate={close}
              />
            </div>
            {account && (
              // Any link in the account panel closes the sheet.
              <div
                data-slot="tab-bar-account"
                className="px-2 pt-2"
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("a")) close();
                }}
              >
                {account}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
