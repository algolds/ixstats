"use client";
import { CardGeneralSettingsAdmin } from "../CardGeneralSettingsAdmin";
import { ValuationAdmin } from "../ValuationAdmin";

export function EconomyTab() {
  return (
    <div className="space-y-6">
      <ValuationAdmin />
      <CardGeneralSettingsAdmin />
    </div>
  );
}
