import React from "react";
import { LightBulb, CheckCircle as CheckCircle2 } from "iconoir-react";
import { Alert, AlertDescription } from "~/components/ui/alert";

interface TaxOptimizationTipsProps {
  suggestions: string[];
  formatCurrency?: (amount: number) => string;
}

export const TaxOptimizationTips = React.memo(function TaxOptimizationTips({
  suggestions,
}: TaxOptimizationTipsProps) {
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="border-border/50 flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
        <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
        <p className="text-muted-foreground text-sm">
          Tax schedule is currently well-optimized for this income profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((tip, idx) => (
        <Alert key={idx} className="border-amber-500/20 bg-amber-500/5">
          <LightBulb className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-foreground text-xs">{tip}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
});
