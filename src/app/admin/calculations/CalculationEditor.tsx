"use client";
// src/app/admin/calculations/CalculationEditor.tsx
// Formula & Macro Simulation Engine Editor

import { useState, useEffect } from "react";
import {
  Calculator,
  FloppyDisk as Save,
  // oxlint-disable-next-line eslint/no-unused-vars
  StatUp as TrendingUp,
  EditPencil as Pencil,
  Search,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

import {
  type CalculationModule,
  type CalculationResult,
  CALCULATION_CATEGORIES,
} from "./calculation-types";
import { SYSTEM_FORMULAS } from "./system-formulas";
import { CalculationSimulator } from "./CalculationSimulator";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Card } from "~/components/ui/card";

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

  // Merge API formulas — sync external API data to local state
  // oxlint-disable-next-line
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

  // Set default selected module — initialise selection once
  // oxlint-disable-next-line
  useEffect(() => {
    if (!selectedModule && modules.length > 0) {
      setSelectedModule(modules[0] || null);
    }
  }, [modules, selectedModule]);

  // Reset sandbox when selected module changes — intentionally keyed on id only
  // oxlint-disable-next-line
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
      <Card className="space-y-3 p-4 lg:col-span-1">
        <div className="relative">
          <Search className="text-label-secondary absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search formulas..."
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
          />
        </div>
        <FacetListSection
          variant="plain"
          aria-label="Formulas"
          groupClassName="max-h-[calc(100vh-280px)] overflow-y-auto"
        >
          {filteredModules.map((module) => {
            const cat = CALCULATION_CATEGORIES[module.category] || CALCULATION_CATEGORIES.economic;
            const Icon = cat.icon;
            return (
              <FacetRow
                key={module.id}
                onClick={() => {
                  setSelectedModule(module);
                  setIsEditing(false);
                }}
                selected={selectedModule?.id === module.id}
                selectionStyle="tint"
                leading={<Icon aria-hidden className={`size-4 ${cat.color}`} />}
                title={module.name}
                subtitle={<span className="capitalize">{module.category}</span>}
              />
            );
          })}
        </FacetListSection>
      </Card>

      {/* Main Detail / Editor */}
      <div className="space-y-6 lg:col-span-3">
        {selectedModule ? (
          <>
            <Card className="space-y-4 p-5">
              <div className="border-separator flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-label text-headline">{selectedModule.name}</h3>
                    <Badge variant="outline" className="capitalize">
                      {selectedModule.category}
                    </Badge>
                  </div>
                  <p className="text-label-secondary text-footnote mt-1">
                    {selectedModule.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveModule}
                        disabled={updateFormulaMutation.isPending}
                      >
                        <Save className="mr-2 h-3.5 w-3.5" />
                        {updateFormulaMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Edit formula
                    </Button>
                  )}
                </div>
              </div>

              {/* Code / Formula Display */}
              <div className="space-y-2">
                <label className="text-label-secondary text-subhead">
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
                    className="md:text-footnote font-mono"
                  />
                ) : (
                  <div className="border-separator bg-fill-3 rounded-row text-footnote text-teal border p-4 font-mono">
                    <code>{selectedModule.formula}</code>
                  </div>
                )}
              </div>
            </Card>

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
          <Card className="p-12 text-center">
            <Calculator className="text-label-secondary mx-auto mb-2 h-8 w-8" />
            <p className="text-label-secondary text-footnote">
              Select a formula module to inspect and simulate.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

export default CalculationEditor;
