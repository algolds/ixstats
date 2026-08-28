import React from "react";
import { Progress } from "~/components/ui/progress";
import { Badge } from "~/components/ui/badge";
import type { TaxCalculationResult } from "~/types/tax-system";

interface TaxBracketBreakdownProps {
  calculationResult: TaxCalculationResult | null;
  formatCurrency: (amount: number) => string;
  formatPercentage: (rate: number) => string;
}

export const TaxBracketBreakdown = React.memo(function TaxBracketBreakdown({
  calculationResult,
  formatCurrency,
  formatPercentage,
}: TaxBracketBreakdownProps) {
  if (
    !calculationResult ||
    !calculationResult.breakdown ||
    calculationResult.breakdown.length === 0
  ) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        No bracket breakdown available for the current calculation.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-border/40 bg-card/60 space-y-3 rounded-xl border p-4">
        <h4 className="text-foreground text-sm font-semibold">Tax Category Breakdown</h4>
        <div className="space-y-3">
          {calculationResult.breakdown.map((category, idx) => {
            const pctOfTotal =
              calculationResult.taxOwed > 0
                ? (category.taxOwed / calculationResult.taxOwed) * 100
                : 0;

            return (
              <div key={category.categoryId || idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium">{category.categoryName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {formatCurrency(category.taxOwed)}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {formatPercentage(pctOfTotal)}
                    </Badge>
                  </div>
                </div>
                <Progress value={pctOfTotal} className="h-1.5" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
