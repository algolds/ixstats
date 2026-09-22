"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Medal, Tournament as Swords, Trophy } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";

interface BracketViewProps {
  brackets: Array<{
    id: string;
    round: number;
    weightClass?: string;
    fighter1Id: string;
    fighter2Id: string;
    fighter1Name?: string;
    fighter2Name?: string;
    winnerId?: string;
    winnerName?: string;
    status: string;
    result?: unknown;
  }>;
  className?: string;
  onTeamClick?: (teamId: string) => void;
}

function formatResult(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  const method = (r.method as string) ?? (r.result as string) ?? "";
  const round = r.round != null ? ` R${r.round}` : "";
  const time = r.time != null ? ` ${r.time}` : "";
  return `${method}${round}${time}`;
}

export function BracketView({ brackets, className, onTeamClick }: BracketViewProps) {
  if (!brackets || brackets.length === 0) {
    return null;
  }

  const rounds = Array.from(new Set(brackets.map((b) => b.round))).sort((a, b) => b - a);

  const weightClasses = Array.from(
    new Set(brackets.map((b) => b.weightClass).filter(Boolean))
  ) as string[];

  if (weightClasses.length > 0) {
    return (
      <div className={cn("space-y-6", className)}>
        {weightClasses.map((wc) => {
          const wcBrackets = brackets.filter((b) => b.weightClass === wc);
          return (
            <BracketRounds
              key={wc}
              rounds={rounds}
              brackets={wcBrackets}
              title={wc}
              onTeamClick={onTeamClick}
            />
          );
        })}
      </div>
    );
  }

  return (
    <BracketRounds
      rounds={rounds}
      brackets={brackets}
      className={className}
      onTeamClick={onTeamClick}
    />
  );
}

function BracketRounds({
  rounds,
  brackets,
  title,
  className,
  onTeamClick,
}: {
  rounds: number[];
  brackets: BracketViewProps["brackets"];
  title?: string;
  className?: string;
  onTeamClick?: (teamId: string) => void;
}) {
  return (
    <FacetCard
      depth={2}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/40 bg-card/75 p-6 shadow-xl backdrop-blur-2xl md:p-8 space-y-6",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border/20 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-background/60 text-foreground shadow-xs">
            <Swords className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight text-foreground">
              {title ? `${title} Championship Bracket` : "Championship Tournament Bracket"}
            </h3>
            <p className="text-xs font-semibold text-muted-foreground">
              Single-elimination knockout ladder with verified victor advancements.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {rounds.map((round) => {
          const roundBrackets = brackets.filter((b) => b.round === round);
          const isFinalRound = round === rounds[0];

          return (
            <div key={round} className="space-y-3">
              <div className="flex items-center gap-2">
                {isFinalRound ? (
                  <Badge className="border-amber-500/40 bg-amber-500/20 px-2.5 py-0.5 text-xs font-black uppercase text-amber-400">
                    <Trophy className="mr-1 h-3.5 w-3.5" />
                    Championship Final
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-border/60 bg-muted/30 px-2.5 py-0.5 text-xs font-bold uppercase text-foreground"
                  >
                    {round === 1
                      ? "First Round"
                      : round === 2
                        ? "Semifinals"
                        : round === 3
                          ? "Quarterfinals"
                          : round === 4
                            ? "Round of 16"
                            : `Round ${round}`}
                  </Badge>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {roundBrackets.map((b) => {
                  const isCompleted = b.status === "completed";
                  const fighter1IsWinner = isCompleted && b.winnerId === b.fighter1Id;
                  const fighter2IsWinner = isCompleted && b.winnerId === b.fighter2Id;
                  const resultText = isCompleted ? formatResult(b.result) : "";

                  return (
                    <div
                      key={b.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-background/50 px-4 py-3.5 shadow-sm backdrop-blur-md transition-all active:scale-[0.99]",
                        isCompleted && "border-border/60 bg-background/70"
                      )}
                    >
                      {/* Fighter 1 */}
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => onTeamClick?.(b.fighter1Id)}
                          disabled={!onTeamClick}
                          data-cuelume-press="subtle"
                          className={cn(
                            "text-left group truncate block w-full transition",
                            onTeamClick && "hover:underline cursor-pointer active:scale-[0.98]"
                          )}
                        >
                          <span
                            className={cn(
                              "text-xs font-bold truncate block",
                              fighter1IsWinner
                                ? "text-amber-400 font-extrabold"
                                : isCompleted
                                  ? "text-muted-foreground line-through opacity-70"
                                  : "text-foreground group-hover:text-primary"
                            )}
                          >
                            {b.fighter1Name ?? b.fighter1Id}
                            {fighter1IsWinner && (
                              <Medal className="ml-1 inline h-3.5 w-3.5 text-amber-400" />
                            )}
                          </span>
                        </button>
                      </div>

                      {/* Result Pill */}
                      <div className="shrink-0">
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-2 py-0.5 text-xs font-black uppercase tracking-wider",
                            isCompleted
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                              : "border-border/50 text-muted-foreground"
                          )}
                        >
                          {isCompleted ? resultText || "Won" : "vs"}
                        </Badge>
                      </div>

                      {/* Fighter 2 */}
                      <div className="flex-1 min-w-0 text-right">
                        <button
                          type="button"
                          onClick={() => onTeamClick?.(b.fighter2Id)}
                          disabled={!onTeamClick}
                          data-cuelume-press="subtle"
                          className={cn(
                            "text-right group truncate block w-full transition",
                            onTeamClick && "hover:underline cursor-pointer active:scale-[0.98]"
                          )}
                        >
                          <span
                            className={cn(
                              "text-xs font-bold truncate block",
                              fighter2IsWinner
                                ? "text-amber-400 font-extrabold"
                                : isCompleted
                                  ? "text-muted-foreground line-through opacity-70"
                                  : "text-foreground group-hover:text-primary"
                            )}
                          >
                            {fighter2IsWinner && (
                              <Medal className="mr-1 inline h-3.5 w-3.5 text-amber-400" />
                            )}
                            {b.fighter2Name ?? b.fighter2Id}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </FacetCard>
  );
}

export default BracketView;
