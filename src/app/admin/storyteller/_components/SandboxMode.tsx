// src/app/admin/storyteller/_components/SandboxMode.tsx
// Simulate world events without applying them to the database
"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
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
  FlaskConical,
  Play,
  Loader2,
  TrendingDown,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

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

  const fmtBig = (n: number) => {
    if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-indigo-500" />
        <h3 className="text-foreground text-lg font-semibold">Sandbox Mode</h3>
        <Badge variant="outline" className="border-indigo-500/20 text-indigo-600">
          No changes applied
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Configuration */}
        <div className="space-y-5">
          <div>
            <Label>Event Type</Label>
            <Select value={type} onValueChange={(v) => { setType(v); setRunSimulation(false); }}>
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
              <span className="text-foreground text-sm font-medium">
                {(severity * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[severity]}
              onValueChange={([v]) => { setSeverity(v); setRunSimulation(false); }}
              min={0.05}
              max={1}
              step={0.05}
              className="mt-2"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Duration (years)</Label>
              <span className="text-foreground text-sm font-medium">{duration}</span>
            </div>
            <Slider
              value={[duration]}
              onValueChange={([v]) => { setDuration(v); setRunSimulation(false); }}
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
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-20 text-center">
              <FlaskConical className="text-muted-foreground mb-3 h-10 w-10" />
              <p className="text-foreground font-medium">Configure & Run</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Set parameters and select countries, then click Run Simulation.
              </p>
            </div>
          ) : simulation.isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground mt-3 text-sm">Simulating...</p>
            </div>
          ) : simulation.data ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border/50 p-3 text-center">
                  <div className="text-muted-foreground text-xs">Countries</div>
                  <div className="text-foreground text-xl font-bold">
                    {simulation.data.summary.totalCountriesAffected}
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 p-3 text-center">
                  <div className="text-muted-foreground text-xs">Avg GDP</div>
                  <div
                    className={`text-xl font-bold ${
                      simulation.data.summary.avgGdpChange < 0
                        ? "text-red-500"
                        : "text-green-500"
                    }`}
                  >
                    {simulation.data.summary.avgGdpChange >= 0 ? "+" : ""}
                    {(simulation.data.summary.avgGdpChange * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 p-3 text-center">
                  <div className="text-muted-foreground text-xs">At Risk</div>
                  <div className="text-foreground text-xl font-bold">
                    {fmtBig(simulation.data.summary.totalGdpAtRisk)}
                  </div>
                </div>
              </div>

              {/* Per-country breakdown */}
              <ScrollArea className="h-[360px] rounded-lg border border-border/50">
                <div className="space-y-2 p-3">
                  {simulation.data.projectedImpacts.map((p) => (
                    <div
                      key={p.countryId}
                      className="flex items-center justify-between rounded-lg border border-border/20 p-3"
                    >
                      <div>
                        <div className="text-foreground text-sm font-medium">
                          {p.countryName}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {p.economicTier} - GDP: {fmtBig(p.current.gdp)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <div className="text-muted-foreground text-xs">GDP</div>
                          <div
                            className={`flex items-center gap-1 text-sm font-mono font-medium ${
                              p.projected.gdpChange < 0
                                ? "text-red-500"
                                : "text-green-500"
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
                        <ArrowRight className="text-muted-foreground h-4 w-4" />
                        <div>
                          <div className="text-muted-foreground text-xs">Projected</div>
                          <div className="text-foreground text-sm font-medium">
                            {fmtBig(p.projected.gdp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Apply button */}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-muted-foreground mb-2 text-xs">
                  Ready to apply this simulation as a real world event? Use the Event
                  Wizard tab to create it with these parameters.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
