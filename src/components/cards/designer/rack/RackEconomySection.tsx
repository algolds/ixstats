import React from "react";
import { Input } from "~/components/ui/input";
import type { CardDesignState } from "../types";

interface RackEconomySectionProps {
  state: CardDesignState;
  onChange: (updater: (prev: CardDesignState) => CardDesignState) => void;
}

export const RackEconomySection = React.memo(function RackEconomySection({
  state,
  onChange,
}: RackEconomySectionProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-muted-foreground mb-1 block text-xs font-medium">
          Market Value (IxCredits)
        </label>
        <Input
          type="number"
          value={state.marketValue}
          onChange={(e) =>
            onChange((p) => ({
              ...p,
              marketValue: Number(e.target.value) || 0,
              useAutoValuation: false,
            }))
          }
          className="h-8 font-mono text-xs"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-foreground block text-xs font-medium">
            Limited Supply Print Run
          </span>
          <span className="text-muted-foreground text-[10px]">Cap total prints in circulation</span>
        </div>
        <input
          type="checkbox"
          checked={state.isLimitedSupply}
          onChange={(e) =>
            onChange((p) => ({
              ...p,
              isLimitedSupply: e.target.checked,
              totalSupply: e.target.checked ? p.totalSupply || 100 : null,
            }))
          }
          className="accent-primary h-4 w-4 rounded-md"
        />
      </div>

      {state.isLimitedSupply && (
        <div>
          <label className="text-muted-foreground mb-1 block text-xs font-medium">
            Total Supply Cap
          </label>
          <Input
            type="number"
            min="1"
            value={state.totalSupply ?? 100}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                totalSupply: Number(e.target.value) || 1,
              }))
            }
            className="h-8 font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
});
