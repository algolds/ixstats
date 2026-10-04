import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Plus, Xmark as X } from "iconoir-react";
import type { DepartmentInput } from "~/types/government";
import { Card } from "~/components/ui/card";

interface DepartmentFunctionsManagerProps {
  data: DepartmentInput;
  onChange: (data: DepartmentInput) => void;
  isReadOnly?: boolean;
}

export const DepartmentFunctionsManager = React.memo(function DepartmentFunctionsManager({
  data,
  onChange,
  isReadOnly,
}: DepartmentFunctionsManagerProps) {
  const [newFunction, setNewFunction] = useState("");
  const functions = data.functions || [];

  const addFunction = () => {
    if (!newFunction.trim()) return;
    onChange({ ...data, functions: [...functions, newFunction.trim()] });
    setNewFunction("");
  };

  const removeFunction = (index: number) => {
    onChange({ ...data, functions: functions.filter((_, i) => i !== index) });
  };

  return (
    <Card variant="well" className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="dept-new-function" className="text-label text-headline">
          Core operational functions
        </Label>
        <span className="text-label-secondary text-footnote">{functions.length} Defined</span>
      </div>

      {!isReadOnly && (
        <div className="flex gap-2">
          <Input
            id="dept-new-function"
            value={newFunction}
            onChange={(e) => setNewFunction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFunction();
              }
            }}
            placeholder="Add operational function or mandate..."
            className="text-caption h-8"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={addFunction}
            disabled={!newFunction.trim()}
            className="text-footnote h-8 shrink-0 gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {functions.map((fn, idx) => (
          <Badge key={idx} variant="default" className="text-footnote gap-2 px-3 py-1 font-normal">
            <span>{fn}</span>
            {!isReadOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeFunction(idx)}
                aria-label={`Remove ${fn}`}
                className="text-label-secondary hover:text-destructive rounded-control-sm size-5 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Badge>
        ))}

        {functions.length === 0 && (
          <p className="text-label-secondary text-footnote py-1">
            No specific operational functions listed yet.
          </p>
        )}
      </div>
    </Card>
  );
});
