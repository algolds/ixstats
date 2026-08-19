"use client";

import { useMemo } from "react";
import { Vote } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { computeApproval, isNewsworthySwing } from "~/lib/government/approval";

interface ApprovalPanelProps {
  countryId: string;
}

/**
 * Live polling: per-party support (moved by the drift cron) plus a derived government
 * approval figure. ponytail: no historical timeline — needs a snapshot table; the bars
 * and the ▲/▼-vs-baseline arrows already read as "the numbers are alive".
 */
export function ApprovalPanel({ countryId }: ApprovalPanelProps) {
  const { data: parties } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const sorted = useMemo(
    () => [...(parties ?? [])].sort((a, b) => b.currentSupport - a.currentSupport),
    [parties]
  );
  const approval = useMemo(
    () =>
      computeApproval(
        sorted.map((p) => ({ id: p.id, currentSupport: p.currentSupport })),
        null
      ),
    [sorted]
  );

  return (
    <div className="glass-hierarchy-child border-border space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Vote className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-semibold">Public Opinion</span>
        </div>
        {sorted.length > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {approval}% govt approval
          </Badge>
        )}
      </div>

      {sorted.length > 0 ? (
        <div className="space-y-2">
          {sorted.map((p) => {
            const delta = p.currentSupport - p.baseSupport;
            const swung = isNewsworthySwing(p.baseSupport, p.currentSupport);
            return (
              <div key={p.id} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="tabular-nums">{p.currentSupport.toFixed(0)}%</span>
                  {Math.abs(delta) >= 0.5 && (
                    <span
                      className={`tabular-nums ${delta > 0 ? "text-green-600" : "text-red-600"} ${swung ? "font-semibold" : ""}`}
                    >
                      {delta > 0 ? "▲" : "▼"}
                      {Math.abs(delta).toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="bg-muted/40 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, p.currentSupport)}%`,
                      backgroundColor: p.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-6 text-center">
          <Vote className="h-8 w-8 opacity-30" />
          <p className="text-sm">No parties to poll</p>
          <p className="text-xs">Form political parties to track public opinion.</p>
        </div>
      )}
    </div>
  );
}
