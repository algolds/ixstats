"use client";

/**
 * TabBar (Facet 3 spec §7.4): the primary navigation below 1024px when the `facet-nav` flag is on.
 *
 * A floating v2-styled acrylic bar at the bottom (Facet 3.1 spec §16.1 #9: `material-acrylic`, the
 * v2 blue / indigo / cyan glow underlay and refraction edges; `z-chrome`, clear of the home
 * indicator via the safe-area inset) with up to four primary apps (`TAB_BAR_PRIORITY`) and "More".
 * More opens a bottom `Sheet` with detents listing the current app's sections and the remaining
 * apps (`FacetList`).
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
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { springSnappy } from "~/lib/design/motion";
import { FacetMaterial } from "~/components/ui/facet";
import {
  getActiveSectionId,
  getAppForPath,
  getTintForPath,
  groupSections,
  splitTabBarApps,
  type AppDefinition,
  type NavIcon,
  type SearchParamsLike,
} from "~/lib/navigation/app-sections";

export interface TabBarProps {
  /** Current pathname without the base path. */
  pathname: string;
  searchParams: SearchParamsLike | null;
  /** Apps this user can see (`getVisibleApps`). */
  apps: readonly AppDefinition[];
  className?: string;
}

const tabClassName =
  "relative flex h-full min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-row px-1 text-caption transition-colors duration-fast ease-out-facet";

/**
 * The tab focus ring, drawn just inside the tab (around the current-tab indicator): the acrylic
 * panel clips its glow (`overflow-hidden`) and the tabs fill its height, so the shared 2px-offset
 * outline would be cut off at the top and bottom (spec §16.8: focus stays visible on acrylic).
 */
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

export function TabBar({ pathname, searchParams, apps, className }: TabBarProps) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const { primary, more } = splitTabBarApps(apps.filter((app) => app.id !== "settings"));
  const settingsApp = apps.find((app) => app.id === "settings");
  const current = getAppForPath(pathname);
  const activeSectionId = current ? getActiveSectionId(current, pathname, searchParams) : undefined;
  const tint = getTintForPath(current, activeSectionId);
  const currentIsPrimary = primary.some((app) => app.id === current?.id);
  const moreApps = settingsApp ? [...more, settingsApp] : more;
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
        <FacetMaterial
          material="acrylic"
          glow
          data-slot="tab-bar-panel"
          className="facet-acrylic-brand rounded-sheet mx-auto max-w-lg"
        >
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
              Sections of the current app and the other apps.
            </SheetDescription>
          </SheetHeader>
          <div className="-mx-2 min-h-0 flex-1 overflow-y-auto pb-2">
            <FacetList>
              {current &&
                groupSections(current.sections).map(({ group, sections }, index) => (
                  <FacetListSection
                    key={group ?? `ungrouped-${index}`}
                    header={group ? `${current.label} · ${group}` : current.label}
                  >
                    {sections.map((section) => {
                      const Icon = section.icon;
                      return (
                        <FacetRow
                          key={section.id}
                          href={section.href}
                          leading={<Icon className="size-5" />}
                          title={section.label}
                          selected={section.id === activeSectionId}
                          onClick={close}
                        />
                      );
                    })}
                  </FacetListSection>
                ))}
              {moreApps.length > 0 && (
                <FacetListSection header="Apps">
                  {moreApps.map((app) => {
                    const Icon = app.icon;
                    return (
                      <FacetRow
                        key={app.id}
                        href={app.href}
                        leading={<Icon className="size-5" />}
                        title={app.label}
                        selected={app.id === current?.id}
                        onClick={close}
                      />
                    );
                  })}
                </FacetListSection>
              )}
            </FacetList>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
