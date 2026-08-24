// src/app/admin/calculations/CalculationEditor.tsx
// Formula & Macro Simulation Engine Editor
"use client";

import { useState, useEffect } from "react";
import {
  Calculator,
  FloppyDisk as Save,
  Play,
  WarningTriangle as AlertTriangle,
  CheckCircle,
  StatUp as TrendingUp,
  Dollar as DollarSign,
  Group as Users,
  Globe,
  EditPencil as Pencil,
  Code,
  Search,
} from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

import {
  type CalculationModule,
  type TestCase,
  type CalculationResult,
  CALCULATION_CATEGORIES,
} from "./calculation-types";
import { SYSTEM_FORMULAS } from "./system-formulas";
import { CalculationSimulator } from "./CalculationSimulator";

export function CalculationEditor() {
  const notify = useNotify();

  // State
  const [selectedModule, setSelectedModule] = useState<CalculationModule | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [modules, setModules] = useState<CalculationModule[]>(SYSTEM_FORMULAS);

  // Sandbox simulation states
  const [sandboxInputs, setSandboxInputs] = useState<Record<string, number>>({});
  const [sandboxResult, setSandboxResult] = useState<CalculationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Queries
  const { data: formulasData } = api.formulas.getAll.useQuery();
  const testFormulaMutation = api.formulas.testFormula.useMutation();
  const updateFormulaMutation = api.formulas.update.useMutation();

  // Merge API formulas
  useEffect(() => {
    if (formulasData?.formulas) {
      const apiModules: CalculationModule[] = formulasData.formulas.map((f: any) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        category: (f.category || "economic") as CalculationModule["category"],
        formula: f.formula,
        variables: f.variables as Record<string, number | string | string[]>,
        constants: f.constants as Record<string, number>,
        dependencies: [],
        testCases: [],
        lastModified: f.lastModified,
        modifiedBy: f.modifiedBy,
        isActive: f.isActive,
        version: f.version,
      }));

      const apiFormulaIds = new Set(apiModules.map((m) => m.id));
      const mergedModules = [
        ...apiModules,
        ...SYSTEM_FORMULAS.filter((m) => !apiFormulaIds.has(m.id)),
      ];
      setModules(mergedModules);
    }
  }, [formulasData]);

  // Set default selected module
  useEffect(() => {
    if (!selectedModule && modules.length > 0) {
      setSelectedModule(modules[0] || null);
    }
  }, [modules, selectedModule]);

  // Reset sandbox when selected module changes
  useEffect(() => {
    if (selectedModule) {
      const inputs: Record<string, number> = {};
      Object.entries(selectedModule.variables).forEach(([key, value]) => {
        inputs[key] = typeof value === "number" ? value : 0;
      });
      setSandboxInputs(inputs);
      setSandboxResult(null);
    }
  }, [selectedModule?.id]);

  const handleRunSimulation = async () => {
    if (!selectedModule) return;
    setIsSimulating(true);
    try {
      const result = await testFormulaMutation.mutateAsync({
        formulaId: selectedModule.id,
        testInputs: sandboxInputs,
      });

      setSandboxResult({
        success: result.passed ?? true,
        result: result.result,
        executionTime: result.executionTime,
        intermediateSteps: result.intermediateSteps,
      });
    } catch (error) {
      setSandboxResult({
        success: false,
        error: error instanceof Error ? error.message : "Calculation failed",
        executionTime: 0,
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSaveModule = async () => {
    if (!selectedModule) return;
    try {
      await updateFormulaMutation.mutateAsync({
        id: selectedModule.id,
        name: selectedModule.name,
        description: selectedModule.description,
        formula: selectedModule.formula,
        variables: Object.entries(selectedModule.variables).reduce(
          (acc, [key, val]) => {
            if (typeof val === "number") acc[key] = val;
            return acc;
          },
          {} as Record<string, number>
        ),
        constants: selectedModule.constants,
        isActive: selectedModule.isActive,
      });
      notify.success("Success", "Formula updated successfully");
      setIsEditing(false);
    } catch (error) {
      notify.error("Error", error instanceof Error ? error.message : "Failed to update formula");
    }
  };

  const filteredModules = modules.filter(
    (m) =>
      m.name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
      m.category.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      {/* Sidebar List */}
      <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs space-y-3 lg:col-span-1">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search formulas..."
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            className="h-8 rounded-xl border-border/30 bg-background/50 pl-8 text-xs"
          />
        </div>
        <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-0.5">
          {filteredModules.map((module) => {
            const cat = CALCULATION_CATEGORIES[module.category] || CALCULATION_CATEGORIES.economic;
            const Icon = cat.icon;
            const isSelected = selectedModule?.id === module.id;

            return (
              <button
                key={module.id}
                onClick={() => {
                  setSelectedModule(module);
                  setIsEditing(false);
                }}
                className={`flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition-all active:scale-[0.98] ${
                  isSelected
                    ? "border-primary/40 bg-primary/10 border text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
                }`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cat.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{module.name}</p>
                  <p className="text-muted-foreground truncate text-[10px] capitalize">
                    {module.category}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Detail / Editor */}
      <div className="space-y-6 lg:col-span-3">
        {selectedModule ? (
          <>
            <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-4">
              <div className="flex flex-col gap-3 border-b border-border/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">
                      {selectedModule.name}
                    </h3>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {selectedModule.category}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs mt-1">
                    {selectedModule.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        className="h-8 rounded-xl px-3 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveModule}
                        disabled={updateFormulaMutation.isPending}
                        className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98]"
                      >
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                        {updateFormulaMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                      className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98]"
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit Formula
                    </Button>
                  )}
                </div>
              </div>

              {/* Code / Formula Display */}
              <div className="space-y-2">
                <label className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                  Mathematical Formula (JavaScript Expression)
                </label>
                {isEditing ? (
                  <Textarea
                    value={selectedModule.formula}
                    onChange={(e) =>
                      setSelectedModule((prev) =>
                        prev ? { ...prev, formula: e.target.value } : null
                      )
                    }
                    rows={4}
                    className="font-mono text-xs leading-relaxed rounded-xl border-border/30 bg-background/50"
                  />
                ) : (
                  <div className="rounded-xl border border-border/20 bg-background/30 p-3.5 font-mono text-xs text-cyan-400">
                    <code>{selectedModule.formula}</code>
                  </div>
                )}
              </div>
            </div>

            {/* Interactive Sandbox Simulator */}
            <CalculationSimulator
              selectedModule={selectedModule}
              sandboxInputs={sandboxInputs}
              setSandboxInputs={setSandboxInputs}
              sandboxResult={sandboxResult}
              isSimulating={isSimulating}
              onRunSimulation={handleRunSimulation}
            />
          </>
        ) : (
          <div className="rounded-2xl border border-border/30 bg-card/25 p-12 text-center backdrop-blur-md">
            <Calculator className="text-muted-foreground mx-auto h-8 w-8 mb-2" />
            <p className="text-muted-foreground text-xs">Select a formula module to inspect and simulate.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CalculationEditor;
