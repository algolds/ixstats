"use client";

import { Play, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { useSystemValidation } from "~/hooks/useSystemValidation";
import { getStatusColor, getStatusBgColor } from "~/lib/system-validation";
import { ValidationCategory } from "./validation/ValidationCategory";
import { AuditProgressBar } from "./validation/AuditProgressBar";

export function SystemValidationDashboard() {
  const {
    categories,
    summary,
    isLoading,
    isRunning,
    progress,
    totalCategories,
    lastAuditTime,
    runAudit,
    errors,
  } = useSystemValidation();

  const errorList = Object.entries(errors).filter(([, err]) => err != null);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Button onClick={runAudit} disabled={isLoading} size="lg" className="gap-2">
                <Play className="h-4 w-4" />
                {isLoading ? "Running Audit..." : "Run Full Audit"}
              </Button>
              {lastAuditTime && (
                <span className="text-muted-foreground text-sm">
                  Last run: {new Date(lastAuditTime).toLocaleTimeString()}
                </span>
              )}
            </div>

            {summary && (
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`gap-1.5 px-3 py-1.5 text-sm ${getStatusBgColor(summary.overallStatus)} ${getStatusColor(summary.overallStatus)}`}
                >
                  {summary.overallStatus === "pass" && <CheckCircle className="h-3.5 w-3.5" />}
                  {summary.overallStatus === "warn" && <AlertTriangle className="h-3.5 w-3.5" />}
                  {summary.overallStatus === "fail" && <XCircle className="h-3.5 w-3.5" />}
                  {summary.overallStatus === "pass"
                    ? "All Systems Operational"
                    : summary.overallStatus === "warn"
                      ? "Warnings Detected"
                      : "Issues Found"}
                </Badge>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {isLoading && (
            <div className="mt-4">
              <AuditProgressBar progress={progress} total={totalCategories} isRunning={isRunning} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error banner */}
      {errorList.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-400">Some checks failed to execute</p>
                {errorList.map(([key, err]) => (
                  <p key={key} className="text-xs text-red-400/70">
                    {key}: {(err as any)?.message || String(err)}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category grid */}
      {categories.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <ValidationCategory key={category.category} category={category} />
          ))}
        </div>
      ) : (
        !isRunning && (
          <Card className="border-border/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No Audit Results</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Click &quot;Run Full Audit&quot; to validate all platform subsystems, database connectivity,
                authentication, and economic engine health.
              </p>
            </CardContent>
          </Card>
        )
      )}

      {/* Summary */}
      {summary && (
        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-5">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Total Checks</p>
                <p className="text-foreground text-2xl font-bold tabular-nums">{summary.totalChecks}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-green-400">Passed</p>
                <p className="text-2xl font-bold tabular-nums text-green-400">{summary.passed}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-amber-400">Warnings</p>
                <p className="text-2xl font-bold tabular-nums text-amber-400">{summary.warnings}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-red-400">Failures</p>
                <p className="text-2xl font-bold tabular-nums text-red-400">{summary.failures}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Duration</p>
                <p className="text-foreground text-2xl font-bold tabular-nums">{summary.duration}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
