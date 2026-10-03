"use client";

import React from "react";
import { motion } from "motion/react";
import { Trophy, Star, Sparks as Sparkles } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { springGentle } from "~/lib/design/motion";
import { getSportTheme } from "~/lib/sports/theming";

interface ChampionshipRevealOverlayProps {
  isOpen: boolean;
  championName: string;
  championLogo?: string | null;
  championColor?: string | null;
  seasonNumber: number;
  leagueName: string;
  sportPreset?: string;
  onClose: () => void;
}

export function ChampionshipRevealOverlay({
  isOpen,
  championName,
  championLogo,
  championColor,
  seasonNumber,
  leagueName,
  sportPreset,
  onClose,
}: ChampionshipRevealOverlayProps) {
  const sportTheme = getSportTheme(sportPreset);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-8 text-center">
        {/* Top Trophy & Sparks */}
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springGentle}
          className="rounded-card bg-yellow/15 relative mx-auto mb-6 flex size-24 items-center justify-center"
        >
          <Trophy className="text-yellow size-12" aria-hidden />
          <Sparkles className="text-yellow absolute -top-2 -right-2 size-6" aria-hidden />
          <Star
            className="text-yellow absolute -bottom-1 -left-1 size-5 fill-current"
            aria-hidden
          />
        </motion.div>

        {/* Header Badge */}
        <div className="flex justify-center">
          <Badge variant="warning">
            <span>{leagueName}</span>
            <span aria-hidden>•</span>
            <span>Season {seasonNumber} Champion</span>
          </Badge>
        </div>

        {/* Champion Title */}
        <DialogTitle className="text-large-title text-label mt-4">{championName}</DialogTitle>

        <DialogDescription className="text-body mt-2">
          Crowned champions of {leagueName} after a decisive campaign in Season {seasonNumber}.
        </DialogDescription>

        {/* Champion Logo / Emblems */}
        <div className="my-8 flex items-center justify-center gap-4">
          <div
            className="border-separator bg-surface-secondary rounded-card flex size-20 items-center justify-center overflow-hidden border"
            style={championColor ? { borderColor: championColor } : undefined}
          >
            {championLogo ? (
              <img src={championLogo} alt={championName} className="h-full w-full object-cover" />
            ) : (
              <Trophy className="text-yellow size-10" aria-hidden />
            )}
          </div>
        </div>

        {/* Trophy Quote / Lore Banner */}
        <div className="bg-surface-secondary text-callout text-label-secondary rounded-row p-4">
          <p>
            The {sportTheme.name} championship trophy has been formally awarded. All statistics and
            honors have been archived in the Competition Almanac.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" onClick={onClose}>
            Continue campaign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
