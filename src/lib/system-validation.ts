/**
 * System Validation Business Logic
 * Pure functions for system health check validation and reporting.
 */

export type CheckStatus = "pass" | "warn" | "fail" | "running" | "pending";

export interface ValidationCheck {
  name: string;
  status: CheckStatus;
  details: string;
  count?: number;
}

export interface ValidationCategory {
  category: string;
  checks: ValidationCheck[];
  duration: number;
}

export interface AuditSummary {
  totalChecks: number;
  passed: number;
  warnings: number;
  failures: number;
  overallStatus: CheckStatus;
  duration: number;
  completedAt: string;
}

export function calculateAuditSummary(categories: ValidationCategory[]): AuditSummary {
  const allChecks = categories.flatMap((c) => c.checks);
  const passed = allChecks.filter((c) => c.status === "pass").length;
  const warnings = allChecks.filter((c) => c.status === "warn").length;
  const failures = allChecks.filter((c) => c.status === "fail").length;
  const totalDuration = categories.reduce((sum, c) => sum + c.duration, 0);

  let overallStatus: CheckStatus = "pass";
  if (failures > 0) overallStatus = "fail";
  else if (warnings > 0) overallStatus = "warn";

  return {
    totalChecks: allChecks.length,
    passed,
    warnings,
    failures,
    overallStatus,
    duration: totalDuration,
    completedAt: new Date().toISOString(),
  };
}

export function getStatusColor(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "text-green-400";
    case "warn":
      return "text-amber-400";
    case "fail":
      return "text-red-400";
    case "running":
      return "text-blue-400";
    case "pending":
      return "text-gray-400";
  }
}

export function getStatusBgColor(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "bg-green-500/10 border-green-500/20";
    case "warn":
      return "bg-amber-500/10 border-amber-500/20";
    case "fail":
      return "bg-red-500/10 border-red-500/20";
    case "running":
      return "bg-blue-500/10 border-blue-500/20";
    case "pending":
      return "bg-gray-500/10 border-gray-500/20";
  }
}
