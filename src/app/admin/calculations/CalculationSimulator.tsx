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
    <div className="border-border/30 bg-card/25 space-y-4 rounded-2xl border p-5 shadow-xs backdrop-blur-md">
      <div className="border-border/20 flex items-center justify-between border-b pb-3">
        <h4 className="text-foreground text-xs font-bold">Interactive Sandbox</h4>
        <Button
          onClick={onRunSimulation}
          disabled={isSimulating}
          size="sm"
          className="h-8 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-[0.98]"
        >
          {isSimulating ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="mr-1.5 h-3.5 w-3.5" />
          )}
          Run Calculation
        </Button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(selectedModule.variables).map(([key, defaultValue]) => (
            <div key={key} className="space-y-1">
              <label className="text-muted-foreground block font-mono text-[11px]">{key}</label>
              <Input
                type="number"
                value={sandboxInputs[key] ?? (typeof defaultValue === "number" ? defaultValue : 0)}
                onChange={(e) =>
                  setSandboxInputs((prev) => ({
                    ...prev,
                    [key]: parseFloat(e.target.value) || 0,
                  }))
                }
                className="border-border/30 bg-background/50 h-8 rounded-xl font-mono text-xs"
              />
            </div>
          ))}
        </div>

        {/* Results */}
        {sandboxResult && (
          <div
            className={`rounded-xl border p-4 text-xs ${
              sandboxResult.success
                ? "border-emerald-500/20 bg-emerald-500/10"
                : "border-red-500/20 bg-red-500/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {sandboxResult.success ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                )}
                <span className="text-foreground font-semibold">
                  {sandboxResult.success ? "Calculation Successful" : "Execution Error"}
                </span>
              </div>
              {sandboxResult.executionTime > 0 && (
                <span className="text-muted-foreground font-mono text-[10px]">
                  {sandboxResult.executionTime.toFixed(1)}ms
                </span>
              )}
            </div>

            {sandboxResult.result !== undefined && (
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-muted-foreground">Computed Output:</span>
                <span className="font-mono text-base font-bold text-emerald-400">
                  {typeof sandboxResult.result === "number"
                    ? sandboxResult.result.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })
                    : sandboxResult.result}
                </span>
              </div>
            )}

            {sandboxResult.error && <p className="mt-2 text-red-300">{sandboxResult.error}</p>}

            {sandboxResult.intermediateSteps && (
              <div className="border-border/20 mt-3 border-t pt-2">
                <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase">
                  Intermediate Variables
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                  {Object.entries(sandboxResult.intermediateSteps).map(([k, v]) => (
                    <div key={k} className="flex justify-between font-mono">
                      <span className="text-muted-foreground">{k}:</span>
                      <span className="text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
