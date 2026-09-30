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
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { assetUrl } from "~/lib/base-path";
import { soundEffects } from "~/lib/sound/cuelume";
import { DOMAIN_TILES, DomainTileButton } from "../ExecutiveActionCards";
import { CooldownTimer } from "../ExecutiveHome";
import { FOCUS_RING, GHOST_BUTTON, PRESSABLE, PRIMARY_BUTTON } from "../surface-kit";
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
 * The MyCountry header. A large title (flag + country name) with a quiet toolbar and one
 * primary action, then either the four domain destinations (overview) or a segmented
 * section switcher (domain surfaces and the directive console).
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

  return (
    <FacetContainer
      depth={2}
      interactive="none"
      enableRefraction={false}
      className="relative flex w-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-5"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Large title: flag + country name, with a calm identity footnote */}
        <div className="flex min-w-0 items-center gap-3.5">
          {country?.name ? (
            <span className="border-border/60 bg-muted/40 flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border sm:h-14 sm:w-20">
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
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              MyCountry
              {realmName ? (
                <span className="text-muted-foreground font-normal"> · {realmName}</span>
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
            <Link
              href={profileHref}
              className={GHOST_BUTTON}
              aria-label="Open public profile"
              title="Open public profile"
              onClick={() => soundEffects.press()}
            >
              <User aria-hidden="true" className="h-4 w-4" />
              <span className="hidden md:inline">Profile</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                router.push("/mycountry/editor");
              }}
              className={GHOST_BUTTON}
              aria-label="Edit country"
              title="Edit country and territory"
            >
              <Edit3 aria-hidden="true" className="h-4 w-4" />
              <span className="hidden md:inline">Edit</span>
            </button>
            <button
              type="button"
              aria-pressed={isExecutiveMode}
              onClick={() => {
                soundEffects.bloom();
                if (onDeclare) onDeclare();
                else onChangeMode("executive");
              }}
              className={cn(
                PRIMARY_BUTTON,
                "ml-1 flex-1 sm:flex-none",
                isExecutiveMode && "ring-offset-background ring-2 ring-amber-500/40 ring-offset-2"
              )}
            >
              <Command aria-hidden="true" className="h-4 w-4" />
              <span>Declare Directive</span>
            </button>
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
        /* Segmented section switcher */
        <nav
          aria-label="MyCountry sections"
          className="bg-muted/60 flex scrollbar-none gap-0.5 overflow-x-auto rounded-xl p-1"
        >
          {[
            { id: "overview", title: "Overview", icon: LayoutGrid },
            ...DOMAIN_TILES.map(({ id, title, icon }) => ({ id: id as string, title, icon })),
          ].map(({ id, title, icon: Icon }) => {
            const isActive = !isExecutiveMode && activeSection === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  soundEffects.press();
                  if (isExecutiveMode) onChangeMode("home");
                  onNavigate?.(id);
                }}
                className={cn(
                  "flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium sm:h-9",
                  PRESSABLE,
                  FOCUS_RING,
                  isActive
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>{title}</span>
                {id === "diplomacy" && <InboxCountPill count={diplomacyInboxCount} />}
              </button>
            );
          })}
        </nav>
      )}
    </FacetContainer>
  );
}
