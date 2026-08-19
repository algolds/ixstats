// src/components/builders/ConflictWarningDialog.tsx
/**
 * Conflict Warning Dialog
 *
 * Displays intelligent conflict warnings when builder data would overwrite existing data.
 * Shows affected systems, severity levels, and allows users to confirm or cancel changes.
 */

"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { AlertTriangle, Info, AlertCircle, Database, CheckCircle2 } from "lucide-react";
import type { ConflictWarning } from "~/server/services/builderIntegrationService";

interface ConflictWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warnings: ConflictWarning[];
  onConfirm: () => void;
  onCancel: () => void;
  builderType: "government" | "tax";
}

export function ConflictWarningDialog({
  open,
  onOpenChange,
  warnings,
  onConfirm,
  onCancel,
  builderType,
}: ConflictWarningDialogProps) {
  const criticalWarnings = warnings.filter((w) => w.severity === "critical");
  const regularWarnings = warnings.filter((w) => w.severity === "warning");
  const infoWarnings = warnings.filter((w) => w.severity === "info");

  const getSeverityIcon = (severity: ConflictWarning["severity"]) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "info":
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: ConflictWarning["severity"]) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "warning":
        return "warning";
      case "info":
        return "default";
    }
  };

  if (warnings.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Confirm {builderType === "government" ? "Government" : "Tax"} Changes
          </DialogTitle>
          <DialogDescription>
            The following changes will affect existing data. Please review carefully before
            proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription>
              {warnings.length} potential conflict{warnings.length !== 1 ? "s" : ""} detected:
              {criticalWarnings.length > 0 && (
                <span className="ml-2 font-semibold text-red-500">
                  {criticalWarnings.length} critical
                </span>
              )}
              {regularWarnings.length > 0 && (
                <span className="ml-2 font-semibold text-yellow-600">
                  {regularWarnings.length} warning{regularWarnings.length !== 1 ? "s" : ""}
                </span>
              )}
              {infoWarnings.length > 0 && (
                <span className="ml-2 text-blue-600">{infoWarnings.length} info</span>
              )}
            </AlertDescription>
          </Alert>

          {/* Critical Warnings */}
          {criticalWarnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-red-600">
                <AlertCircle className="h-4 w-4" />
                Critical Changes
              </h4>
              {criticalWarnings.map((warning, index) => (
                <Alert key={index} variant="destructive" className="border-red-200 bg-red-50">
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(warning.severity)}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{warning.field}</span>
                        <div className="flex gap-1">
                          {warning.affectedSystems.map((system, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {system}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm">{warning.message}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border bg-white/50 p-2">
                          <div className="mb-1 font-semibold">Current:</div>
                          <div className="text-muted-foreground">
                            {Array.isArray(warning.currentValue)
                              ? warning.currentValue.join(", ")
                              : String(warning.currentValue || "None")}
                          </div>
                        </div>
                        <div className="rounded border bg-white/50 p-2">
                          <div className="mb-1 font-semibold">New:</div>
                          <div className="text-muted-foreground">
                            {Array.isArray(warning.newValue)
                              ? warning.newValue.join(", ")
                              : String(warning.newValue || "None")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          )}

          {/* Warning-level Changes */}
          {regularWarnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                Important Changes
              </h4>
              {regularWarnings.map((warning, index) => (
                <Alert key={index} className="border-yellow-200 bg-yellow-50">
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(warning.severity)}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{warning.field}</span>
                        <div className="flex gap-1">
                          {warning.affectedSystems.map((system, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {system}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm">{warning.message}</p>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          )}

          {/* Info-level Changes */}
          {infoWarnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-blue-600">
                <Info className="h-4 w-4" />
                Information
              </h4>
              {infoWarnings.map((warning, index) => (
                <Alert key={index} className="border-blue-200 bg-blue-50">
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(warning.severity)}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{warning.field}</span>
                        <div className="flex gap-1">
                          {warning.affectedSystems.map((system, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {system}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm">{warning.message}</p>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className={criticalWarnings.length > 0 ? "bg-red-600 hover:bg-red-700" : ""}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Confirm Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Sync Status Indicator
 * Shows the current sync status of the builder
 */
interface SyncStatusIndicatorProps {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: boolean;
  hasError: boolean;
  errorMessage?: string;
}

export function SyncStatusIndicator({
  isSyncing,
  lastSyncTime,
  pendingChanges,
  hasError,
  errorMessage,
}: SyncStatusIndicatorProps) {
  const getStatusColor = () => {
    if (hasError) return "text-red-500";
    if (isSyncing) return "text-blue-500";
    if (pendingChanges) return "text-yellow-500";
    return "text-green-500";
  };

  const getStatusText = () => {
    if (hasError) return `Error: ${errorMessage || "Sync failed"}`;
    if (isSyncing) return "Saving...";
    if (pendingChanges) return "Unsaved changes";

    if (lastSyncTime) {
      const now = new Date();
      const diff = Math.floor((now.getTime() - lastSyncTime.getTime()) / 1000);

      if (diff < 10) return "Saved just now";
      if (diff < 60) return `Saved ${diff}s ago`;
      if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`;
      return `Saved ${Math.floor(diff / 3600)}h ago`;
    }

    return "Not saved";
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`h-2 w-2 rounded-full ${getStatusColor().replace("text-", "bg-")}`} />
      <span className={getStatusColor()}>{getStatusText()}</span>
    </div>
  );
}

/**
 * Field Mapping Indicator
 * Shows which database tables a field is mapped to
 */
interface FieldMappingIndicatorProps {
  fieldName: string;
  mappedTables: string[];
  requiresConfirmation?: boolean;
}

export function FieldMappingIndicator({
  fieldName,
  mappedTables,
  requiresConfirmation,
}: FieldMappingIndicatorProps) {
  if (mappedTables.length === 0) return null;

  return (
    <div className="text-muted-foreground flex items-center gap-2 text-xs">
      <Database className="h-3 w-3" />
      <span>Syncs to:</span>
      <div className="flex gap-1">
        {mappedTables.map((table, idx) => (
          <Badge key={idx} variant="secondary" className="text-xs">
            {table}
          </Badge>
        ))}
      </div>
      {requiresConfirmation && (
        <Badge variant="outline" className="text-xs">
          <AlertTriangle className="mr-1 h-3 w-3" />
          Requires confirmation
        </Badge>
      )}
    </div>
  );
}
