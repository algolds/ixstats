"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { MatchCenter } from "~/components/sports/match/MatchCenter";

interface MatchDetailModalProps {
  matchId: string | null;
  isOpen: boolean;
  onClose: () => void;
  sportPreset?: string;
  sportColors?: { accentColor: string; highlightColor: string } | null;
}

export default function MatchDetailModal({
  matchId,
  isOpen,
  onClose,
  sportPreset,
}: MatchDetailModalProps) {
  if (!matchId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="border-separator bg-surface rounded-sheet max-h-[90vh] max-w-4xl overflow-y-auto p-6"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Match center</DialogTitle>
          <DialogDescription>
            Match details, live scoreboard, and tactical analysis
          </DialogDescription>
        </DialogHeader>
        <MatchCenter matchId={matchId} onClose={onClose} sportPreset={sportPreset} />
      </DialogContent>
    </Dialog>
  );
}
export { MatchDetailModal };
