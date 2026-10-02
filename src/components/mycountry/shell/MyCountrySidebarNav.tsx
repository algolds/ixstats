"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  Crown,
  Crown as CrownIcon,
  Group as Users,
  CheckSquare as Vote,
  Lock,
  EditPencil as Edit2,
  StatUp as TrendingUp,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tooltip } from "~/components/ui/tooltip";
import { usePremium } from "~/hooks/usePremium";
import { stripBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";

/** Renders the standard Iconoir icon for a section */
function NavIcon({
  fallback: Fallback,
  className,
}: {
  id?: string;
  fallback: React.ComponentType<{ className?: string }>;
  className?: string;
  size?: number;
}) {
  return <Fallback className={cn("h-4 w-4", className)} />;
}

const PREMIUM_GATED_SECTIONS: Set<MyCountrySection> = new Set(["intelligence", "defense"]);

export type MyCountrySection =
  | "overview"
  | "executive"
  | "economy"
  | "diplomacy"
  | "intelligence"
  | "defense"
  | "politics"
  | "map-editor";

export const NAV_ITEMS: {
  id: MyCountrySection;
  href: string;
  icon: typeof Crown;
  title: string;
}[] = [
  {
    id: "economy",
    href: "/mycountry/economy",
    icon: TrendingUp,
    title: "Economy",
  },
  {
    id: "diplomacy",
    href: "/mycountry/diplomacy",
    icon: Users,
    title: "Diplomacy",
  },
  {
    id: "defense",
    href: "/mycountry/defense",
    icon: Shield,
    title: "Defense",
  },
  {
    id: "politics",
    href: "/mycountry/politics",
    icon: Vote,
    title: "Politics",
  },
];

export function getSectionFromPathname(rawPathname: string): MyCountrySection {
  const pathname = stripBasePath(rawPathname);
  if (pathname === "/mycountry" || pathname === "/mycountry/") return "overview";
  if (pathname.startsWith("/mycountry/map-editor")) return "map-editor";
  if (pathname.startsWith("/mycountry/executive")) return "executive";
  if (pathname.startsWith("/mycountry/economy")) return "economy";
  if (pathname.startsWith("/mycountry/intelligence")) return "defense";
  for (const item of NAV_ITEMS) {
    if (item.id !== "overview" && pathname.startsWith(item.href)) return item.id;
  }
  return "overview";
}

interface MyCountrySidebarNavProps {
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  /** "desktop" (default) = icon rail with tooltips, "expanded" = icon + label, "mobile" = horizontal pill bar */
  variant?: "desktop" | "expanded" | "mobile";
  /** Notification counts per section — renders indicator dots when > 0 */
  notifications?: Partial<Record<string, number>>;
}

/** The small MyCountry-accent "Premium" chip. */
function PremiumBadge() {
  return (
    <Badge variant="tinted" className="px-2 py-0">
      Premium
    </Badge>
  );
}

/**
 * MyCountry section navigation on Facet primitives: a depth-1 shell holding ghost `<Button>`
 * items. The current section is a quiet `bg-fill-3` fill; colour is kept for status only
 * (the gold notification dot and Premium chip).
 */
export function MyCountrySidebarNav({
  activeSection,
  onNavigate,
  variant = "desktop",
  notifications,
}: MyCountrySidebarNavProps) {
  const pathname = usePathname();
  const activeId = activeSection ?? getSectionFromPathname(pathname);
  const isControlled = !!onNavigate;
  const { isPremium } = usePremium();

  // Fetch section visibility settings — hide intelligence/defense when disabled
  const { data: navSettings } = api.admin.getNavigationSettings.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  // Intelligence/Defense are premium sections. Premium members always see them
  // (unlocked). For everyone else they are hidden unless an admin has explicitly
  // enabled the corresponding nav toggle (in which case they show as a locked teaser).
  const HIDDEN_SECTIONS = new Set<MyCountrySection>();
  if (navSettings && !navSettings.showIntelligenceTab && !isPremium)
    HIDDEN_SECTIONS.add("intelligence");
  if (navSettings && !navSettings.showDefenseTab && !isPremium) HIDDEN_SECTIONS.add("defense");

  const visibleItems = NAV_ITEMS.filter((item) => !HIDDEN_SECTIONS.has(item.id));

  /** A nav destination: a Button that navigates in place when controlled, else a Link. */
  const renderItem = (
    id: MyCountrySection,
    href: string,
    className: string,
    content: React.ReactNode,
    extra: { "aria-label"?: string; "aria-current"?: "page" } = {}
  ) =>
    isControlled ? (
      <Button
        key={id}
        type="button"
        variant="ghost"
        onClick={() => onNavigate(id)}
        className={className}
        {...extra}
      >
        {content}
      </Button>
    ) : (
      <Button key={id} asChild variant="ghost" className={className}>
        <Link href={href} {...extra}>
          {content}
        </Link>
      </Button>
    );

  const itemClass = (isActive: boolean) =>
    cn(isActive ? "bg-fill-3 text-label" : "text-label-secondary hover:text-label");

  const notificationDot = (
    <span
      aria-hidden="true"
      className="ring-background bg-tint absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2"
    />
  );

  /* ── Mobile: horizontal pill bar ── */
  if (variant === "mobile") {
    return (
      <Card className="overflow-hidden p-2">
        <nav
          aria-label="MyCountry sections"
          className="hide-scrollbar flex items-center gap-2 overflow-x-auto"
        >
          {renderItem(
            "overview",
            "/mycountry",
            "text-label-secondary h-9 shrink-0 gap-2 px-3 text-footnote",
            <>
              <CrownIcon aria-hidden="true" className="text-tint size-3.5 shrink-0" />
              <span className="whitespace-nowrap">Overview</span>
              {isPremium && <PremiumBadge />}
            </>,
            { "aria-label": "Overview" }
          )}
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-label-secondary size-9 shrink-0"
          >
            <Link
              href="/mycountry/editor"
              title="Edit Country Profile"
              aria-label="Edit Country Profile"
            >
              <Edit2 aria-hidden="true" className="size-3.5" />
            </Link>
          </Button>
          <div aria-hidden="true" className="bg-separator h-4 w-px shrink-0" />
          {visibleItems.map((item) => {
            const isActive = item.id === activeId;
            const noteCount = notifications?.[item.id] ?? 0;
            const isLocked = !isPremium && PREMIUM_GATED_SECTIONS.has(item.id);
            return renderItem(
              item.id,
              item.href,
              cn("relative h-9 shrink-0 gap-2 px-3 text-footnote", itemClass(isActive)),
              <>
                <NavIcon id={item.id} fallback={item.icon} className="size-3.5 shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
                {isLocked && <Lock aria-label="Premium" className="size-3 shrink-0" />}
                {noteCount > 0 && !isActive && notificationDot}
              </>,
              isActive ? { "aria-current": "page" } : {}
            );
          })}
        </nav>
      </Card>
    );
  }

  /* ── Expanded desktop: icon + label sidebar ── */
  if (variant === "expanded") {
    return (
      <Card className="flex w-full flex-col gap-1 p-2">
        <nav aria-label="MyCountry sections" className="flex w-full flex-col gap-1">
          <div className="border-separator mb-2 flex w-full items-center justify-between border-b px-1 pb-1">
            {renderItem(
              "overview",
              "/mycountry",
              "text-label h-8 gap-2 px-2 text-caption font-semibold",
              <>
                <CrownIcon aria-hidden="true" className="text-tint size-4 shrink-0" />
                <span className="truncate">MyCountry</span>
                {isPremium && <PremiumBadge />}
              </>
            )}
            <Button asChild variant="ghost" size="icon" className="text-label-secondary size-8">
              <Link
                href="/mycountry/editor"
                title="Edit Country Profile"
                aria-label="Edit Country Profile"
              >
                <Edit2 aria-hidden="true" className="size-3.5" />
              </Link>
            </Button>
          </div>
          {visibleItems.map((item) => {
            const isActive = item.id === activeId;
            const noteCount = notifications?.[item.id] ?? 0;
            const isLocked = !isPremium && PREMIUM_GATED_SECTIONS.has(item.id);
            return renderItem(
              item.id,
              item.href,
              cn("h-9 w-full justify-start gap-2 px-3 text-footnote", itemClass(isActive)),
              <>
                <NavIcon id={item.id} fallback={item.icon} className="shrink-0" />
                <span className="truncate">{item.title}</span>
                {isLocked && <Lock aria-label="Premium" className="ml-auto size-3.5 shrink-0" />}
                {!isLocked && noteCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-auto rounded-full px-2 py-0 tabular-nums"
                  >
                    {noteCount}
                  </Badge>
                )}
              </>,
              isActive ? { "aria-current": "page" } : {}
            );
          })}
        </nav>
      </Card>
    );
  }

  /* ── Desktop: icon rail with tooltip labels ── */
  return (
    <Card className="p-2">
      <nav aria-label="MyCountry sections" className="flex flex-col items-center gap-2">
        <Tooltip content={isPremium ? "Overview · Premium" : "Overview"} side="right">
          {renderItem(
            "overview",
            "/mycountry",
            "text-label-secondary size-9 p-0",
            <CrownIcon aria-hidden="true" className="text-tint" />,
            { "aria-label": "Overview" }
          )}
        </Tooltip>
        <Tooltip content="Edit Profile" side="right">
          <Button asChild variant="ghost" size="icon" className="text-label-secondary">
            <Link href="/mycountry/editor" aria-label="Edit Country Profile">
              <Edit2 aria-hidden="true" />
            </Link>
          </Button>
        </Tooltip>
        <div aria-hidden="true" className="bg-separator h-px w-6" />
        {visibleItems.map((item) => {
          const isActive = item.id === activeId;
          const noteCount = notifications?.[item.id] ?? 0;
          const isLocked = !isPremium && PREMIUM_GATED_SECTIONS.has(item.id);
          return (
            <Tooltip
              key={item.id}
              content={`${item.title}${isLocked ? " (Premium)" : ""}`}
              side="right"
            >
              {renderItem(
                item.id,
                item.href,
                cn("relative size-9 p-0", itemClass(isActive)),
                <>
                  <NavIcon id={item.id} fallback={item.icon} />
                  {isLocked && (
                    <Lock aria-hidden="true" className="absolute -right-0.5 -bottom-0.5 size-3" />
                  )}
                  {noteCount > 0 && !isActive && !isLocked && notificationDot}
                </>,
                {
                  "aria-label": `${item.title}${isLocked ? " (Premium)" : ""}`,
                  ...(isActive ? { "aria-current": "page" as const } : {}),
                }
              )}
            </Tooltip>
          );
        })}
      </nav>
    </Card>
  );
}
