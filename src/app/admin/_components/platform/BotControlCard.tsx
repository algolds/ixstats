// src/app/admin/_components/platform/BotControlCard.tsx
"use client";

import { Bot, Pause, Play, RotateCcw, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import type { AdminPageBotStatusView } from "~/types/ixstats";

interface BotControlCardProps {
  botStatus: AdminPageBotStatusView | undefined;
  onPauseBot: () => void;
  onResumeBot: () => void;
  onClearOverrides: () => void;
  onSyncFromBot?: () => void;
  onSyncEpoch?: (targetEpoch: number) => void;
  pausePending: boolean;
  resumePending: boolean;
  clearPending: boolean;
  autoSyncPending?: boolean;
  syncEpochPending?: boolean;
  lastBotSync?: Date | null;
}

export function BotControlCard({
  botStatus,
  onPauseBot,
  onResumeBot,
  onClearOverrides,
  onSyncFromBot,
  onSyncEpoch,
  pausePending,
  resumePending,
  clearPending,
  autoSyncPending = false,
  syncEpochPending = false,
  lastBotSync,
}: BotControlCardProps) {
  if (!botStatus) return null;

  const isAvailable = botStatus.botHealth.available;

  return (
    <Card className="glass-card-parent border-green-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-green-500" />
              Discord Bot
            </CardTitle>
            <CardDescription>Bot controls and time synchronization</CardDescription>
          </div>
          {isAvailable ? (
            <Badge className="border-green-500/20 bg-green-500/10 text-green-600">Online</Badge>
          ) : (
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              Offline
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bot override warning */}
        {botStatus.botStatus?.hasTimeOverride && (
          <Alert className="border-amber-500/20 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-600">
              Bot has active time override. Click &quot;Clear Overrides&quot; to return to normal
              time flow.
            </AlertDescription>
          </Alert>
        )}

        {/* Status info */}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {botStatus.botHealth.message && <span>{botStatus.botHealth.message}</span>}
          {botStatus.botStatus && <span>Speed: {botStatus.botStatus.multiplier}x</span>}
          {lastBotSync && <span>Synced: {lastBotSync.toLocaleTimeString()}</span>}
        </div>

        {/* Control buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={onPauseBot}
            disabled={pausePending || !isAvailable}
          >
            <Pause className="mr-1.5 h-3.5 w-3.5" />
            {pausePending ? "..." : "Pause"}
          </Button>
          <Button
            size="sm"
            onClick={onResumeBot}
            disabled={resumePending || !isAvailable}
            className="border-green-500/20 bg-green-500/10 text-green-600 hover:bg-green-500/20"
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            {resumePending ? "..." : "Resume"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearOverrides}
            disabled={clearPending || !isAvailable}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {clearPending ? "..." : "Clear"}
          </Button>
        </div>

        <Separator />

        {/* Sync actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSyncFromBot}
            disabled={autoSyncPending || !isAvailable}
          >
            {autoSyncPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            {autoSyncPending ? "Syncing..." : "Sync from Bot"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSyncEpoch && onSyncEpoch(Date.now())}
            disabled={syncEpochPending}
            className="border-orange-500/20 bg-orange-600/10 text-orange-600 hover:bg-orange-600/20"
          >
            {syncEpochPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {syncEpochPending ? "Syncing..." : "Sync Epoch"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
