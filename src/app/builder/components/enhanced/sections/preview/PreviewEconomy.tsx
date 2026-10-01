"use client";

import React, { memo } from "react";
import {
  Suitcase as Briefcase,
  Group as Users,
  StatUp as TrendingUp,
  Industry as Factory,
} from "iconoir-react";
import { formatCompactNumber, formatCurrency } from "~/lib/utils";
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
        <Factory className="text-label-tertiary mx-auto mb-3 h-10 w-10" />
        <p className="text-body text-label-secondary">No economy configuration set</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Core Indicators */}
      {coreIndicators && (
        <div className="space-y-2">
          <h4 className="text-eyebrow text-label-secondary flex items-center gap-2">
            <TrendingUp className="text-tint h-3.5 w-3.5" />
            Baseline
          </h4>
          <PreviewCoreIndicators coreIndicators={coreIndicators} currency={currency} />
        </div>
      )}

      {/* Labor & Employment */}
      {laborEmployment && (
        <div className="space-y-2">
          <h4 className="text-eyebrow text-label-secondary flex items-center gap-2">
            <Briefcase className="text-tint h-3.5 w-3.5" />
            Labor
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-row border-separator bg-surface border p-3 text-center">
              <div className="text-headline text-label">
                {laborEmployment.laborForceParticipationRate}%
              </div>
              <div className="text-footnote text-label-secondary mt-0.5">Participation</div>
            </div>
            <div className="rounded-row border-separator bg-surface border p-3 text-center">
              <div className="text-headline text-label">{laborEmployment.employmentRate}%</div>
              <div className="text-footnote text-label-secondary mt-0.5">Employment</div>
            </div>
            <div className="rounded-row border-separator bg-surface border p-3 text-center">
              <div className="text-headline text-label">{laborEmployment.unemploymentRate}%</div>
              <div className="text-footnote text-label-secondary mt-0.5">Unemployment</div>
            </div>
            <div
              className="rounded-row border-separator bg-surface border p-3 text-center"
              title={
                laborEmployment.totalWorkforce
                  ? `${laborEmployment.totalWorkforce.toLocaleString()} total workforce`
                  : undefined
              }
            >
              <div className="text-headline text-label">
                {formatCompactNumber(laborEmployment.totalWorkforce)}
              </div>
              <div className="text-footnote text-label-secondary mt-0.5">Workforce</div>
              {laborEmployment.totalWorkforce && laborEmployment.totalWorkforce >= 1e6 && (
                <div className="text-footnote text-label-secondary mt-0.5 truncate font-mono">
                  {laborEmployment.totalWorkforce.toLocaleString()}
                </div>
              )}
            </div>
            <div className="rounded-row border-separator bg-surface border p-3 text-center">
              <div className="text-headline text-label">
                {laborEmployment.averageWorkweekHours} hrs
              </div>
              <div className="text-footnote text-label-secondary mt-0.5">Work Week</div>
            </div>
            <div className="rounded-row border-separator bg-surface border p-3 text-center">
              <div className="text-headline text-label truncate">
                {laborEmployment.averageAnnualIncome
                  ? formatCurrencyLocal(laborEmployment.averageAnnualIncome)
                  : "N/A"}
              </div>
              <div className="text-footnote text-label-secondary mt-0.5">Average Income</div>
            </div>
          </div>
        </div>
      )}

      {/* Demographics */}
      {demographics && (
        <div className="space-y-2">
          <h4 className="text-eyebrow text-label-secondary flex items-center gap-2">
            <Users className="text-tint h-3.5 w-3.5" />
            Demographics
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {demographics.ageDistribution && demographics.ageDistribution.length > 0
              ? demographics.ageDistribution.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-row border-separator bg-surface border p-3 text-center"
                  >
                    <div className="text-headline text-label">{item.percent ?? 0}%</div>
                    <div className="text-footnote text-label-secondary mt-0.5">
                      {item.group || (i === 0 ? "Youth" : i === 1 ? "Working Age" : "Elderly")}
                    </div>
                  </div>
                ))
              : null}
            {demographics.urbanRuralSplit && (
              <div className="rounded-row border-separator bg-surface border p-3 text-center">
                <div className="text-headline text-label">
                  {demographics.urbanRuralSplit.urban}%
                </div>
                <div className="text-footnote text-label-secondary mt-0.5">Urban Population</div>
              </div>
            )}
            <div className="rounded-row border-separator bg-surface border p-3 text-center">
              <div className="text-headline text-label">
                {demographics.lifeExpectancy ? `${demographics.lifeExpectancy} yrs` : "N/A"}
              </div>
              <div className="text-footnote text-label-secondary mt-0.5">Life Expectancy</div>
            </div>
            <div className="rounded-row border-separator bg-surface border p-3 text-center">
              <div className="text-headline text-label">
                {demographics.populationGrowthRate !== undefined
                  ? `${demographics.populationGrowthRate}%`
                  : "N/A"}
              </div>
              <div className="text-footnote text-label-secondary mt-0.5">Population Growth</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

PreviewEconomy.displayName = "PreviewEconomy";
