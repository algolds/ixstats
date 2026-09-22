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
        className="max-w-4xl max-h-[90vh] overflow-y-auto border-border/40 bg-card/95 backdrop-blur-2xl p-6 rounded-3xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Match Center</DialogTitle>
          <DialogDescription>Match details, live scoreboard, and tactical analysis</DialogDescription>
        </DialogHeader>
        <MatchCenter matchId={matchId} onClose={onClose} sportPreset={sportPreset} />
      </DialogContent>
    </Dialog>
  );
}
export { MatchDetailModal };
