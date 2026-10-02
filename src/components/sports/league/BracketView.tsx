"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Medal, Tournament as Swords, Trophy } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

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
    <Card
      className={cn(
        "rounded-sheet border-separator bg-surface shadow-card relative space-y-6 overflow-hidden border p-6 md:p-8",
        className
      )}
    >
      <div className="border-separator flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-row border-separator bg-surface-secondary text-label shadow-card flex h-9 w-9 items-center justify-center border">
            <Swords className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-headline text-label">
              {title ? `${title} Championship Bracket` : "Championship Tournament Bracket"}
            </h3>
            <p className="text-footnote text-label-secondary font-semibold">
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
                  <Badge
                    className="border-yellow/40 bg-yellow/20 text-eyebrow text-yellow px-3 py-0.5"
                    variant="secondary"
                  >
                    <Trophy className="mr-1 h-3.5 w-3.5" />
                    Championship Final
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-separator bg-fill-4 text-eyebrow text-label px-3 py-0.5"
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
                        "rounded-card border-separator bg-surface-secondary shadow-card flex items-center justify-between gap-3 border px-4 py-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.99]",
                        isCompleted && "border-separator bg-surface-secondary"
                      )}
                    >
                      {/* Fighter 1 */}
                      <div className="min-w-0 flex-1">
                        <Button
                          variant="ghost"
                          onClick={() => onTeamClick?.(b.fighter1Id)}
                          disabled={!onTeamClick}
                          className={cn(
                            "group block h-auto w-full truncate p-0 text-left font-normal hover:bg-transparent disabled:opacity-100",
                            onTeamClick && "hover:underline"
                          )}
                        >
                          <span
                            className={cn(
                              "text-footnote block truncate font-semibold",
                              fighter1IsWinner
                                ? "text-yellow font-semibold"
                                : isCompleted
                                  ? "text-label-secondary line-through opacity-70"
                                  : "text-label group-hover:text-tint"
                            )}
                          >
                            {b.fighter1Name ?? b.fighter1Id}
                            {fighter1IsWinner && (
                              <Medal className="text-yellow ml-1 inline h-3.5 w-3.5" />
                            )}
                          </span>
                        </Button>
                      </div>

                      {/* Result Pill */}
                      <div className="shrink-0">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-eyebrow px-2 py-0.5",
                            isCompleted
                              ? "border-yellow/30 bg-yellow/10 text-yellow"
                              : "border-separator text-label-secondary"
                          )}
                        >
                          {isCompleted ? resultText || "Won" : "vs"}
                        </Badge>
                      </div>

                      {/* Fighter 2 */}
                      <div className="min-w-0 flex-1 text-right">
                        <Button
                          variant="ghost"
                          onClick={() => onTeamClick?.(b.fighter2Id)}
                          disabled={!onTeamClick}
                          className={cn(
                            "group block h-auto w-full truncate p-0 text-right font-normal hover:bg-transparent disabled:opacity-100",
                            onTeamClick && "hover:underline"
                          )}
                        >
                          <span
                            className={cn(
                              "text-footnote block truncate font-semibold",
                              fighter2IsWinner
                                ? "text-yellow font-semibold"
                                : isCompleted
                                  ? "text-label-secondary line-through opacity-70"
                                  : "text-label group-hover:text-tint"
                            )}
                          >
                            {fighter2IsWinner && (
                              <Medal className="text-yellow mr-1 inline h-3.5 w-3.5" />
                            )}
                            {b.fighter2Name ?? b.fighter2Id}
                          </span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default BracketView;
