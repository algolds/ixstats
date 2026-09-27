"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import {
  WIZARD_EXCHANGE_TYPES,
  getCountryFlagUrl,
  type ExchangeWizardData,
  type WizardCountry,
  type WizardExchangeType,
  type WizardHostCountry,
} from "./exchange-wizard-config";

interface WizardStepReviewProps {
  data: ExchangeWizardData;
  type: WizardExchangeType;
  hostCountry: WizardHostCountry;
  selectedCountry: WizardCountry | undefined;
}

function ReviewCountry({
  name,
  flagUrl,
  caption,
}: {
  name: string;
  flagUrl: string | undefined;
  caption: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <UnifiedCountryFlag
        countryName={name}
        size="sm"
        className="rounded shadow-sm"
        flagUrl={flagUrl}
      />
      <div>
        <p className="text-foreground font-bold">{name}</p>
        <p className="text-muted-foreground text-xs">{caption}</p>
      </div>
    </div>
  );
}

function ReviewDetail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-foreground text-sm font-medium">{value}</p>
    </div>
  );
}

/** Step 5 — review before submitting. */
export const WizardStepReview = React.memo(function WizardStepReview({
  data,
  type,
  hostCountry,
  selectedCountry,
}: WizardStepReviewProps) {
  const typeConfig = WIZARD_EXCHANGE_TYPES[type];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-foreground mb-2 text-lg font-bold">Review & Submit</h3>
        <p className="text-muted-foreground text-sm">
          Review your exchange details before creating it.
        </p>
      </div>

      <div className="space-y-5">
        {/* Type & Title */}
        <div className="facet-hierarchy-child rounded-lg p-4">
          <div className="flex items-start gap-3">
            {React.createElement(typeConfig.icon, {
              className: cn("h-6 w-6 mt-1", typeConfig.color),
            })}
            <div className="flex-1">
              <h4 className="text-foreground text-lg font-bold">{data.title}</h4>
              <p className="text-muted-foreground text-sm">{typeConfig.label}</p>
              <p className="mt-2 text-sm text-muted-foreground">{data.description}</p>
            </div>
          </div>
        </div>

        {/* Countries */}
        <div className="facet-hierarchy-child rounded-lg p-4">
          <h5 className="text-muted-foreground mb-3 text-sm font-semibold">
            Participating Countries
          </h5>
          <div className="flex flex-col gap-3">
            <ReviewCountry
              name={hostCountry.name}
              flagUrl={getCountryFlagUrl(hostCountry)}
              caption="Host Country"
            />
            {selectedCountry && (
              <ReviewCountry
                name={selectedCountry.name}
                flagUrl={getCountryFlagUrl(selectedCountry)}
                caption="Participant Country"
              />
            )}
          </div>
        </div>

        {/* Narrative */}
        <div className="facet-hierarchy-child rounded-lg p-4">
          <h5 className="text-muted-foreground mb-2 text-sm font-semibold">Narrative</h5>
          <p className="text-sm text-muted-foreground">{data.narrative}</p>
        </div>

        {/* Objectives */}
        <div className="facet-hierarchy-child rounded-lg p-4">
          <h5 className="text-muted-foreground mb-3 text-sm font-semibold">Objectives</h5>
          <div className="flex flex-wrap gap-2">
            {data.objectives.map((obj) => (
              <span
                key={obj}
                className="rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-xs text-amber-600 dark:text-amber-400"
              >
                {obj}
              </span>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="facet-hierarchy-child rounded-lg p-4">
          <h5 className="text-muted-foreground mb-3 text-sm font-semibold">Details</h5>
          <div className="grid grid-cols-2 gap-4">
            <ReviewDetail
              label="Start Date"
              value={new Date(data.startDate).toLocaleDateString()}
            />
            <ReviewDetail label="End Date" value={new Date(data.endDate).toLocaleDateString()} />
            <ReviewDetail label="Max Participants" value={data.maxParticipants} />
            <ReviewDetail label="Visibility" value={data.isPublic ? "Public" : "Private"} />
          </div>
        </div>
      </div>
    </div>
  );
});
