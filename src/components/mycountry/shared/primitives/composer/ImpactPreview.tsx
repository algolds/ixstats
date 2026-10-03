"use client";

import React from "react";
import { City, Coins, Journal, Page, WarningTriangle } from "iconoir-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Eyebrow } from "~/components/ui/eyebrow";
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
import { Card } from "~/components/ui/card";

const CHANGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  budget: Coins,
  policy: Page,
  statement: Journal,
};

interface ImpactPreviewProps {
  pkg: IntentPackageView;
  broker: { name: string; unlocked: boolean; satisfied: boolean } | null;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2">
      <Eyebrow>{children}</Eyebrow>
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
                <Icon className="text-label-secondary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <p className="text-label text-body font-medium first-letter:uppercase">
                    {c.label}
                  </p>
                  <p className="text-label-secondary text-footnote first-letter:uppercase">
                    {c.detail}
                  </p>
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
            <p className="text-label-secondary text-footnote mt-2">
              Stat changes apply as soon as you declare, within the engine&rsquo;s bounds.
            </p>
          </>
        ) : (
          <p className="text-label-secondary text-body">
            No direct stat change. This approach works through the budget and public signalling.
          </p>
        )}
      </div>

      <div>
        <SubHeading>Stakeholders</SubHeading>
        <Card variant="inset" padding="none">
          <dl className="divide-separator text-body divide-y">
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <dt className="text-label-secondary">Acceptance</dt>
              <dd className={cn("font-medium", TONE_CLASSES[acceptance.tone].text)}>
                {acceptance.label}
              </dd>
            </div>
            {broker && (
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-label-secondary flex items-center gap-2">
                  <City className="h-4 w-4" aria-hidden />
                  Aligned power broker
                </dt>
                <dd className="text-label text-right font-medium">
                  {broker.name}
                  <span className="text-label-secondary font-normal">
                    {" "}
                    · {broker.satisfied ? "satisfied" : broker.unlocked ? "active" : "neutral"}
                  </span>
                </dd>
              </div>
            )}
          </dl>
        </Card>
        {tierMaySpawnResistance(pkg.tier) && (
          <Alert role="note" className="border-yellow/30 text-yellow mt-3">
            <WarningTriangle aria-hidden />
            <AlertDescription className="text-footnote">
              May stir up a resistance issue. You will need to resolve it before you can mark this
              directive complete.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
