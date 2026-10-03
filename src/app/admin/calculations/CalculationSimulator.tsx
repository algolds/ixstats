"use client";
// src/app/admin/calculations/CalculationSimulator.tsx

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Play,
  SystemRestart as Loader2,
  CheckCircle,
  WarningTriangle as AlertTriangle,
} from "iconoir-react";
import type { CalculationModule, CalculationResult } from "./calculation-types";
import { Card } from "~/components/ui/card";

interface CalculationSimulatorProps {
  selectedModule: CalculationModule;
  sandboxInputs: Record<string, number>;
  setSandboxInputs: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  sandboxResult: CalculationResult | null;
  isSimulating: boolean;
  onRunSimulation: () => void;
}

export function CalculationSimulator({
  selectedModule,
  sandboxInputs,
  setSandboxInputs,
  sandboxResult,
  isSimulating,
  onRunSimulation,
}: CalculationSimulatorProps) {
  return (
    <Card className="space-y-4 p-5">
      <div className="border-separator flex items-center justify-between border-b pb-3">
        <h4 className="text-label text-caption">Interactive Sandbox</h4>
        <Button onClick={onRunSimulation} disabled={isSimulating} size="sm">
          {isSimulating ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="mr-2 h-3.5 w-3.5" />
          )}
          Run Calculation
        </Button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(selectedModule.variables).map(([key, defaultValue]) => (
            <div key={key} className="space-y-1">
              <label className="text-label-secondary text-footnote block font-mono">{key}</label>
              <Input
                type="number"
                value={sandboxInputs[key] ?? (typeof defaultValue === "number" ? defaultValue : 0)}
                onChange={(e) =>
                  setSandboxInputs((prev) => ({
                    ...prev,
                    [key]: parseFloat(e.target.value) || 0,
                  }))
                }
                className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
              />
            </div>
          ))}
        </div>

        {/* Results */}
        {sandboxResult && (
          <div
            className={`rounded-row text-footnote border p-4 ${
              sandboxResult.success ? "border-green/20 bg-green/10" : "border-red/20 bg-red/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {sandboxResult.success ? (
                  <CheckCircle className="text-green h-4 w-4" />
                ) : (
                  <AlertTriangle className="text-red h-4 w-4" />
                )}
                <span className="text-label font-semibold">
                  {sandboxResult.success ? "Calculation Successful" : "Execution Error"}
                </span>
              </div>
              {sandboxResult.executionTime > 0 && (
                <span className="text-label-secondary text-footnote tabular-nums">
                  {sandboxResult.executionTime.toFixed(1)}ms
                </span>
              )}
            </div>

            {sandboxResult.result !== undefined && (
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-label-secondary">Computed Output:</span>
                <span className="text-headline text-green tabular-nums">
                  {typeof sandboxResult.result === "number"
                    ? sandboxResult.result.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })
                    : sandboxResult.result}
                </span>
              </div>
            )}

            {sandboxResult.error && <p className="text-red mt-2">{sandboxResult.error}</p>}

            {sandboxResult.intermediateSteps && (
              <div className="border-separator mt-3 border-t pt-2">
                <p className="text-label-secondary text-eyebrow mb-1">Intermediate Variables</p>
                <div className="text-footnote grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Object.entries(sandboxResult.intermediateSteps).map(([k, v]) => (
                    <div key={k} className="flex justify-between tabular-nums">
                      <span className="text-label-secondary">{k}:</span>
                      <span className="text-label">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
