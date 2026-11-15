"use client";

import { Card } from "~/components/ui/card";
import React from "react";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { useNationClock } from "~/hooks/useNationClock";
import { formatClockDate } from "~/lib/realms/nation-time";
import { fromWireDate } from "./exchange-wizard-dates";
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
  selectedCountries: WizardCountry[];
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
  selectedCountries,
}: WizardStepReviewProps) {
  const typeConfig = WIZARD_EXCHANGE_TYPES[type];
  const clock = useNationClock();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-label text-title-3 mb-2">Review & submit</h3>
        <p className="text-label-secondary text-body">
          Review your exchange details before creating it.
        </p>
      </div>

      <Card content="data" padding="none" className="divide-separator divide-y">
        <div className="flex items-start gap-3 p-4">
          {React.createElement(typeConfig.icon, {
            className: "text-label-secondary mt-1 h-5 w-5",
          })}
          <div className="flex-1">
            <h4 className="text-label text-title-3">{data.title}</h4>
            <p className="text-label-secondary text-body">{typeConfig.label}</p>
            <p className="text-label-secondary text-body mt-2">{data.description}</p>
          </div>
        </div>

        <div className="p-4">
          <h5 className="text-label-secondary text-headline mb-3">Participating countries</h5>
          <div className="flex flex-col gap-3">
            <ReviewCountry
              name={hostCountry.name}
              flagUrl={getCountryFlagUrl(hostCountry)}
              caption="Host country"
            />
            {selectedCountries.map((country) => (
              <ReviewCountry
                key={country.id}
                name={country.name}
                flagUrl={getCountryFlagUrl(country)}
                caption="Participant country"
              />
            ))}
          </div>
        </div>

        <div className="p-4">
          <h5 className="text-label-secondary text-headline mb-2">Narrative</h5>
          <p className="text-label-secondary text-body">{data.narrative}</p>
        </div>

        <div className="p-4">
          <h5 className="text-label-secondary text-headline mb-3">Objectives</h5>
          <ul className="divide-separator divide-y">
            {data.objectives.map((obj) => (
              <li key={obj} className="text-label text-body py-1.5 first:pt-0 last:pb-0">
                {obj}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4">
          <h5 className="text-label-secondary text-headline mb-3">Details</h5>
          <div className="grid grid-cols-2 gap-4">
            <ReviewDetail
              label="Start date"
              value={formatClockDate(fromWireDate(data.startDate), clock)}
            />
            <ReviewDetail
              label="End date"
              value={formatClockDate(fromWireDate(data.endDate), clock)}
            />
            <ReviewDetail label="Max participants" value={data.maxParticipants} />
            <ReviewDetail label="Visibility" value={data.isPublic ? "Public" : "Private"} />
          </div>
        </div>
      </Card>
    </div>
  );
});
