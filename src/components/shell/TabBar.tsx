"use client";

/**
 * TabBar: the primary navigation below 1024px.
 *
 * A floating `facet-chrome` bar at the bottom (`z-chrome`, clear of the home indicator via the
 * safe-area inset) with up to four primary apps (`TAB_BAR_PRIORITY`) and "More". More opens a
 * bottom `Sheet` with detents holding the shared `SourceList` (the current app's sections, the
 * other apps and the account).
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
import { SourceList, isPending } from "./SourceList";
import {
  getVisibleAppForPath,
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
  countryHref?: string;
  backHref?: string;
  /** The account (`AccountMenu layout="sheet"`), listed at the end of the More sheet. */
  account?: React.ReactNode;
  className?: string;
}

const tabClassName =
  "relative flex h-full min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-row px-1 text-caption transition-colors duration-fast ease-out-facet";

/** The tab focus ring, drawn just inside the tab (around the current-tab indicator). */
const tabFocusRing = cn(focusRing, "focus-visible:-outline-offset-2");

function appBadgeState(app: AppDefinition, badges: NavBadges): { count: number; showDot: boolean } {
  const own = app.badge ? badges[app.badge] : undefined;
  let count = own?.kind === "count" ? own.value : 0;
  for (const section of app.sections) {
    const b = section.badge ? badges[section.badge] : undefined;
    if (b?.kind === "count") count += b.value;
  }
  const hasAnyPending =
    isPending(own) ||
    app.sections.some((section) => section.badge && isPending(badges[section.badge]));
  return { count, showDot: count === 0 && hasAnyPending };
}

function TabIndicator() {
  return (
    <motion.span
      aria-hidden
      layoutId="tab-bar-current"
      transition={springSnappy}
      className="facet-recess rounded-row absolute inset-x-1 inset-y-1"
    />
  );
}

function TabLabel({
  icon: Icon,
  label,
  count = 0,
  showDot = false,
}: {
  icon: NavIcon;
  label: string;
  count?: number;
  showDot?: boolean;
}) {
  return (
    <>
      <span className="relative inline-flex shrink-0 items-center justify-center">
        <Icon aria-hidden className="size-5" />
        {count > 0 ? (
          <span
            aria-hidden
            data-slot="tab-bar-badge"
            className="bg-tint text-caption ring-background text-on-tint absolute -top-1 -right-2.5 min-w-4 rounded-full px-1 text-center leading-4 font-medium tabular-nums ring-2"
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : (
          showDot && (
            <span
              aria-hidden="true"
              data-slot="tab-bar-dot"
              className="bg-tint ring-background absolute -top-0.5 -right-1 size-2 rounded-full ring-2"
            />
          )
        )}
      </span>
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
  countryHref,
  backHref,
  account,
  className,
}: TabBarProps) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const { primary, more } = splitTabBarApps(apps.filter((app) => app.id !== "settings"));
  const current = getVisibleAppForPath(pathname, apps);
  const tint = current?.tint;
  const currentIsPrimary = primary.some((app) => app.id === current?.id);
  const moreHasPending = more.some((app) => {
    const state = appBadgeState(app, badges);
    return state.count > 0 || state.showDot;
  });
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
              const { count, showDot } = appBadgeState(app, badges);
              return (
                <li key={app.id} data-app={app.tint} className="flex min-w-0 flex-1">
                  <Link
                    href={app.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={count > 0 ? `${app.label}, ${count} unread` : app.label}
                    className={cn(
                      tabClassName,
                      tabFocusRing,
                      active ? "text-tint font-medium" : "text-label-secondary hover:text-label"
                    )}
                  >
                    {active && <TabIndicator />}
                    <TabLabel icon={app.icon} label={app.label} count={count} showDot={showDot} />
                  </Link>
                </li>
              );
            })}
            <li className="flex min-w-0 flex-1">
              <button
                type="button"
                aria-label={moreHasPending ? "More, updates available" : "More"}
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
                <TabLabel icon={MoreHoriz} label="More" showDot={moreHasPending} />
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
                countryHref={countryHref}
                backHref={backHref}
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
