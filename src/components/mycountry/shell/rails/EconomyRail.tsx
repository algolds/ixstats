"use client";

import React from "react";
import { FiscalPolicyInsights } from "../FiscalPolicyConsole";
import { TradeCommerceInsights } from "../TradeCommerceConsole";

/** Economy rail — fiscal policy insights & trade commerce insights telemetry. */
export function EconomyRail({ countryId }: { countryId: string }) {
  return (
    <div className="space-y-4">
      {/* Fiscal Policy Insights — Tax Burden, Revenue Composition, Fiscal Health */}
      <FiscalPolicyInsights countryId={countryId} />

      {/* Trade & Commerce Insights — Openness Gauge & Commercial Telemetry */}
      <TradeCommerceInsights countryId={countryId} />
    </div>
  );
}
