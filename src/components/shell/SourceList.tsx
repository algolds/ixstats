"use client";
/**
 * The app navigation tree: every app as a row, the current app contextually disclosing its
 * subordinate sections along a hairline guide, and live Facet badges on rows. Inside Admin and
 * Settings it becomes that area's grouped list (`Settings` open, `Admin` collapsible) with a way
 * back. Presentational: hosts (AppSidebar, the TabBar More sheet, the rail HoverCard) pass state,
 * badges and callbacks.
 */
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { NavArrowLeft, NavArrowRight } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { Badge } from "~/components/ui/badge";
import { focusRing } from "~/components/ui/button";
import { springSmooth, springSnappy } from "~/lib/design/motion";
import {
  getActiveSectionId,
  getVisibleAppForPath,
  groupSections,
  type AppDefinition,
  type CountryRowMeta,
  type NavAction,
  type NavBadge,
  type NavBadges,
  type SearchParamsLike,
  withCountryRows,
} from "~/lib/navigation/app-sections";
import { COUNTRY_ATTRS } from "~/lib/navigation/context-target";

/**
 * Top-level app and area icons sit in one 28px slot so labels line up; only the active top-level
 * app (or active area/inline row) wears `facet-recess` ("key held down" into `facet-chrome`).
 */
function NavMark({
  current = false,
  tint,
  children,
}: {
  current?: boolean;
  /** The app tint the mark wears (an app row); an area row inherits its app's. */
  tint?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      data-app={tint}
      data-current={current || undefined}
      className={cn(
        "text-tint rounded-control-sm relative grid size-7 shrink-0 place-items-center",
        current && "facet-recess"
      )}
    >
      {children}
    </span>
  );
}

export const sourceRowClassName =
  "relative flex min-h-(--control-height) w-full items-center gap-3 rounded-control px-2 text-body transition-colors duration-fast ease-out-facet pointer-coarse:min-h-11";

const subtabRowClassName =
  "relative flex min-h-(--control-height-sm) w-full items-center gap-2 rounded-control-sm px-2.5 text-subhead transition-colors duration-fast ease-out-facet pointer-coarse:min-h-11";

interface SourceListProps {
  pathname: string;
  searchParams: SearchParamsLike | null;
  apps: readonly AppDefinition[];
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  badges: NavBadges;
  onAction?: (action: NavAction) => void;
  /** Called after a link is followed, so a sheet or flyout host can close. */
  onNavigate?: () => void;
  variant?: "sidebar" | "sheet" | "popover";
  /** The single app whose sections a rail flyout lists. */
  app?: AppDefinition;
  /** The user's public country profile; MyCountry lists it, and the editors, once known. */
  countryHref?: string;
  /** Optional nation identity attached to `Public profile` for `SystemContextMenu`. */
  countryMeta?: CountryRowMeta;
  /** Return destination for `All apps` when inside Settings or Admin. */
  backHref?: string;
}

type Ctx = Pick<SourceListProps, "badges" | "onAction" | "onNavigate" | "expanded" | "onToggle"> & {
  variant: NonNullable<SourceListProps["variant"]>;
  /** Section ids repeat across apps, so a current section only counts inside its own app. */
  activeAppId: string | undefined;
  activeSectionId: string | undefined;
  indicatorId: string;
};

type Section = AppDefinition["sections"][number];

/** Footer apps (Admin, Settings) sit below the app list and open as an area of their own. */
const isAreaApp = (app: AppDefinition) => app.placement === "footer";

/** A badge that wants attention (an action to take, or a non-zero count). */
export const isPending = (badge: NavBadge | undefined) =>
  badge?.kind === "action" || (badge?.kind === "count" && badge.value > 0);

/** Action and conditional rows exist only while their badge does. */
export const isListed = (s: Section, badges: NavBadges) =>
  (!s.action && !s.conditional) || Boolean(s.badge && badges[s.badge]);

function Trailing({ badge }: { badge: NavBadge | undefined }) {
  if (!badge) return null;
  if (badge.kind === "count") {
    return badge.value > 0 ? <Badge variant="secondary">{badge.value}</Badge> : null;
  }
  return <span className="text-caption text-label-secondary tabular-nums">{badge.label}</span>;
}

function ActionRow({
  section,
  action,
  ctx,
  subordinate,
}: {
  section: Section;
  action: NavAction;
  ctx: Ctx;
  subordinate: boolean;
}) {
  const Icon = section.icon;
  const badge = section.badge ? ctx.badges[section.badge] : undefined;
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          ctx.onAction?.(action);
          ctx.onNavigate?.();
        }}
        className={cn(
          subordinate || ctx.variant === "popover" ? subtabRowClassName : sourceRowClassName,
          focusRing,
          "text-tint-ink hover:bg-tint-fill cursor-pointer font-medium"
        )}
      >
        {!subordinate &&
          (ctx.variant === "popover" ? (
            <Icon aria-hidden className="size-4 shrink-0 opacity-80" />
          ) : (
            <NavMark>
              <Icon aria-hidden className="size-4" />
            </NavMark>
          ))}
        <span className="min-w-0 flex-1 truncate text-left">{section.label}</span>
        <Trailing badge={badge} />
      </button>
    </li>
  );
}

function SectionRow({
  section,
  ctx,
  subordinate,
}: {
  section: Section;
  ctx: Ctx;
  subordinate: boolean;
}) {
  const Icon = section.icon;
  const badge = section.badge ? ctx.badges[section.badge] : undefined;
  const active = section.id === ctx.activeSectionId;
  const RowLink = section.external ? "a" : Link;
  const externalProps = section.external
    ? ({ target: "_blank", rel: "noopener noreferrer" } as const)
    : {};
  const countryAttrs = section.country
    ? {
        ...(section.country.id ? { [COUNTRY_ATTRS.id]: section.country.id } : {}),
        ...(section.country.slug ? { [COUNTRY_ATTRS.slug]: section.country.slug } : {}),
        ...(section.country.name ? { [COUNTRY_ATTRS.name]: section.country.name } : {}),
      }
    : undefined;

  if (subordinate) {
    return (
      <li className="relative">
        {active && (
          <span
            aria-hidden
            className="bg-tint absolute top-1.5 bottom-1.5 -left-[11px] w-0.5 rounded-full"
          />
        )}
        <RowLink
          href={section.href}
          {...externalProps}
          {...countryAttrs}
          aria-current={active ? "page" : undefined}
          onClick={ctx.onNavigate}
          className={cn(
            subtabRowClassName,
            focusRing,
            active
              ? "text-tint-ink font-medium"
              : "text-label-secondary hover:bg-fill-4 hover:text-label"
          )}
        >
          {active && (
            <motion.span
              aria-hidden
              layoutId={ctx.indicatorId}
              transition={springSnappy}
              className="bg-tint-fill rounded-control-sm absolute inset-0"
            />
          )}
          <span className="relative min-w-0 flex-1 truncate">{section.label}</span>
          <span className="relative">
            <Trailing badge={badge} />
          </span>
        </RowLink>
      </li>
    );
  }

  if (ctx.variant === "popover") {
    return (
      <li>
        <RowLink
          href={section.href}
          {...externalProps}
          {...countryAttrs}
          aria-current={active ? "page" : undefined}
          onClick={ctx.onNavigate}
          className={cn(
            subtabRowClassName,
            focusRing,
            active
              ? "text-tint-ink font-medium"
              : "text-label-secondary hover:bg-fill-4 hover:text-label"
          )}
        >
          {active && (
            <motion.span
              aria-hidden
              layoutId={ctx.indicatorId}
              transition={springSnappy}
              className="bg-tint-fill rounded-control-sm absolute inset-0"
            />
          )}
          <Icon aria-hidden className="relative size-4 shrink-0 opacity-80" />
          <span className="relative min-w-0 flex-1 truncate">{section.label}</span>
          <span className="relative">
            <Trailing badge={badge} />
          </span>
        </RowLink>
      </li>
    );
  }

  return (
    <li>
      <RowLink
        href={section.href}
        {...externalProps}
        {...countryAttrs}
        aria-current={active ? "page" : undefined}
        onClick={ctx.onNavigate}
        className={cn(
          sourceRowClassName,
          focusRing,
          active ? "text-tint font-medium" : "text-label hover:bg-fill-4"
        )}
      >
        {active && (
          <motion.span
            aria-hidden
            layoutId={ctx.indicatorId}
            transition={springSnappy}
            className="bg-tint-fill rounded-control absolute inset-0"
          />
        )}
        <NavMark current={active}>
          <Icon aria-hidden className="size-4" />
        </NavMark>
        <span className="relative min-w-0 flex-1 truncate">{section.label}</span>
        <span className="relative">
          <Trailing badge={badge} />
        </span>
      </RowLink>
    </li>
  );
}

function GroupHeading({
  id,
  group,
  collapsible,
  open,
  listId,
  onToggle,
}: {
  /** Names the surrounding group, so its label is the heading itself rather than a copy of it. */
  id: string;
  group: string;
  collapsible: boolean;
  open: boolean;
  listId: string;
  onToggle: () => void;
}) {
  if (!collapsible)
    return (
      <h3 id={id} className="text-caption text-label-secondary px-2 pt-3 pb-1">
        {group}
      </h3>
    );
  return (
    <button
      id={id}
      type="button"
      aria-expanded={open}
      aria-controls={listId}
      onClick={onToggle}
      className={cn(
        focusRing,
        "text-footnote text-label-secondary hover:bg-fill-4 rounded-control flex w-full cursor-pointer items-center gap-2 px-2 pt-3 pb-1 font-medium"
      )}
    >
      <NavArrowRight
        aria-hidden
        className={cn("duration-fast size-3.5 transition-transform", open && "rotate-90")}
      />
      {group}
    </button>
  );
}

function SectionRows({
  app,
  ctx,
  collapsibleGroups,
  id,
  flat = false,
  isArea = false,
}: {
  app: AppDefinition;
  ctx: Ctx;
  collapsibleGroups: boolean;
  id?: string;
  /** Rows sit level with the app rows instead of indented under one (`inline` apps). */
  flat?: boolean;
  /** Dedicated area view (`Settings`, `Admin`) where rows are primary destinations. */
  isArea?: boolean;
}) {
  const visible = app.sections.filter((s) => isListed(s, ctx.badges));
  const rowCtx = app.id === ctx.activeAppId ? ctx : { ...ctx, activeSectionId: undefined };
  const subordinate = !flat && !isArea && ctx.variant !== "popover";
  return (
    <div
      id={id}
      className={cn(
        "flex flex-col",
        subordinate && "border-separator mt-0.5 ml-[21px] border-l py-0.5 pl-2.5"
      )}
      data-app={app.tint}
    >
      {groupSections(visible).map(({ group, sections }, index) => {
        const groupKey = `${app.id}:${group}`;
        const containsActive = sections.some((s) => s.id === rowCtx.activeSectionId);
        const open = !collapsibleGroups || !group || containsActive || ctx.expanded.has(groupKey);
        const listId = `source-list-${ctx.indicatorId}-${groupKey}`.replace(/[^a-zA-Z0-9-]+/g, "-");
        const headingId = `${listId}-heading`;
        return (
          <div
            key={group ?? `ungrouped-${index}`}
            role={group ? "group" : undefined}
            aria-labelledby={group ? headingId : undefined}
          >
            {group && (
              <GroupHeading
                id={headingId}
                group={group}
                collapsible={collapsibleGroups && !containsActive}
                open={open}
                listId={listId}
                onToggle={() => ctx.onToggle(groupKey)}
              />
            )}
            <ul id={listId} hidden={!open} className="flex flex-col gap-0.5">
              {sections.map((section) =>
                section.action ? (
                  <ActionRow
                    key={section.id}
                    section={section}
                    action={section.action}
                    ctx={ctx}
                    subordinate={subordinate}
                  />
                ) : (
                  <SectionRow
                    key={section.id}
                    section={section}
                    ctx={rowCtx}
                    subordinate={subordinate}
                  />
                )
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function AppRow({ app, isCurrent, ctx }: { app: AppDefinition; isCurrent: boolean; ctx: Ctx }) {
  const hasSections = app.sections.length > 0;
  const open = hasSections && isCurrent;
  const listId = `source-list-${ctx.indicatorId}-${app.id}`;
  const appBadge = app.badge ? ctx.badges[app.badge] : undefined;
  const countBadge = appBadge?.kind === "count" ? appBadge : undefined;
  const pendingInside =
    isPending(appBadge) || app.sections.some((s) => s.badge && isPending(ctx.badges[s.badge]));
  const dot = !open && !countBadge && pendingInside && (
    <span role="img" aria-label="Has updates" className="bg-tint size-2 shrink-0 rounded-full" />
  );
  const Icon = app.icon;
  const appCtx: Ctx = { ...ctx, indicatorId: `${ctx.indicatorId}-${app.id}` };

  return (
    <li>
      <Link
        href={app.href}
        aria-current={isCurrent && !hasSections ? "page" : undefined}
        onClick={ctx.onNavigate}
        className={cn(
          sourceRowClassName,
          focusRing,
          "min-w-0",
          isCurrent ? "text-label font-semibold" : "text-label hover:bg-fill-4"
        )}
      >
        <NavMark current={isCurrent} tint={app.tint}>
          <Icon aria-hidden className="size-5" />
        </NavMark>
        <span className="flex-1 whitespace-nowrap">{app.label}</span>
        <Trailing badge={countBadge} />
        {dot}
      </Link>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="sections"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springSmooth}
            className="overflow-hidden"
          >
            <SectionRows id={listId} app={app} ctx={appCtx} collapsibleGroups={false} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Area apps (Settings, Admin) at the foot; inside one the list switches to its sections, so none is ever current. */
function FooterLinks({
  apps,
  onNavigate,
}: {
  apps: readonly AppDefinition[];
  onNavigate?: () => void;
}) {
  if (apps.length === 0) return null;
  return (
    <ul className="border-separator mt-2 flex flex-col gap-0.5 border-t pt-2">
      {apps.map((a) => {
        const Icon = a.icon;
        return (
          <li key={a.id}>
            <Link
              href={a.href}
              onClick={onNavigate}
              className={cn(sourceRowClassName, focusRing, "text-label hover:bg-fill-4")}
            >
              <NavMark tint={a.tint}>
                <Icon aria-hidden className="size-5" />
              </NavMark>
              <span className="min-w-0 flex-1 truncate">{a.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The current app and section. When the path belongs to an app the user has hidden (the changelog
 * with Help turned off), fall back to a visible section row with the same href so the list still
 * shows where they are; with none, nothing is highlighted.
 */
function resolveCurrent(
  pathname: string,
  searchParams: SearchParamsLike | null,
  apps: readonly AppDefinition[],
  badges: NavBadges
): { current: AppDefinition | undefined; activeSectionId: string | undefined } {
  const owner = getVisibleAppForPath(pathname, apps);
  if (!owner || apps.some((a) => a.id === owner.id)) {
    return {
      current: owner,
      activeSectionId: owner ? getActiveSectionId(owner, pathname, searchParams) : undefined,
    };
  }
  const path = pathname.split(/[?#]/)[0];
  for (const app of apps) {
    const row = app.sections.find(
      (s) => !s.action && s.href === path && (!s.conditional || (s.badge && badges[s.badge]))
    );
    if (row) return { current: app, activeSectionId: row.id };
  }
  return { current: undefined, activeSectionId: undefined };
}

export function SourceList({
  pathname,
  searchParams,
  apps: appList,
  countryHref,
  countryMeta,
  backHref = "/dashboard",
  expanded,
  onToggle,
  badges,
  onAction,
  onNavigate,
  variant = "sidebar",
  app,
}: SourceListProps) {
  const apps = withCountryRows(appList, countryHref, countryMeta);
  const { current, activeSectionId } = resolveCurrent(pathname, searchParams, apps, badges);
  const ctx: Ctx = {
    variant,
    badges,
    onAction,
    onNavigate,
    expanded,
    onToggle,
    activeAppId: current?.id,
    activeSectionId,
    indicatorId: `source-list-${variant}${app ? `-${app.id}` : ""}`,
  };

  if (variant === "popover" && app) {
    return (
      <nav aria-label={app.label} data-slot="source-list" data-mode="popover">
        <SectionRows
          app={withCountryRows([app], countryHref, countryMeta)[0]!}
          ctx={ctx}
          collapsibleGroups={false}
        />
      </nav>
    );
  }

  if (current && isAreaApp(current)) {
    return (
      <nav aria-label="App navigation" data-slot="source-list" data-mode="area">
        <Link
          href={backHref}
          onClick={onNavigate}
          className={cn(sourceRowClassName, focusRing, "text-label-secondary hover:bg-fill-4")}
        >
          <NavArrowLeft aria-hidden className="size-4 shrink-0" />
          All apps
        </Link>
        <h2 className="text-headline text-label px-2 pt-3 pb-1">{current.label}</h2>
        <SectionRows
          app={current}
          ctx={{ ...ctx, indicatorId: `${ctx.indicatorId}-${current.id}` }}
          collapsibleGroups={current.id === "admin"}
          isArea
        />
      </nav>
    );
  }

  return (
    <nav aria-label="App navigation" data-slot="source-list" data-mode="main">
      <ul className="flex flex-col gap-0.5">
        {apps
          .filter((a) => !isAreaApp(a))
          .map((a) =>
            a.inline ? (
              <li key={a.id}>
                <SectionRows
                  app={a}
                  ctx={{ ...ctx, indicatorId: `${ctx.indicatorId}-${a.id}` }}
                  collapsibleGroups={false}
                  flat
                />
              </li>
            ) : (
              <AppRow key={a.id} app={a} isCurrent={a.id === current?.id} ctx={ctx} />
            )
          )}
      </ul>
      <FooterLinks apps={apps.filter(isAreaApp)} onNavigate={onNavigate} />
    </nav>
  );
}
