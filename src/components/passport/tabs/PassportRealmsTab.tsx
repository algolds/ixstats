"use client";

import React from "react";
import Link from "next/link";
import { Crown, Globe, Shield } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Stat } from "~/components/ui/stat";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { REALM_ROLE_LABEL } from "~/lib/passport/passport-labels";
import { getScaledValue } from "~/lib/utils/format-utils";
import type { RealmItem } from "../types";

interface PassportRealmsTabProps {
  realms: RealmItem[];
  handle: string;
  /** Approved claims this holder recruited; "Recruited N" shows when above zero. */
  recruitedCount?: number;
}

const PASSPORT_SCALE_WORDS: Record<string, string> = {
  T: "trillion",
  B: "billion",
  M: "million",
  K: "thousand",
};

const LINK_CLASS =
  "rounded-control-sm focus-visible:outline-tint hover:underline focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * Format an amount in passport information grammar ("1.25 billion"), scaled by
 * the shared `getScaledValue`. `prefix` is "$" for GDP. Null for an unknown (missing or
 * non-positive) amount, which the row leaves out rather than showing "0".
 */
function formatPassportAmount(num: number | null | undefined, prefix = ""): string | null {
  if (!num || num <= 0) return null;
  const { value, suffix } = getScaledValue(num);
  if (!suffix) return `${prefix}${num.toLocaleString()}`;
  return `${prefix}${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${PASSPORT_SCALE_WORDS[suffix]}`;
}

interface RealmGroup {
  id: string;
  name: string;
  slug: string;
  role: RealmItem["role"];
  nations: RealmItem[];
}

/** Memberships grouped by realm, in the order each realm first appears. */
function groupByRealm(realms: ReadonlyArray<RealmItem>): RealmGroup[] {
  const groups = new Map<string, RealmGroup>();
  for (const item of realms) {
    const group = groups.get(item.id);
    if (group) {
      group.nations.push(item);
      continue;
    }
    const { id, name, slug, role } = item;
    groups.set(id, { id, name, slug, role, nations: [item] });
  }
  return [...groups.values()];
}

/** Realm role badge: founders and officers are named; a plain member gets none. */
function RealmRoleBadge({ role }: { role: RealmItem["role"] }) {
  const label = REALM_ROLE_LABEL[role];
  if (!label) return null;
  const Icon = role === "founder" ? Crown : Shield;
  return (
    <Badge variant={role === "founder" ? "warning" : "secondary"}>
      <Icon aria-hidden />
      <span>{label}</span>
    </Badge>
  );
}

function NationRow({ item }: { item: RealmItem }) {
  const { country } = item;
  const meta = [country.continent, country.governmentType].filter(Boolean).join(" · ");
  const population = formatPassportAmount(country.currentPopulation);
  const gdp = formatPassportAmount(country.currentTotalGdp, "$");
  return (
    <li className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="bg-fill-3 border-separator rounded-row size-12 shrink-0 overflow-hidden border">
          <UnifiedCountryFlag
            countryName={country.name}
            size="lg"
            flagUrl={country.flagUrl}
            fitContainer={true}
            objectFit="cover"
            showTooltip={false}
            rounded={false}
            shadow={false}
            border={false}
            className="h-full w-full"
          />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/countries/${country.slug}`}
              className={`text-label text-headline truncate ${LINK_CLASS}`}
            >
              {country.name.replace(/_/g, " ")}
            </Link>
            {item.isPrimary && <Badge variant="secondary">Primary nation</Badge>}
          </div>
          {meta && <p className="text-label-secondary text-footnote truncate">{meta}</p>}
        </div>
      </div>

      {/* Figures wrap onto a new line instead of truncating ("399.1 mi") on a narrow phone. */}
      <div
        data-testid="passport-nation-figures"
        className="flex shrink-0 flex-wrap gap-x-4 gap-y-2 tabular-nums sm:gap-x-6"
      >
        {population && (
          <Stat size="sm" label="Population" value={population} className="shrink-0" />
        )}
        {gdp && <Stat size="sm" label="GDP" value={gdp} className="shrink-0" />}
        <Stat
          size="sm"
          label="Approval"
          value={`${Math.round(country.currentPublicApproval)}%`}
          className="shrink-0"
        />
      </div>
    </li>
  );
}

/** The holder's nations, grouped under the realm each is held in, with the realm role. */
export const PassportRealmsTab = React.memo(function PassportRealmsTab({
  realms,
  handle,
  recruitedCount,
}: PassportRealmsTabProps) {
  if (realms.length === 0) {
    return (
      <Card variant="well" padding="none">
        <EmptyState
          compact
          icon={<Globe />}
          title="No nations yet"
          message={`@${handle} has not claimed a nation in any realm.`}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {recruitedCount !== undefined && recruitedCount > 0 && (
        <p className="text-label-secondary text-footnote tabular-nums">
          {`Recruited ${recruitedCount.toLocaleString()}`}
        </p>
      )}
      {groupByRealm(realms).map((group) => (
        <section key={group.id} aria-labelledby={`passport-realm-${group.id}`}>
          <div className="border-separator flex items-center gap-2 border-b pb-2">
            <h2 id={`passport-realm-${group.id}`} className="text-headline min-w-0 truncate">
              {/* Never link a realm by id: without a slug the name stays plain text. */}
              {group.slug ? (
                <Link href={`/r/${group.slug}`} className={`text-label ${LINK_CLASS}`}>
                  {group.name}
                </Link>
              ) : (
                <span className="text-label">{group.name}</span>
              )}
            </h2>
            <RealmRoleBadge role={group.role} />
          </div>
          <ul className="divide-separator divide-y">
            {group.nations.map((item) => (
              <NationRow key={item.country.id} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
});
