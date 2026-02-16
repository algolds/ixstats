"use client";

import { PartyManager } from "./politics/PartyManager";
import { LegislatureConfig } from "./politics/LegislatureConfig";
import { ElectionSimulator } from "./politics/ElectionSimulator";

interface PoliticsPanelProps {
  countryId: string;
}

export function PoliticsPanel({ countryId }: PoliticsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Legislature configuration first — elections depend on it */}
      <LegislatureConfig countryId={countryId} />

      {/* Political parties — need parties before elections */}
      <PartyManager countryId={countryId} />

      {/* Elections — schedule, register candidates, simulate, view hemicycle */}
      <ElectionSimulator countryId={countryId} />
    </div>
  );
}
