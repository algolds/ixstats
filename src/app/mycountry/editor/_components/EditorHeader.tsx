"use client";

import { Save, Settings2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";

interface EditorHeaderProps {
  countryName: string;
  totalChanges: number;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onSave: () => void;
  isSaving: boolean;
  hasChanges: boolean;
  econSaveState: {
    isSaving: boolean;
    pendingChanges: boolean;
    lastSavedAt: Date | null;
  };
}

export function EditorHeader({
  countryName,
  totalChanges,
  showAdvanced,
  onToggleAdvanced,
  onSave,
  isSaving,
  hasChanges,
  econSaveState,
}: EditorHeaderProps) {
  return (
    <Card className="glass-hierarchy-parent border-amber-200 dark:border-amber-800">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              MyCountry Editor: {countryName}
            </CardTitle>
            <CardDescription>Configure your country's settings</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {totalChanges} Change{totalChanges !== 1 ? "s" : ""}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {econSaveState.isSaving
                ? "Saving economic data…"
                : econSaveState.pendingChanges
                  ? "Unsaved economic changes"
                  : econSaveState.lastSavedAt
                    ? `Saved ${Math.max(0, Math.floor((Date.now() - econSaveState.lastSavedAt.getTime()) / 1000))}s ago`
                    : "Not saved yet"}
            </Badge>
            <Button onClick={onToggleAdvanced} variant="outline" size="default">
              <Settings2 className="mr-2 h-4 w-4" />
              {showAdvanced ? "Simple" : "Advanced"}
            </Button>
            <Button
              onClick={onSave}
              disabled={!hasChanges || isSaving}
              size="default"
              className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
