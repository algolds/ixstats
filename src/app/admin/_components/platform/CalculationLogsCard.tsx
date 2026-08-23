// src/app/admin/_components/platform/CalculationLogsCard.tsx
"use client";

import { Database, WarningCircle as AlertCircle, Clock, Flash as Zap } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Skeleton } from "~/components/ui/skeleton";
import type { CalculationLog } from "~/types/ixstats";

interface CalculationLogsCardProps {
  logs: CalculationLog[] | undefined;
  isLoading: boolean;
  error?: string | null;
}

export function CalculationLogsCard({ logs, isLoading, error }: CalculationLogsCardProps) {
  return (
    <Card className="facet-surface facet-refraction border-border/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-indigo-500" />
          Recent Calculation Logs
          {logs && logs.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {logs.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Error loading calculation logs: {error}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {!isLoading && !error && (!logs || logs.length === 0) && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="text-muted-foreground/30 mb-3 h-10 w-10" />
            <p className="text-muted-foreground text-sm font-medium">
              No calculation logs available
            </p>
            <p className="text-muted-foreground/70 mt-1 text-xs">
              Logs will appear here after calculations are performed
            </p>
          </div>
        )}

        {!isLoading && !error && logs && logs.length > 0 && (
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className="facet-hierarchy-child border-border/30 rounded-lg border p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-green-500" />
                    <span className="text-foreground text-sm font-medium">
                      {log.countriesUpdated} countries updated
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs tabular-nums">
                    {log.executionTimeMs}ms
                  </Badge>
                </div>

                <div className="text-muted-foreground mt-2 grid grid-cols-1 gap-1 text-xs md:grid-cols-2">
                  <div>
                    <span className="font-medium">Real Time:</span>{" "}
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">IxTime:</span>{" "}
                    {new Date(log.ixTimeTimestamp).toLocaleString()}
                  </div>
                </div>

                <div className="text-muted-foreground/70 mt-1 text-xs">
                  Global Growth Factor: {((log.globalGrowthFactor - 1) * 100).toFixed(2)}%
                  {log.notes && <span className="ml-2">· {log.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
