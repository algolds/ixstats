"use client";

import { Badge } from "~/components/ui/badge";
import React from "react";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
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
        className="shadow-card rounded-control-sm"
        flagUrl={flagUrl}
      />
      <div>
        <p className="text-label font-semibold">{name}</p>
        <p className="text-label-secondary text-footnote">{caption}</p>
      </div>
    </div>
  );
}

function ReviewDetail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-label-secondary text-footnote">{label}</p>
      <p className="text-label text-body font-medium">{value}</p>
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
        <h3 className="text-label text-title-3 mb-2">Review & Submit</h3>
        <p className="text-label-secondary text-body">
          Review your exchange details before creating it.
        </p>
      </div>

      <div className="space-y-5">
        {/* Type & Title */}
        <div className="border-separator bg-surface rounded-row border p-4">
          <div className="flex items-start gap-3">
            {React.createElement(typeConfig.icon, {
              className: "text-label-secondary mt-1 h-5 w-5",
            })}
            <div className="flex-1">
              <h4 className="text-label text-title-3">{data.title}</h4>
              <p className="text-label-secondary text-body">{typeConfig.label}</p>
              <p className="text-label-secondary text-body mt-2">{data.description}</p>
            </div>
          </div>
        </div>

        {/* Countries */}
        <div className="border-separator bg-surface rounded-row border p-4">
          <h5 className="text-label-secondary text-headline mb-3">Participating Countries</h5>
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
        <div className="border-separator bg-surface rounded-row border p-4">
          <h5 className="text-label-secondary text-headline mb-2">Narrative</h5>
          <p className="text-label-secondary text-body">{data.narrative}</p>
        </div>

        {/* Objectives */}
        <div className="border-separator bg-surface rounded-row border p-4">
          <h5 className="text-label-secondary text-headline mb-3">Objectives</h5>
          <div className="flex flex-wrap gap-2">
            {data.objectives.map((obj) => (
              <Badge key={obj} variant="default">
                {obj}
              </Badge>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="border-separator bg-surface rounded-row border p-4">
          <h5 className="text-label-secondary text-headline mb-3">Details</h5>
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
