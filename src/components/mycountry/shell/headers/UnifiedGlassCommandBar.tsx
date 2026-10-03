"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ViewGrid as LayoutGrid,
  KeyCommand as Command,
  EditPencil as Edit3,
  User,
  ClockRotateRight as FileClock,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { DOMAIN_TILES, DomainTileButton } from "../ExecutiveActionCards";
import { CooldownTimer } from "../ExecutiveHome";
import type { CommandNavMode } from "../command-nav-mode";
import { useDiplomacyInboxCount } from "~/components/mycountry/domains/diplomacy/inbox/useDiplomacyInbox";
import { InboxCountPill } from "~/components/mycountry/domains/diplomacy/inbox/InboxCountPill";
import { PageHeader } from "~/components/shell/PageHeader";
import { SegmentedControl } from "~/components/ui/segmented-control";

interface UnifiedGlassCommandBarProps {
  mode: CommandNavMode;
  activeSection: string;
  onChangeMode: (mode: CommandNavMode) => void;
  onNavigate?: (section: string) => void;
  onDeclare?: () => void;
}

/** "CONSTITUTIONAL_MONARCHY" → "Constitutional monarchy"; ordinary text passes through. */
function humanizeEnum(value: string): string {
  if (!/^[A-Z0-9_]+$/.test(value)) return value;
  const words = value.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One line under the primary action: how many directives are left this week, or when the next one opens. */
function DirectiveStatusLine({ countryId }: { countryId?: string }) {
  const status = api.intent.getStatus.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId }
  );
  if (!status.data) return null;
  const { canCommit, usedThisWeek, cap, cooldownUntil } = status.data;
  if (!canCommit) {
    return (
      <p className="text-label-secondary text-footnote flex items-center gap-1 tabular-nums">
        <FileClock aria-hidden="true" className="h-3.5 w-3.5" />
        <span>
          {cooldownUntil ? (
            <>
              Next directive in <CooldownTimer cooldownUntil={cooldownUntil} />
            </>
          ) : (
            `All ${cap} directives used · slots reset next week`
          )}
        </span>
      </p>
    );
  }
  const left = Math.max(0, cap - usedThisWeek);
  return (
    <p className="text-label-secondary text-footnote tabular-nums">
      {left} of {cap} directives left this week
    </p>
  );
}

/**
 * The MyCountry page header: the country's name and identity, a toolbar (Profile, Editor) with the
 * one Declare Directive button, then the domain tiles (overview) or a section switcher (domain
 * pages and the Directives page).
 */
export function UnifiedGlassCommandBar({
  mode,
  activeSection,
  onChangeMode,
  onNavigate,
  onDeclare,
}: UnifiedGlassCommandBarProps) {
  const router = useRouter();
  const { country } = useCountryData();
  // Incoming diplomatic proposals / invitations awaiting an answer (badge on Diplomacy).
  const { count: diplomacyInboxCount } = useDiplomacyInboxCount(country?.id);

  const profileHref = country?.slug ? `/countries/${country.slug}` : "/countries";

  const isExecutiveMode = mode === "executive";
  const isOverview = !isExecutiveMode && (activeSection === "overview" || !activeSection);

  const realmName: string | null =
    typeof country?.realm?.name === "string" ? country.realm.name : null;
  const subtitle = [country?.leader, country?.governmentType, country?.economicTier]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map(humanizeEnum)
    .join(" · ");

  const sectionTabs = [
    { id: "overview", title: "Overview", icon: LayoutGrid },
    ...DOMAIN_TILES.map(({ id, title, icon }) => ({ id: id as string, title, icon })),
  ];
  // In the directive console no section is current, so no tab is selected.
  const activeTab = isExecutiveMode ? "" : activeSection;

  const identity = [subtitle, realmName].filter(Boolean).join(" · ");

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        title={country?.name ?? "MyCountry"}
        subtitle={
          <>
            {identity ? <p>{identity}</p> : null}
            <DirectiveStatusLine countryId={country?.id} />
          </>
        }
        actions={
          <>
            <Button asChild variant="ghost" className="text-label-secondary">
              <Link href={profileHref} aria-label="Open public profile" title="Open public profile">
                <User aria-hidden="true" />
                <span className="hidden md:inline">Profile</span>
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/mycountry/editor")}
              className="text-label-secondary"
              aria-label="Edit country"
              title="Edit country and territory"
            >
              <Edit3 aria-hidden="true" />
              <span className="hidden md:inline">Editor</span>
            </Button>
            <Button
              type="button"
              aria-pressed={isExecutiveMode}
              onClick={() => {
                if (onDeclare) onDeclare();
                else onChangeMode("executive");
              }}
              className={cn(
                isExecutiveMode && "ring-offset-surface ring-tint/40 ring-2 ring-offset-2"
              )}
            >
              <Command aria-hidden="true" />
              <span>Declare Directive</span>
            </Button>
          </>
        }
      />

      {isOverview ? (
        <nav
          aria-label="MyCountry domains"
          data-app-subnav
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {DOMAIN_TILES.map((tile) => (
            <DomainTileButton
              key={tile.id}
              tile={tile}
              peek={
                tile.id === "diplomacy" && diplomacyInboxCount > 0
                  ? `${diplomacyInboxCount} awaiting your answer`
                  : tile.getPeek(country)
              }
              badge={
                tile.id === "diplomacy" ? <InboxCountPill count={diplomacyInboxCount} /> : undefined
              }
              onSelect={() => onNavigate?.(tile.id)}
            />
          ))}
        </nav>
      ) : (
        <nav
          aria-label="MyCountry sections"
          data-app-subnav
          className="-mx-1 scrollbar-none overflow-x-auto px-1"
        >
          <SegmentedControl
            size="md"
            className="w-max min-w-full"
            value={activeTab}
            aria-label="MyCountry sections"
            onValueChange={(id) => {
              if (isExecutiveMode) onChangeMode("home");
              onNavigate?.(id);
            }}
            options={sectionTabs.map(({ id, title, icon: Icon }) => ({
              value: id,
              icon: <Icon />,
              label: title,
              ...(id === "diplomacy" && diplomacyInboxCount > 0
                ? { badge: diplomacyInboxCount }
                : {}),
            }))}
            asTabs
          />
        </nav>
      )}
    </div>
  );
}
