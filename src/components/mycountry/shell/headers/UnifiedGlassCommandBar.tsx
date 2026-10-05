"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  KeyCommand as Command,
  EditPencil as Edit3,
  User,
  ClockRotateRight as FileClock,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { CooldownTimer } from "../ExecutiveHome";
import type { CommandNavMode } from "../command-nav-mode";
import { PageHeader, BACKDROP_PLATE } from "~/components/shell/PageHeader";
import { assetUrl } from "~/lib/base-path";
import { FlagBanner } from "./FlagBanner";

/** Ghost actions over the flag get the title plate's strength, with an opaque hover and press. */
const ACTION_PLATE = cn(
  BACKDROP_PLATE,
  "hover:bg-surface-secondary active:bg-surface-secondary rounded-full"
);

interface UnifiedGlassCommandBarProps {
  mode: CommandNavMode;
  onChangeMode: (mode: CommandNavMode) => void;
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
 * The MyCountry page header: the country's name and identity over its flag as cover art, and a
 * toolbar (Profile, Editor) with the one Declare Directive button. The banner is the identity art
 * (no small flag beside the title) and collapses with the header. Section switching is the global
 * source list.
 */
export function UnifiedGlassCommandBar({
  mode,
  onChangeMode,
  onDeclare,
}: UnifiedGlassCommandBarProps) {
  const router = useRouter();
  const { country } = useCountryData();

  const profileHref = country?.slug ? `/countries/${country.slug}` : "/countries";

  const isExecutiveMode = mode === "executive";

  const realmName: string | null =
    typeof country?.realm?.name === "string" ? country.realm.name : null;
  const subtitle = [country?.leader, country?.governmentType, country?.economicTier]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map(humanizeEnum)
    .join(" · ");

  const identity = [subtitle, realmName].filter(Boolean).join(" · ");
  // Pills only over the visible art: not in the compact bar (its own chrome is the backdrop there).
  const plate = (collapsed: boolean) => (bannerShowing && !collapsed ? ACTION_PLATE : undefined);
  const flagUrl = assetUrl(country?.flagUrl || country?.flag);
  // The flag whose image failed to load; a different flag is tried afresh. The plates behind the
  // title and the action pills exist only to sit over the art, so they follow whether it shows.
  const [failedFlag, setFailedFlag] = useState<string | null>(null);
  const bannerShowing = Boolean(flagUrl) && failedFlag !== flagUrl;

  return (
    <PageHeader
      title={country?.name ?? "MyCountry"}
      // Always present, so the header's padding never jumps when the flag arrives late or fails.
      backdrop={
        <FlagBanner src={bannerShowing ? flagUrl : null} onError={() => setFailedFlag(flagUrl)} />
      }
      backdropVisible={bannerShowing}
      subtitle={
        <>
          {identity ? <p>{identity}</p> : null}
          <DirectiveStatusLine countryId={country?.id} />
        </>
      }
      actions={({ collapsed }) => (
        <>
          <Button asChild variant="ghost" className={cn("text-label-secondary", plate(collapsed))}>
            <Link href={profileHref} aria-label="Open public profile" title="Open public profile">
              <User aria-hidden="true" />
              <span className="hidden md:inline">Profile</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/mycountry/editor")}
            className={cn("text-label-secondary", plate(collapsed))}
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
      )}
    />
  );
}
