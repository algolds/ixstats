"use client";

import React from "react";
import Link from "next/link";
import {
  Globe,
  ArrowRight,
  MapPin,
  Crown,
  Shield,
  User,
  Group as Users,
  Dollar as DollarSign,
  Heart,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Stat } from "~/components/ui/stat";
import { cn } from "~/lib/utils";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { getScaledValue } from "~/lib/utils/format-utils";
import type { RealmItem } from "../types";
import { Card } from "~/components/ui/card";

interface PassportRealmsTabProps {
  realms: RealmItem[];
  cleanUsername: string;
}

const PASSPORT_SCALE_WORDS: Record<string, string> = {
  T: "trillion",
  B: "billion",
  M: "million",
  K: "thousand",
};

/**
 * Format an amount in passport information grammar ("1.25 billion"), scaled by
 * the shared `getScaledValue`. `prefix` is "$" for GDP.
 */
function formatPassportAmount(num: number | null | undefined, prefix = ""): string {
  if (!num || num <= 0) return `${prefix}0`;
  const { value, suffix } = getScaledValue(num);
  if (!suffix) return `${prefix}${num.toLocaleString()}`;
  return `${prefix}${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${PASSPORT_SCALE_WORDS[suffix]}`;
}

/** Role badge: leaders and staff get a tinted chip with an icon; everyone else neutral. */
function RealmRoleBadge({ role }: { role: string }) {
  const normalizedRole = role.toUpperCase().replace(/\s+/g, "_");

  if (
    normalizedRole.includes("HEAD") ||
    normalizedRole.includes("REGENT") ||
    normalizedRole.includes("LEADER") ||
    normalizedRole.includes("OWNER") ||
    normalizedRole.includes("PRESIDENT") ||
    normalizedRole.includes("PRIME_MINISTER")
  ) {
    return (
      <Badge variant="warning">
        <Crown aria-hidden />
        <span>{role}</span>
      </Badge>
    );
  }

  if (
    normalizedRole.includes("ADMIN") ||
    normalizedRole.includes("FOUNDER") ||
    normalizedRole.includes("MODERATOR")
  ) {
    return (
      <Badge variant="secondary">
        <Shield aria-hidden />
        <span>{role}</span>
      </Badge>
    );
  }

  return (
    <Badge variant="default">
      <User aria-hidden />
      <span>{role}</span>
    </Badge>
  );
}

/** One figure in the realm telemetry pod. */
function RealmMetric({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span aria-hidden className="text-label-secondary shrink-0 [&_svg]:size-4">
        {icon}
      </span>
      <Stat size="sm" label={label} value={value} />
    </div>
  );
}

export const PassportRealmsTab = React.memo(function PassportRealmsTab({
  realms,
  cleanUsername,
}: PassportRealmsTabProps) {
  if (!realms || realms.length === 0) {
    return (
      <Card variant="well" padding="none" className="border-separator border">
        <EmptyState
          icon={<Globe />}
          title="No realms joined"
          message={`@${cleanUsername} is not a member of any realms.`}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-subhead text-label-secondary">
        Joined realms <span className="tabular-nums">({realms.length})</span>
      </h2>

      <div className="grid grid-cols-1 gap-4">
        {realms.map((item) => {
          const country = item.country;
          const countryName = country?.name ? country.name.replace(/_/g, " ") : null;
          const flagUrl = country?.flagUrl;

          return (
            <article
              key={`${item.id}-${country?.id || "none"}`}
              className={cn(
                "bg-surface-secondary text-label rounded-row",
                "border-separator relative flex flex-col overflow-hidden border p-4 sm:p-5"
              )}
            >
              <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                {/* Identity, meta and action */}
                <div className="flex min-w-0 flex-1 items-start gap-4 sm:items-center">
                  {country ? (
                    <div className="bg-fill-3 border-separator rounded-row relative size-16 shrink-0 overflow-hidden border">
                      <UnifiedCountryFlag
                        countryName={country.name}
                        size="lg"
                        flagUrl={flagUrl}
                        fitContainer={true}
                        objectFit="cover"
                        showTooltip={false}
                        rounded={false}
                        shadow={false}
                        border={false}
                        className="h-full w-full"
                      />
                    </div>
                  ) : (
                    <div className="bg-fill-3 border-separator text-label-secondary rounded-row flex size-16 shrink-0 items-center justify-center border">
                      <Globe aria-hidden className="size-6" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-label text-title-2 truncate">
                        {countryName || item.name}
                      </h3>

                      <RealmRoleBadge role={item.role} />

                      {item.isFeatured && (
                        <Badge variant="secondary">
                          <Crown aria-hidden />
                          Primary
                        </Badge>
                      )}
                    </div>

                    <p className="text-label-secondary text-footnote flex flex-wrap items-center gap-2">
                      <span className="text-label font-medium">Realm: {item.name}</span>
                      {country?.continent && (
                        <>
                          <span aria-hidden className="text-label-tertiary">
                            •
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin aria-hidden className="size-3.5 shrink-0" />
                            {country.continent}
                          </span>
                        </>
                      )}
                      {country?.governmentType && (
                        <>
                          <span aria-hidden className="text-label-tertiary">
                            •
                          </span>
                          <span>{country.governmentType}</span>
                        </>
                      )}
                    </p>

                    <div className="pt-1">
                      <Button asChild variant="secondary" size="sm">
                        {country ? (
                          <Link href={`/countries/${country.slug}`}>
                            <span>View country</span>
                            <ArrowRight aria-hidden />
                          </Link>
                        ) : (
                          <Link href={`/r/${item.slug || item.id}`}>
                            <span>View realm</span>
                            <ArrowRight aria-hidden />
                          </Link>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Country figures */}
                {country && (
                  <div className="bg-surface rounded-row flex w-full shrink-0 flex-col gap-3 p-3 sm:p-4 lg:w-[420px]">
                    <div className="border-separator flex items-center justify-between gap-4 border-b pb-3">
                      <RealmMetric
                        icon={<Users />}
                        label="Population"
                        value={formatPassportAmount(country.currentPopulation)}
                      />
                      <RealmMetric
                        icon={<DollarSign />}
                        label="Gross domestic product"
                        value={formatPassportAmount(country.currentTotalGdp, "$")}
                      />
                    </div>

                    <RealmMetric
                      icon={<Heart />}
                      label="Approval"
                      value={`${Math.round(country.currentPublicApproval)}%`}
                    />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
});
