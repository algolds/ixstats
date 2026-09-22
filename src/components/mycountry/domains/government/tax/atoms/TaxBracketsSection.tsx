import React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { Plus, Trash as Trash2, Sparks as Sparkles } from "iconoir-react";
import type { TaxBracketInput } from "~/types/tax-system";

export interface TaxBracketsSectionProps {
  brackets: TaxBracketInput[];
  isReadOnly?: boolean;
  isSyncedFromRevenue?: boolean;
  onApplyStandardBrackets?: () => void;
  onAddBracket: () => void;
  onUpdateBracket: (index: number, bracket: TaxBracketInput) => void;
  onRemoveBracket: (index: number) => void;
}

export function TaxBracketsSection({
  brackets,
  isReadOnly = false,
  isSyncedFromRevenue,
  onApplyStandardBrackets,
  onAddBracket,
  onUpdateBracket,
  onRemoveBracket,
}: TaxBracketsSectionProps) {
  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <h5 className="font-medium">Tax Brackets</h5>
        <div className="flex items-center gap-2">
          {isSyncedFromRevenue && onApplyStandardBrackets && !isReadOnly && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onApplyStandardBrackets}
                    className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Apply Standard Brackets
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Apply the recommended tax brackets for this revenue source</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!isReadOnly && (
            <Button variant="outline" size="sm" onClick={onAddBracket}>
              <Plus className="mr-2 h-4 w-4" />
              Add Bracket
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {brackets.map((bracket, index) => (
          <div key={index} className="bg-muted rounded-lg p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-xs">Min Income</Label>
                <Input
                  type="number"
                  value={bracket.minIncome}
                  onChange={(e) =>
                    onUpdateBracket(index, {
                      ...bracket,
                      minIncome: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={isReadOnly}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Max Income</Label>
                <Input
                  type="number"
                  value={bracket.maxIncome || ""}
                  onChange={(e) =>
                    onUpdateBracket(index, {
                      ...bracket,
                      maxIncome: parseFloat(e.target.value) || undefined,
                    })
                  }
                  placeholder="No limit"
                  disabled={isReadOnly}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Tax Rate (%)</Label>
                <Input
                  type="number"
                  value={bracket.rate}
                  onChange={(e) =>
                    onUpdateBracket(index, {
                      ...bracket,
                      rate: parseFloat(e.target.value) || 0,
                    })
                  }
                  step="0.1"
                  disabled={isReadOnly}
                />
              </div>

              <div className="flex items-end">
                {!isReadOnly && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onRemoveBracket(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
