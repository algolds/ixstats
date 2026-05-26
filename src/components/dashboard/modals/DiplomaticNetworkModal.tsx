// @ts-nocheck
"use client";

import { Users, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { cn } from "~/lib/utils";

interface LeaderboardEntry {
  countryId: string;
  countryName: string;
  totalInfluence: number;
  averageLevel: number;
  activeEmbassies: number;
  globalEffects?: {
    tradeBonus: number;
    diplomaticWeight: number;
    culturalReach: number;
  };
}

interface DiplomaticNetworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  leaderboard: LeaderboardEntry[];
}

export function DiplomaticNetworkModal({
  isOpen,
  onClose,
  leaderboard,
}: DiplomaticNetworkModalProps) {
  const totalEmbassies = leaderboard.reduce((sum, e) => sum + e.activeEmbassies, 0);
  const nationsWithTies = leaderboard.filter((e) => e.activeEmbassies > 0).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-cyan-500" />
            Diplomatic Network
          </DialogTitle>
        </DialogHeader>

        {/* Summary bar */}
        <div className="flex gap-3">
          <div className="border-border/40 bg-muted/20 flex-1 rounded-lg border p-2.5 text-center">
            <div className="text-lg font-bold">{totalEmbassies}</div>
            <div className="text-muted-foreground text-[10px]">Total Embassies</div>
          </div>
          <div className="border-border/40 bg-muted/20 flex-1 rounded-lg border p-2.5 text-center">
            <div className="text-lg font-bold">{nationsWithTies}</div>
            <div className="text-muted-foreground text-[10px]">Nations with Ties</div>
          </div>
        </div>

        {/* Ranked list */}
        <div className="max-h-[400px] space-y-1.5 overflow-y-auto">
          {leaderboard.length === 0 ? (
            <div className="py-8 text-center">
              <Globe className="text-muted-foreground/40 mx-auto mb-3 h-10 w-10" />
              <p className="text-muted-foreground text-sm">No diplomatic activity yet</p>
            </div>
          ) : (
            leaderboard
              .filter((e) => e.activeEmbassies > 0)
              .map((entry, i) => (
                <div
                  key={entry.countryId}
                  className="border-border/40 hover:bg-muted/30 flex items-center gap-3 rounded-lg border p-2.5 transition-colors"
                >
                  <span className="text-muted-foreground w-5 text-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <UnifiedCountryFlag
                    countryId={entry.countryId}
                    size="sm"
                    className="h-6 w-8 shrink-0 rounded"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{entry.countryName}</div>
                    <div className="text-muted-foreground flex items-center gap-2 text-[10px]">
                      <span>
                        {entry.activeEmbassies}{" "}
                        {entry.activeEmbassies === 1 ? "embassy" : "embassies"}
                      </span>
                      <span className="text-muted-foreground/40">|</span>
                      <span>Lvl {entry.averageLevel}</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 px-1.5 py-0 text-[10px]",
                      entry.totalInfluence >= 50
                        ? "border-cyan-500/30 text-cyan-600"
                        : entry.totalInfluence >= 20
                          ? "border-blue-500/30 text-blue-600"
                          : "text-muted-foreground border-border/40"
                    )}
                  >
                    {entry.totalInfluence} influence
                  </Badge>
                </div>
              ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
