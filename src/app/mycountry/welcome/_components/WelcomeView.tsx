"use client";

import Link from "next/link";
import { WhiteFlag } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EntityHeader } from "~/components/ui/entity-header";
import { Skeleton } from "~/components/ui/skeleton";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { MYCOUNTRY_PATH } from "~/lib/mycountry/routes";
import { formatCompactNumber } from "~/lib/utils/format-utils";
import type { RouterOutputs } from "~/trpc/react";

export type WelcomeNation = NonNullable<RouterOutputs["mycountry"]["getWelcome"]>;

/** "Realm · 12.4M people · Capital: Name", leaving out what the nation does not have yet. */
export function welcomeFacts(nation: Pick<WelcomeNation, "realmName" | "population" | "capital">) {
  return [
    nation.realmName,
    nation.population != null && nation.population > 0
      ? `${formatCompactNumber(nation.population)} people`
      : null,
    nation.capital ? `Capital: ${nation.capital}` : null,
  ]
    .filter((fact): fact is string => !!fact)
    .join(" · ");
}

/** The column the welcome page sits in; the header clears the floating Halo itself. */
export const WELCOME_COLUMN = "mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-12 md:px-8";

/** The founded nation, what happens next, and the one way on: MyCountry. */
export function WelcomeView({ nation }: { nation: WelcomeNation }) {
  const facts = welcomeFacts(nation);
  return (
    <div className={WELCOME_COLUMN}>
      <EntityHeader
        className="pt-(--shell-top-offset)"
        art={
          <UnifiedCountryFlag
            countryName={nation.name}
            flagUrl={normalizeFlagUrl(nation.flag)}
            size="xl"
            showTooltip={false}
            border
          />
        }
        name={nation.name}
        facts={facts ? <span className="tabular-nums">{facts}</span> : undefined}
      />

      <Card padding="lg">
        <CardHeader className="px-0 pb-3">
          <CardTitle icon={<WhiteFlag />} role="heading" aria-level={2}>
            {nation.name} is founded
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 px-0">
          <p className="text-body text-label-secondary max-w-[70ch]">
            {nation.name} is now your active nation. Set its budget, taxes and cabinet in MyCountry.
            You can change its identity and government any time in the editor.
          </p>
          <Button asChild size="lg" className="w-full sm:w-auto sm:self-start">
            <Link href={MYCOUNTRY_PATH}>Open MyCountry</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/** The page's shape while the nation loads. */
export function WelcomeSkeleton() {
  return (
    <div className={WELCOME_COLUMN} aria-busy="true" aria-label="Loading your nation">
      <div className="flex flex-wrap items-end gap-4 pt-(--shell-top-offset) pb-4">
        <Skeleton className="rounded-control h-10 w-16" />
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-2">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="rounded-card h-56 w-full" />
    </div>
  );
}
