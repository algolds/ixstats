import React from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Plus, Xmark as X } from "iconoir-react";
import type {
  TaxExemption,
  TaxDeduction,
  TaxDeductionAmount,
  TaxExemptionAmount,
} from "~/types/tax-system";

interface TaxSimulatorInputsProps {
  income: string;
  setIncome: (v: string) => void;
  taxYear: number;
  setTaxYear: (v: number) => void;
  calculatorMode: "individual" | "corporate" | "both";
  deductions: TaxDeduction[];
  exemptions: TaxExemption[];
  selectedDeductions: TaxDeductionAmount[];
  selectedExemptions: TaxExemptionAmount[];
  setSelectedDeductions: React.Dispatch<React.SetStateAction<TaxDeductionAmount[]>>;
  setSelectedExemptions: React.Dispatch<React.SetStateAction<TaxExemptionAmount[]>>;
}

export const TaxSimulatorInputs = React.memo(function TaxSimulatorInputs({
  income,
  setIncome,
  taxYear,
  setTaxYear,
  calculatorMode,
  deductions,
  exemptions,
  selectedDeductions,
  selectedExemptions,
  setSelectedDeductions,
  setSelectedExemptions,
}: TaxSimulatorInputsProps) {
  const addDeduction = (deductionId: string) => {
    const d = deductions.find((item) => item.id === deductionId);
    if (!d || selectedDeductions.some((item) => item.deductionId === deductionId)) return;
    setSelectedDeductions([
      ...selectedDeductions,
      { deductionId, amount: d.maximumAmount || 5000, description: d.deductionName },
    ]);
  };

  const removeDeduction = (deductionId: string) => {
    setSelectedDeductions(selectedDeductions.filter((item) => item.deductionId !== deductionId));
  };

  const addExemption = (exemptionId: string) => {
    const e = exemptions.find((item) => item.id === exemptionId);
    if (!e || selectedExemptions.some((item) => item.exemptionId === exemptionId)) return;
    setSelectedExemptions([
      ...selectedExemptions,
      { exemptionId, amount: e.exemptionAmount || 10000, description: e.exemptionName },
    ]);
  };

  const removeExemption = (exemptionId: string) => {
    setSelectedExemptions(selectedExemptions.filter((item) => item.exemptionId !== exemptionId));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="income">
            {calculatorMode === "individual" ? "Annual Income" : "Corporate Revenue"}
          </Label>
          <Input
            id="income"
            type="number"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            placeholder={calculatorMode === "individual" ? "e.g. 75000" : "e.g. 500000"}
            className="text-lg"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxYear">Tax Year</Label>
          <Input
            id="taxYear"
            type="number"
            value={taxYear}
            onChange={(e) => setTaxYear(parseInt(e.target.value) || new Date().getFullYear())}
          />
        </div>
      </div>

      {/* Available Deductions and Exemptions */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Deductions */}
        <div className="border-border/40 bg-card/60 space-y-3 rounded-xl border p-4">
          <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Tax Deductions
          </Label>
          <div className="flex flex-wrap gap-2">
            {deductions.map((d) => {
              const isSelected = selectedDeductions.some((item) => item.deductionId === d.id);
              return (
                <Badge
                  key={d.id}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer transition-colors"
                  onClick={() => (isSelected ? removeDeduction(d.id) : addDeduction(d.id))}
                >
                  {d.deductionName}
                  {isSelected ? <X className="ml-1 h-3 w-3" /> : <Plus className="ml-1 h-3 w-3" />}
                </Badge>
              );
            })}
            {deductions.length === 0 && (
              <p className="text-muted-foreground text-xs">
                No deductions configured in tax system.
              </p>
            )}
          </div>
        </div>

        {/* Exemptions */}
        <div className="border-border/40 bg-card/60 space-y-3 rounded-xl border p-4">
          <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Tax Exemptions
          </Label>
          <div className="flex flex-wrap gap-2">
            {exemptions.map((e) => {
              const isSelected = selectedExemptions.some((item) => item.exemptionId === e.id);
              return (
                <Badge
                  key={e.id}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer transition-colors"
                  onClick={() => (isSelected ? removeExemption(e.id) : addExemption(e.id))}
                >
                  {e.exemptionName}
                  {isSelected ? <X className="ml-1 h-3 w-3" /> : <Plus className="ml-1 h-3 w-3" />}
                </Badge>
              );
            })}
            {exemptions.length === 0 && (
              <p className="text-muted-foreground text-xs">
                No exemptions configured in tax system.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
