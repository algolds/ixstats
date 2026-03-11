// src/app/admin/_components/platform/SaveConfigCard.tsx
"use client";

import { Save, Loader2, Check } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

interface SaveConfigCardProps {
  lastUpdate: Date | null;
  onSaveConfig: () => void;
  savePending: boolean;
}

export function SaveConfigCard({ lastUpdate, onSaveConfig, savePending }: SaveConfigCardProps) {
  return (
    <Card className="glass-card-parent border-emerald-500/20">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-foreground">Save Configuration</p>
          {lastUpdate && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Check className="h-3 w-3 text-green-500" />
              Saved {lastUpdate.toLocaleTimeString()}
            </Badge>
          )}
        </div>
        <Button onClick={onSaveConfig} disabled={savePending} size="lg">
          {savePending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {savePending ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
