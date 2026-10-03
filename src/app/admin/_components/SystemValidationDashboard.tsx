"use client";

import {
  Play,
  CheckCircle,
  WarningTriangle as AlertTriangle,
  XmarkCircle as XCircle,
  Clock,
} from "iconoir-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { useSystemValidation } from "~/hooks/useSystemValidation";
import { getStatusColor, getStatusBgColor } from "~/lib/system/system-validation";
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
      <Card className="flex flex-col gap-6 py-6">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Button onClick={runAudit} disabled={isLoading} size="lg" className="gap-2">
                <Play className="h-4 w-4" />
                {isLoading ? "Running Audit..." : "Run Full Audit"}
              </Button>
              {lastAuditTime && (
                <span className="text-label-secondary text-body">
                  Last run: {new Date(lastAuditTime).toLocaleTimeString()}
                </span>
              )}
            </div>

            {summary && (
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`text-body gap-2 px-3 py-2 ${getStatusBgColor(summary.overallStatus)} ${getStatusColor(summary.overallStatus)}`}
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

          {isLoading && (
            <div className="mt-4">
              <AuditProgressBar progress={progress} total={totalCategories} isRunning={isRunning} />
            </div>
          )}
        </CardContent>
      </Card>

      {errorList.length > 0 && (
        <Card className="border-red/20 bg-red/5 flex flex-col gap-6 py-6">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <XCircle className="text-red mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-1">
                <p className="text-body text-red font-medium">Some checks failed to execute</p>
                {errorList.map(([key, err]) => (
                  <p key={key} className="text-footnote text-red">
                    {key}: {(err as any)?.message || String(err)}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {categories.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <ValidationCategory key={category.category} category={category} />
          ))}
        </div>
      ) : (
        !isRunning && (
          <Card className="flex flex-col gap-6 py-6">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="text-label-tertiary mb-4 h-12 w-12" />
              <h3 className="text-label text-title-3 mb-1">No audit results</h3>
              <p className="text-label-secondary text-body max-w-sm">
                Click &quot;Run Full Audit&quot; to validate all platform subsystems, database
                connectivity, authentication, and economic engine health.
              </p>
            </CardContent>
          </Card>
        )
      )}

      {summary && (
        <Card className="flex flex-col gap-6 py-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-5">
              <div>
                <span className="text-stat-label text-label-secondary block">Total checks</span>
                <p className="text-label text-title-1 tabular-nums">{summary.totalChecks}</p>
              </div>
              <div>
                <p className="text-stat-label text-green">Passed</p>
                <p className="text-title-1 text-green tabular-nums">{summary.passed}</p>
              </div>
              <div>
                <p className="text-stat-label text-yellow">Warnings</p>
                <p className="text-title-1 text-yellow tabular-nums">{summary.warnings}</p>
              </div>
              <div>
                <p className="text-stat-label text-red">Failures</p>
                <p className="text-title-1 text-red tabular-nums">{summary.failures}</p>
              </div>
              <div>
                <span className="text-stat-label text-label-secondary block">Duration</span>
                <p className="text-label text-title-1 tabular-nums">{summary.duration}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
