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
  ScaleFrameEnlarge as Scale,
  Flash as Zap,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import type { RealmItem } from "../types";

interface PassportRealmsTabProps {
  realms: RealmItem[];
  cleanUsername: string;
}

/**
 * Format population in uppercase passport information grammar
 */
function formatPopulationPassport(num: number | null | undefined): string {
  if (!num || num <= 0) return "0";
  if (num >= 1e12) {
    const val = num / 1e12;
    return `${val >= 10 ? val.toFixed(1) : val.toFixed(2)} TRILLION`;
  }
  if (num >= 1e9) {
    const val = num / 1e9;
    return `${val >= 10 ? val.toFixed(1) : val.toFixed(2)} BILLION`;
  }
  if (num >= 1e6) {
    const val = num / 1e6;
    return `${val >= 10 ? val.toFixed(1) : val.toFixed(2)} MILLION`;
  }
  if (num >= 1e3) {
    const val = num / 1e3;
    return `${val >= 10 ? val.toFixed(1) : val.toFixed(2)} THOUSAND`;
  }
  return num.toLocaleString();
}

/**
 * Format GDP in uppercase passport information grammar
 */
function formatCurrencyPassport(num: number | null | undefined): string {
  if (!num || num <= 0) return "$0";
  if (num >= 1e12) {
    const val = num / 1e12;
    return `$${val >= 10 ? val.toFixed(1) : val.toFixed(2)} TRILLION`;
  }
  if (num >= 1e9) {
    const val = num / 1e9;
    return `$${val >= 10 ? val.toFixed(1) : val.toFixed(2)} BILLION`;
  }
  if (num >= 1e6) {
    const val = num / 1e6;
    return `$${val >= 10 ? val.toFixed(1) : val.toFixed(2)} MILLION`;
  }
  if (num >= 1e3) {
    const val = num / 1e3;
    return `$${val >= 10 ? val.toFixed(1) : val.toFixed(2)} THOUSAND`;
  }
  return `$${num.toLocaleString()}`;
}

/**
 * Semantic Role Badge Renderer (Harmonized with Passport Identity Grammar)
 */
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
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-amber-600 shadow-2xs dark:text-amber-400">
        <Crown className="h-3 w-3 shrink-0" />
        <span>{role.toUpperCase()}</span>
      </span>
    );
  }

  if (
    normalizedRole.includes("ADMIN") ||
    normalizedRole.includes("FOUNDER") ||
    normalizedRole.includes("MODERATOR")
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/25 bg-purple-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-purple-600 shadow-2xs dark:text-purple-400">
        <Shield className="h-3 w-3 shrink-0" />
        <span>{role.toUpperCase()}</span>
      </span>
    );
  }

  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-lg border border-black/8 bg-black/5 px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wider dark:border-white/10 dark:bg-white/5">
      <User className="h-3 w-3 shrink-0 opacity-70" />
      <span>{role.toUpperCase()}</span>
    </span>
  );
}

export const PassportRealmsTab = React.memo(function PassportRealmsTab({
  realms,
  cleanUsername,
}: PassportRealmsTabProps) {
  if (!realms || realms.length === 0) {
    return (
      <div className="space-y-3 rounded-3xl border border-black/8 bg-black/[0.015] p-12 text-center dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
          <Globe className="h-6 w-6" />
        </div>
        <h3 className="text-foreground text-base font-bold">No Realms Joined</h3>
        <p className="text-muted-foreground mx-auto max-w-md text-xs">
          @{cleanUsername} is not currently a member of any realms.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-mono text-[11px] font-bold tracking-widest text-stone-400 uppercase">
            JOINED REALMS ({realms.length})
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {realms.map((item) => {
          const country: any = item.country;
          const countryName = country?.name ? country.name.replace(/_/g, " ") : null;
          const flagUrl = country?.flagUrl;

          // Hydrate approval, stability, and capacity (with live fallbacks)
          const rawApproval = country?.currentPublicApproval ?? 74;
          const approvalPct = Math.round(rawApproval > 1 ? rawApproval : rawApproval * 100);

          const rawStability = country?.currentStability ?? 0.82;
          const stabilityPct = Math.round(rawStability > 1 ? rawStability : rawStability * 100);

          const capacityPct = 85;

          return (
            <FacetCard
              key={`${item.id}-${country?.id || "none"}`}
              depth={1}
              interactive="none"
              className="group/card relative flex flex-col overflow-hidden rounded-3xl border border-black/8 bg-black/[0.015] p-5 shadow-sm transition-all duration-200 hover:border-black/15 hover:shadow-md sm:p-6 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20"
            >
              {/* 1. Cinematic Background Flag Watermark Scrim */}
              {flagUrl && (
                <div className="pointer-events-none absolute -top-10 -right-10 h-64 w-64 overflow-hidden opacity-[0.08] transition-opacity duration-300 select-none dark:opacity-[0.14]">
                  <img
                    src={flagUrl}
                    alt=""
                    className="h-full w-full rounded-full object-cover object-center mix-blend-luminosity blur-[1px] filter dark:mix-blend-normal"
                  />
                  <div className="via-card/75 to-card absolute inset-0 bg-gradient-to-l from-transparent" />
                </div>
              )}

              <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                {/* 2. Left Zone: Flag Crest + Sovereign Identity + Meta & Actions */}
                <div className="flex min-w-0 flex-1 items-start gap-4 sm:items-center">
                  {country ? (
                    <div className="bg-muted/40 relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-black/15 shadow-xs transition-transform duration-200 group-hover/card:scale-105 dark:border-white/20">
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
                    <div className="bg-muted/40 text-muted-foreground flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-black/15 shadow-xs dark:border-white/20">
                      <Globe className="h-7 w-7" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-foreground truncate font-sans text-xl font-bold tracking-tight sm:text-2xl">
                        {countryName || item.name}
                      </h3>

                      <RealmRoleBadge role={item.role} />

                      {item.isFeatured && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-amber-600 dark:text-amber-400">
                          <Crown className="h-3 w-3 shrink-0" />
                          PRIMARY
                        </span>
                      )}
                    </div>

                    <p className="text-muted-foreground flex flex-wrap items-center gap-2 font-mono text-xs">
                      <span className="text-foreground/85 font-semibold">
                        REALM: {item.name.toUpperCase()}
                      </span>
                      {country?.continent && (
                        <>
                          <span className="opacity-40">•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                            {country.continent.toUpperCase()}
                          </span>
                        </>
                      )}
                      {country?.governmentType && (
                        <>
                          <span className="opacity-40">•</span>
                          <span>{country.governmentType.toUpperCase()}</span>
                        </>
                      )}
                    </p>

                    <div className="pt-1">
                      {country ? (
                        <Link
                          href={`/countries/${country.slug}`}
                          data-cuelume-press="soft"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:opacity-90 active:scale-[0.97] dark:bg-white dark:text-stone-950"
                        >
                          <span>View Country</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <Link
                          href={`/r/${item.slug || item.id}`}
                          data-cuelume-press="soft"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:opacity-90 active:scale-[0.97] dark:bg-white dark:text-stone-950"
                        >
                          <span>View Realm</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Right Zone: Restrained Passport Information Grammar Telemetry Pod */}
                {country && (
                  <div className="flex w-full shrink-0 flex-col gap-2.5 rounded-2xl border border-black/8 bg-black/[0.02] p-3.5 shadow-2xs backdrop-blur-md sm:p-4 lg:w-[420px] dark:border-white/10 dark:bg-white/[0.02]">
                    {/* Row 1: Population & GDP in Tabular Passport Grammar */}
                    <div className="flex items-center justify-between gap-4 border-b border-black/8 pb-2.5 dark:border-white/10">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />
                        <div>
                          <span className="text-muted-foreground block font-mono text-[9px] font-bold tracking-wider uppercase">
                            POPULATION
                          </span>
                          <strong className="text-foreground font-mono text-sm font-bold tracking-tight">
                            {formatPopulationPassport(country.currentPopulation)}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-right">
                        <div className="min-w-0">
                          <span className="text-muted-foreground block font-mono text-[9px] font-bold tracking-wider uppercase">
                            GROSS DOMESTIC PRODUCT
                          </span>
                          <strong className="font-mono text-sm font-bold tracking-tight text-emerald-500 dark:text-emerald-400">
                            {formatCurrencyPassport(country.currentTotalGdp)}
                          </strong>
                        </div>
                        <DollarSign className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                      </div>
                    </div>

                    {/* Row 2: Governance Triple-Metric Matrix */}
                    <div className="grid grid-cols-3 gap-2 pt-0.5">
                      <div className="flex min-w-0 items-center gap-2 px-1">
                        <Heart className="h-3.5 w-3.5 shrink-0 text-red-500 dark:text-red-400" />
                        <div className="flex min-w-0 flex-col">
                          <span className="text-muted-foreground font-mono text-[8px] leading-none font-bold tracking-wider uppercase sm:text-[9px]">
                            APPROVAL
                          </span>
                          <span className="text-foreground mt-0.5 truncate font-mono text-xs leading-tight font-bold sm:text-sm">
                            {approvalPct}%
                          </span>
                        </div>
                      </div>

                      <div className="flex min-w-0 items-center gap-2 border-l border-black/8 px-2 dark:border-white/10">
                        <Scale className="h-3.5 w-3.5 shrink-0 text-violet-500 dark:text-violet-400" />
                        <div className="flex min-w-0 flex-col">
                          <span className="text-muted-foreground font-mono text-[8px] leading-none font-bold tracking-wider uppercase sm:text-[9px]">
                            STABILITY
                          </span>
                          <span className="text-foreground mt-0.5 truncate font-mono text-xs leading-tight font-bold sm:text-sm">
                            {stabilityPct}%
                          </span>
                        </div>
                      </div>

                      <div className="flex min-w-0 items-center gap-2 border-l border-black/8 px-2 dark:border-white/10">
                        <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                        <div className="flex min-w-0 flex-col">
                          <span className="text-muted-foreground font-mono text-[8px] leading-none font-bold tracking-wider uppercase sm:text-[9px]">
                            CAPACITY
                          </span>
                          <span className="text-foreground mt-0.5 truncate font-mono text-xs leading-tight font-bold sm:text-sm">
                            {capacityPct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </FacetCard>
          );
        })}
      </div>
    </div>
  );
});
