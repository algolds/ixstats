import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Plus, Xmark as X } from "iconoir-react";
import type { DepartmentInput } from "~/types/government";

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
    <div className="border-border/40 bg-card/60 space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Core Operational Functions
        </Label>
        <span className="text-muted-foreground text-xs">{functions.length} Defined</span>
      </div>

      {!isReadOnly && (
        <div className="flex gap-2">
          <Input
            value={newFunction}
            onChange={(e) => setNewFunction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFunction();
              }
            }}
            placeholder="Add operational function or mandate..."
            className="h-8 text-xs font-medium"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={addFunction}
            disabled={!newFunction.trim()}
            className="h-8 shrink-0 gap-1 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {functions.map((fn, idx) => (
          <Badge key={idx} variant="secondary" className="gap-1.5 px-2.5 py-1 text-xs font-normal">
            <span>{fn}</span>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => removeFunction(idx)}
                className="text-muted-foreground transition-colors hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}

        {functions.length === 0 && (
          <p className="text-muted-foreground py-1 text-xs">
            No specific operational functions listed yet.
          </p>
        )}
      </div>
    </div>
  );
});
