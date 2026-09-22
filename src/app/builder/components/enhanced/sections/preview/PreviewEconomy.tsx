"use client";

import React, { memo } from "react";
import {
  Suitcase as Briefcase,
  Group as Users,
  StatUp as TrendingUp,
  Industry as Factory,
} from "iconoir-react";
import { formatCurrency } from "~/lib/utils";
import type { EconomicInputs } from "~/app/builder/lib/economy-data-service";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { GovernmentStructure } from "~/types/government";
import { PreviewCoreIndicators } from "./PreviewCoreIndicators";

interface PreviewEconomyProps {
  economicInputs: EconomicInputs | null;
  economyBuilderState?: EconomyBuilderState | null;
  normalizedGovernmentStructure?: GovernmentStructure | null;
  currency?: string;
}

function formatCompactCount(num?: number | null): string {
  if (num === null || num === undefined || Number.isNaN(num)) return "N/A";
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString("en-US");
}

export const PreviewEconomy = memo(function PreviewEconomy({
  economicInputs,
  currency = "USD",
}: PreviewEconomyProps) {
  const laborEmployment = economicInputs?.laborEmployment;
  const demographics = economicInputs?.demographics;
  const coreIndicators = economicInputs?.coreIndicators;

  const formatCurrencyLocal = (amount: number) => formatCurrency(amount, currency);

  if (!laborEmployment && !demographics && !coreIndicators) {
    return (
      <div className="py-8 text-center">
        <Factory className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">No economy configuration set</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Core Indicators */}
      {coreIndicators && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            Baseline
          </h4>
          <PreviewCoreIndicators coreIndicators={coreIndicators} currency={currency} />
        </div>
      )}

      {/* Labor & Employment */}
      {laborEmployment && (
        <div className="space-y-2.5">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
            Labor
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-border/40 bg-card/40 p-3 text-center backdrop-blur-md">
              <div className="text-base font-bold text-foreground">
                {laborEmployment.laborForceParticipationRate}%
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Participation</div>
            </div>
            <div className="rounded-xl border border-border/40 bg-card/40 p-3 text-center backdrop-blur-md">
              <div className="text-base font-bold text-foreground">
                {laborEmployment.employmentRate}%
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Employment</div>
            </div>
            <div className="rounded-xl border border-border/40 bg-card/40 p-3 text-center backdrop-blur-md">
              <div className="text-base font-bold text-foreground">
                {laborEmployment.unemploymentRate}%
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Unemployment</div>
            </div>
            <div
              className="rounded-xl border border-border/40 bg-card/40 p-3 text-center backdrop-blur-md"
              title={
                laborEmployment.totalWorkforce
                  ? `${laborEmployment.totalWorkforce.toLocaleString()} total workforce`
                  : undefined
              }
            >
              <div className="text-base font-bold text-foreground">
                {formatCompactCount(laborEmployment.totalWorkforce)}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Workforce</div>
              {laborEmployment.totalWorkforce && laborEmployment.totalWorkforce >= 1e6 && (
                <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/70">
                  {laborEmployment.totalWorkforce.toLocaleString()}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-border/40 bg-card/40 p-3 text-center backdrop-blur-md">
              <div className="text-base font-bold text-foreground">
                {laborEmployment.averageWorkweekHours} hrs
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Work Week</div>
            </div>
            <div className="rounded-xl border border-border/40 bg-card/40 p-3 text-center backdrop-blur-md">
              <div className="truncate text-base font-bold text-foreground">
                {laborEmployment.averageAnnualIncome
                  ? formatCurrencyLocal(laborEmployment.averageAnnualIncome)
                  : "N/A"}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Average Income</div>
            </div>
          </div>
        </div>
      )}

      {/* Demographics */}
      {demographics && (
        <div className="space-y-2.5">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-primary" />
            Demographics
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {demographics.ageDistribution && demographics.ageDistribution.length > 0 ? (
              demographics.ageDistribution.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border/40 bg-card/40 p-3 text-center backdrop-blur-md"
                >
                  <div className="text-base font-bold text-foreground">{item.percent ?? 0}%</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {item.group || (i === 0 ? "Youth" : i === 1 ? "Working Age" : "Elderly")}
                  </div>
                </div>
              ))
            ) : null}
            {demographics.urbanRuralSplit && (
              <div className="rounded-xl border border-border/40 bg-card/40 p-3 text-center backdrop-blur-md">
                <div className="text-base font-bold text-foreground">
                  {demographics.urbanRuralSplit.urban}%
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">Urban Population</div>
              </div>
            )}
            <div className="rounded-xl border border-border/40 bg-card/40 p-3 text-center backdrop-blur-md">
              <div className="text-base font-bold text-foreground">
                {demographics.lifeExpectancy ? `${demographics.lifeExpectancy} yrs` : "N/A"}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Life Expectancy</div>
            </div>
            <div className="rounded-xl border border-border/40 bg-card/40 p-3 text-center backdrop-blur-md">
              <div className="text-base font-bold text-foreground">
                {demographics.populationGrowthRate !== undefined
                  ? `${demographics.populationGrowthRate}%`
                  : "N/A"}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Population Growth</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

PreviewEconomy.displayName = "PreviewEconomy";
