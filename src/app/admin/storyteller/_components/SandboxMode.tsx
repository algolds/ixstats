"use client";
// src/app/admin/storyteller/_components/SandboxMode.tsx
// Simulate world events without applying them to the database

import { useState } from "react";
import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils/format-utils";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import { ScrollArea } from "~/components/ui/scroll-area";
import { CountrySelector } from "./CountrySelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Flask as FlaskConical,
  Play,
  SystemRestart as Loader2,
  StatDown as TrendingDown,
  StatUp as TrendingUp,
  ArrowRight,
} from "iconoir-react";

const EVENT_TYPES = [
  { value: "economic_crisis", label: "Economic Crisis" },
  { value: "trade_war", label: "Trade War" },
  { value: "natural_disaster", label: "Natural Disaster" },
  { value: "political_upheaval", label: "Political Upheaval" },
  { value: "tech_revolution", label: "Tech Revolution" },
  { value: "peace_era", label: "Peace & Prosperity" },
  { value: "pandemic", label: "Pandemic" },
  { value: "climate_disaster", label: "Climate Emergency" },
  { value: "custom", label: "Custom" },
];

export function SandboxMode() {
  const [type, setType] = useState("economic_crisis");
  const [severity, setSeverity] = useState(0.5);
  const [duration, setDuration] = useState(2);
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([]);
  const [runSimulation, setRunSimulation] = useState(false);

  const simulation = api.admin.simulateWorldEvent.useQuery(
    {
      type,
      severity,
      duration,
      affectedCountryIds: selectedCountryIds,
    },
    {
      enabled: runSimulation && selectedCountryIds.length > 0,
      refetchOnWindowFocus: false,
    }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FlaskConical className="text-indigo h-5 w-5" />
        <h3 className="text-label text-title-3">Sandbox Mode</h3>
        <Badge variant="secondary">No changes applied</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Configuration */}
        <div className="space-y-5">
          <div>
            <Label>Event Type</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v);
                setRunSimulation(false);
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Severity</Label>
              <span className="text-label text-body font-medium">
                {(severity * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[severity]}
              onValueChange={([v]) => {
                setSeverity(v);
                setRunSimulation(false);
              }}
              min={0.05}
              max={1}
              step={0.05}
              className="mt-2"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Duration (years)</Label>
              <span className="text-label text-body font-medium">{duration}</span>
            </div>
            <Slider
              value={[duration]}
              onValueChange={([v]) => {
                setDuration(v);
                setRunSimulation(false);
              }}
              min={0.5}
              max={10}
              step={0.5}
              className="mt-2"
            />
          </div>

          <div>
            <Label className="mb-2 block">Target Countries</Label>
            <CountrySelector
              selectedIds={selectedCountryIds}
              onSelectionChange={(ids) => {
                setSelectedCountryIds(ids);
                setRunSimulation(false);
              }}
            />
          </div>

          <Button
            onClick={() => setRunSimulation(true)}
            disabled={selectedCountryIds.length === 0}
            className="w-full"
          >
            <Play className="mr-2 h-4 w-4" />
            Run Simulation
          </Button>
        </div>

        {/* Results */}
        <div>
          {!runSimulation ? (
            <div className="border-separator rounded-row flex flex-col items-center justify-center border border-dashed py-20 text-center">
              <FlaskConical className="text-label-secondary mb-3 h-10 w-10" />
              <p className="text-label font-medium">Configure & Run</p>
              <p className="text-label-secondary text-body mt-1">
                Set parameters and select countries, then click Run Simulation.
              </p>
            </div>
          ) : simulation.isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="text-tint h-8 w-8 animate-spin" />
              <p className="text-label-secondary text-body mt-3">Simulating...</p>
            </div>
          ) : simulation.data ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border-separator rounded-control border p-3 text-center">
                  <div className="text-label-secondary text-footnote">Countries</div>
                  <div className="text-label text-title-2">
                    {simulation.data.summary.totalCountriesAffected}
                  </div>
                </div>
                <div className="border-separator rounded-control border p-3 text-center">
                  <div className="text-label-secondary text-footnote">Avg GDP</div>
                  <div
                    className={`text-title-2 ${
                      simulation.data.summary.avgGdpChange < 0 ? "text-red" : "text-green"
                    }`}
                  >
                    {simulation.data.summary.avgGdpChange >= 0 ? "+" : ""}
                    {(simulation.data.summary.avgGdpChange * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="border-separator rounded-control border p-3 text-center">
                  <div className="text-label-secondary text-footnote">At Risk</div>
                  <div className="text-label text-title-2">
                    {formatCurrency(simulation.data.summary.totalGdpAtRisk)}
                  </div>
                </div>
              </div>

              {/* Per-country breakdown */}
              <ScrollArea className="border-separator rounded-control h-[360px] border">
                <div className="space-y-2 p-3">
                  {simulation.data.projectedImpacts.map((p) => (
                    <div
                      key={p.countryId}
                      className="border-separator rounded-control flex items-center justify-between border p-3"
                    >
                      <div>
                        <div className="text-label text-body font-medium">{p.countryName}</div>
                        <div className="text-label-secondary text-footnote">
                          {p.economicTier} - GDP: {formatCurrency(p.current.gdp)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <div className="text-label-secondary text-footnote">GDP</div>
                          <div
                            className={`text-body flex items-center gap-1 font-medium tabular-nums ${
                              p.projected.gdpChange < 0 ? "text-red" : "text-green"
                            }`}
                          >
                            {p.projected.gdpChange < 0 ? (
                              <TrendingDown className="h-3 w-3" />
                            ) : (
                              <TrendingUp className="h-3 w-3" />
                            )}
                            {(p.projected.gdpChange * 100).toFixed(1)}%
                          </div>
                        </div>
                        <ArrowRight className="text-label-secondary h-4 w-4" />
                        <div>
                          <div className="text-label-secondary text-footnote">Projected</div>
                          <div className="text-label text-body font-medium">
                            {formatCurrency(p.projected.gdp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Apply button */}
              <div className="rounded-control border-yellow/20 bg-yellow/5 border p-3">
                <p className="text-label-secondary text-footnote mb-2">
                  Ready to apply this simulation as a real world event? Use the Event Wizard tab to
                  create it with these parameters.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
