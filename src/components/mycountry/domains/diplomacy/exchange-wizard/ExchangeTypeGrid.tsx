"use client";

import React from "react";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { WIZARD_EXCHANGE_TYPES, type WizardExchangeType } from "./exchange-wizard-config";

interface ExchangeTypeGridProps {
  /** Show the primary types (true) or the "more" types (false). */
  primary: boolean;
  selected: WizardExchangeType;
  onSelect: (type: WizardExchangeType) => void;
  className: string;
}

export const ExchangeTypeGrid = React.memo(function ExchangeTypeGrid({
  primary,
  selected,
  onSelect,
  className,
}: ExchangeTypeGridProps) {
  const types = Object.entries(WIZARD_EXCHANGE_TYPES).filter(
    ([, config]) => config.primary === primary
  );
  // Both grids share one selection: a type from the other grid leaves this one unchecked.
  const value = types.some(([key]) => key === selected) ? selected : null;
  return (
    <RadioCardGroup
      aria-label={primary ? "Exchange type" : "More exchange types"}
      value={value}
      onValueChange={(key) => onSelect(key as WizardExchangeType)}
      className={className}
    >
      {types.map(([key, config]) => {
        const Icon = config.icon;
        return (
          <RadioCard
            key={key}
            value={key}
            icon={<Icon aria-hidden />}
            title={config.label}
            indicator={false}
          />
        );
      })}
    </RadioCardGroup>
  );
});
