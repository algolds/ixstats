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
import { FacetContainer } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetTabs } from "~/components/ui/facet";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { assetUrl } from "~/lib/base-path";
import { soundEffects } from "~/lib/sound/cuelume";
import { DOMAIN_TILES, DomainTileButton } from "../ExecutiveActionCards";
import { CooldownTimer } from "../ExecutiveHome";
import { MYCOUNTRY_PRIMARY_ACTION } from "../status-tone";
import type { CommandNavMode } from "../CommandNavToggle";
import { useDiplomacyInboxCount } from "~/components/mycountry/domains/diplomacy/inbox/useDiplomacyInbox";
import { InboxCountPill } from "~/components/mycountry/domains/diplomacy/inbox/InboxCountPill";

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
      <p className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
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
    <p className="text-muted-foreground text-xs tabular-nums">
      {left} of {cap} directives left this week
    </p>
  );
}

/**
 * The MyCountry header: the shell of the command surface (Facet depth 1). A large title
 * (flag + country name) with a quiet ghost toolbar and the one MyCountry-gold primary action,
 * then either the four domain destinations (overview) or a FacetTabs section switcher
 * (domain surfaces and the directive console).
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
  const flagUrl = assetUrl(country?.flagUrl || country?.flag);

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

  return (
    <FacetContainer
      depth={1}
      interactive="none"
      enableRefraction={false}
      className="relative flex w-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-5"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Large title: flag + country name, with a calm identity footnote */}
        <div className="flex min-w-0 items-center gap-3.5">
          {country?.name ? (
            <span className="border-border bg-muted flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border sm:h-14 sm:w-20">
              <UnifiedCountryFlag
                countryName={country.name}
                flagUrl={flagUrl}
                fitContainer
                objectFit="cover"
                rounded={false}
                showTooltip={false}
              />
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-1.5">
              <Eyebrow className="text-(--facet-mycountry)">MyCountry</Eyebrow>
              {realmName ? (
                <span className="text-muted-foreground truncate text-xs">· {realmName}</span>
              ) : null}
            </p>
            <h1 className="text-foreground mt-0.5 truncate text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
              {country?.name ?? "MyCountry"}
            </h1>
            {subtitle ? (
              <p className="text-muted-foreground mt-0.5 truncate text-sm">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {/* Toolbar: two quiet tools and the one primary action */}
        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
          <div className="flex items-center gap-1">
            <Button
              asChild
              variant="ghost"
              className="text-muted-foreground h-11 min-w-11 px-2.5 sm:h-9 sm:min-w-9"
            >
              <Link href={profileHref} aria-label="Open public profile" title="Open public profile">
                <User aria-hidden="true" />
                <span className="hidden md:inline">Profile</span>
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/mycountry/editor")}
              className="text-muted-foreground h-11 min-w-11 px-2.5 sm:h-9 sm:min-w-9"
              aria-label="Edit country"
              title="Edit country and territory"
            >
              <Edit3 aria-hidden="true" />
              <span className="hidden md:inline">Edit</span>
            </Button>
            <Button
              type="button"
              aria-pressed={isExecutiveMode}
              data-cuelume-press="bloom"
              onClick={() => {
                if (onDeclare) onDeclare();
                else onChangeMode("executive");
              }}
              className={cn(
                MYCOUNTRY_PRIMARY_ACTION,
                "ml-1 h-11 flex-1 sm:h-9 sm:flex-none",
                isExecutiveMode && "ring-offset-background ring-2 ring-amber-500/40 ring-offset-2"
              )}
            >
              <Command aria-hidden="true" />
              <span>Declare Directive</span>
            </Button>
          </div>
          <div className="text-center sm:text-right">
            <DirectiveStatusLine countryId={country?.id} />
          </div>
        </div>
      </header>

      {isOverview ? (
        /* Domain destinations */
        <nav
          aria-label="MyCountry domains"
          className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
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
        /* Section switcher */
        <nav aria-label="MyCountry sections" className="-mx-1 scrollbar-none overflow-x-auto px-1">
          <FacetTabs
            size="md"
            tone="mycountry"
            className="w-max min-w-full"
            activeTab={activeTab}
            onChange={(id) => {
              soundEffects.press();
              if (isExecutiveMode) onChangeMode("home");
              onNavigate?.(id);
            }}
            tabs={sectionTabs.map(({ id, title, icon }) => ({
              id,
              icon,
              className: "flex-1 min-h-11 sm:min-h-9",
              label: (
                <>
                  {title}
                  {id === activeTab ? <span className="sr-only"> (current section)</span> : null}
                </>
              ),
              ...(id === "diplomacy" && diplomacyInboxCount > 0
                ? { badge: diplomacyInboxCount }
                : {}),
            }))}
          />
        </nav>
      )}
    </FacetContainer>
  );
}
