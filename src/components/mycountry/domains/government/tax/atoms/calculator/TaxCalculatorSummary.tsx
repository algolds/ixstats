import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Dollar as DollarSign, StatUp as TrendingUp, Calculator } from "iconoir-react";
import type { TaxCalculationResult } from "~/types/tax-system";

interface TaxCalculatorSummaryProps {
  calculationResult: TaxCalculationResult | null;
  corporateCalculationResult: TaxCalculationResult | null;
  calculatorMode: "individual" | "corporate" | "both";
  formatCurrency: (amount: number) => string;
  formatPercentage: (rate: number) => string;
}

export const TaxCalculatorSummary = React.memo(function TaxCalculatorSummary({
  calculationResult,
  corporateCalculationResult,
  calculatorMode,
  formatCurrency,
  formatPercentage,
}: TaxCalculatorSummaryProps) {
  const result = calculatorMode === "individual" ? calculationResult : corporateCalculationResult;

  if (!result) {
    return (
      <div className="border-border/50 flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
        <Calculator className="text-muted-foreground/40 mb-2 h-10 w-10" />
        <p className="text-muted-foreground text-sm">
          Enter an income amount to calculate estimated tax liabilities.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="space-y-1 p-4">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>Total Tax Owed</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-foreground text-2xl font-bold tracking-tight">
            {formatCurrency(result.taxOwed)}
          </p>
          <Badge
            variant="outline"
            className="border-emerald-500/30 text-[10px] text-emerald-600 dark:text-emerald-400"
          >
            Effective Rate: {formatPercentage(result.effectiveRate)}
          </Badge>
        </CardContent>
      </Card>

      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="space-y-1 p-4">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>Taxable Income</span>
            <Calculator className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-foreground text-2xl font-bold tracking-tight">
            {formatCurrency(result.taxableIncome)}
          </p>
          <span className="text-muted-foreground text-[10px]">
            Gross: {formatCurrency(result.grossIncome)}
          </span>
        </CardContent>
      </Card>

      <Card className="border-purple-500/20 bg-purple-500/5">
        <CardContent className="space-y-1 p-4">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>Net Income (Take-home)</span>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-foreground text-2xl font-bold tracking-tight">
            {formatCurrency(result.netIncome)}
          </p>
          <span className="text-muted-foreground text-[10px]">
            Keep Rate: {formatPercentage(100 - result.effectiveRate)}
          </span>
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="space-y-1 p-4">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>Total Relief / Deductions</span>
            <Badge variant="secondary" className="text-[10px]">
              Saved
            </Badge>
          </div>
          <p className="text-foreground text-2xl font-bold tracking-tight">
            {formatCurrency(result.totalDeductions + result.totalExemptions)}
          </p>
          <span className="text-muted-foreground text-[10px]">
            {result.totalDeductions > 0
              ? `Deductions: ${formatCurrency(result.totalDeductions)}`
              : "No deductions applied"}
          </span>
        </CardContent>
      </Card>
    </div>
  );
});
