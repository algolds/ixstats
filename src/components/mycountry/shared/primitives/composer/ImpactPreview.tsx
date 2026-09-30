"use client";

import React from "react";
import { City, Coins, Journal, Page, WarningTriangle } from "iconoir-react";
import { cn } from "~/lib/utils";
import { EffectList } from "~/components/mycountry/directives/EffectList";
import {
  ACCEPTANCE_META,
  TONE_CLASSES,
  consequenceToEffect,
  gdpShiftToEffect,
  tierMaySpawnResistance,
  type IntentPackageView,
} from "~/components/mycountry/directives/directive-model";

const CHANGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  budget: Coins,
  policy: Page,
  statement: Journal,
};

export interface ImpactPreviewProps {
  pkg: IntentPackageView;
  broker: { name: string; unlocked: boolean; satisfied: boolean } | null;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
      {children}
    </h4>
  );
}

/** Step 3: what the chosen approach does — levers, projected stat effects, stakeholders. */
export function ImpactPreview({ pkg, broker }: ImpactPreviewProps) {
  const effects = pkg.consequences.map((c, i) => consequenceToEffect(c, `${c.targetField}-${i}`));
  if (pkg.gdpLevelShift > 0) effects.push(gdpShiftToEffect(pkg.gdpLevelShift, pkg.gdpEffectYears));
  const acceptance = ACCEPTANCE_META[pkg.acceptance];

  return (
    <div className="space-y-6">
      <div>
        <SubHeading>What your government will do</SubHeading>
        <ul className="space-y-2">
          {pkg.changes.map((c, i) => {
            const Icon = CHANGE_ICONS[c.kind] ?? Page;
            return (
              <li key={`${c.label}-${i}`} className="flex items-start gap-3">
                <span className="bg-muted text-muted-foreground mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-medium first-letter:uppercase">
                    {c.label}
                  </p>
                  <p className="text-muted-foreground text-xs first-letter:uppercase">{c.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <SubHeading>Projected effects</SubHeading>
        {effects.length > 0 ? (
          <>
            <EffectList items={effects} />
            <p className="text-muted-foreground mt-2 text-xs">
              Stat changes apply as soon as you declare, within the engine&rsquo;s bounds.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            No direct stat change. This approach works through the budget and public signalling.
          </p>
        )}
      </div>

      <div>
        <SubHeading>Stakeholders</SubHeading>
        <dl className="border-border divide-border divide-y rounded-xl border text-sm">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-muted-foreground">Acceptance</dt>
            <dd className={cn("font-medium", TONE_CLASSES[acceptance.tone].text)}>
              {acceptance.label}
            </dd>
          </div>
          {broker && (
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <dt className="text-muted-foreground flex items-center gap-2">
                <City className="h-4 w-4" aria-hidden />
                Aligned power broker
              </dt>
              <dd className="text-foreground text-right font-medium">
                {broker.name}
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · {broker.satisfied ? "satisfied" : broker.unlocked ? "active" : "neutral"}
                </span>
              </dd>
            </div>
          )}
        </dl>
        {tierMaySpawnResistance(pkg.tier) && (
          <p
            className={cn(
              "mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs",
              TONE_CLASSES.caution.chip
            )}
          >
            <WarningTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden />
            <span>
              May stir up a resistance issue. You will need to resolve it before you can mark this
              directive complete.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
