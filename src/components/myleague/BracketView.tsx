"use client";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { Medal, Swords } from "lucide-react";

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
}

function formatResult(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  const method = (r.method as string) ?? (r.result as string) ?? "";
  const round = r.round != null ? ` R${r.round}` : "";
  const time = r.time != null ? ` ${r.time}` : "";
  return `${method}${round}${time}`;
}

export function BracketView({ brackets, className }: BracketViewProps) {
  if (!brackets || brackets.length === 0) {
    return null;
  }

  const rounds = Array.from(new Set(brackets.map((b) => b.round))).sort(
    (a, b) => b - a,
  );

  const weightClasses = Array.from(
    new Set(brackets.map((b) => b.weightClass).filter(Boolean)),
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
            />
          );
        })}
      </div>
    );
  }

  return (
    <BracketRounds rounds={rounds} brackets={brackets} className={className} />
  );
}

function BracketRounds({
  rounds,
  brackets,
  title,
  className,
}: {
  rounds: number[];
  brackets: BracketViewProps["brackets"];
  title?: string;
  className?: string;
}) {
  return (
    <Card className={cn("facet-hierarchy-child", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Swords className="h-5 w-5" />
          {title ? `${title} Bracket` : "Bracket"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {rounds.map((round) => {
            const roundBrackets = brackets.filter((b) => b.round === round);
            const isFinalRound = round === rounds[0];

            return (
              <div key={round}>
                <h3 className="text-muted-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
                  {isFinalRound && (
                    <Medal className="h-4 w-4 text-yellow-500" />
                  )}
                  {round === 1
                    ? "First Round"
                    : round === 2
                      ? "Semifinals"
                      : round === 3
                        ? "Quarterfinals"
                        : round === 4
                          ? "Round of 16"
                          : `Round ${round}`}
                </h3>
                <div className="space-y-2">
                  {roundBrackets.map((b) => {
                    const isCompleted = b.status === "completed";
                    const fighter1IsWinner =
                      isCompleted && b.winnerId === b.fighter1Id;
                    const fighter2IsWinner =
                      isCompleted && b.winnerId === b.fighter2Id;
                    const resultText = isCompleted ? formatResult(b.result) : "";

                    return (
                      <div
                        key={b.id}
                        className="flex items-center gap-3 rounded-lg border px-4 py-3"
                      >
                        <div className="flex-1">
                          <span
                            className={cn(
                              "font-medium",
                              fighter1IsWinner && "font-bold text-yellow-500",
                            )}
                          >
                            {b.fighter1Name ?? b.fighter1Id}
                            {fighter1IsWinner && (
                              <Medal className="ml-1 inline h-3.5 w-3.5 text-yellow-500" />
                            )}
                          </span>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                          <Badge
                            variant={
                              isCompleted ? "secondary" : "outline"
                            }
                          >
                            {isCompleted ? resultText || "Won" : "vs"}
                          </Badge>
                        </div>

                        <div className="flex-1 text-right">
                          <span
                            className={cn(
                              "font-medium",
                              fighter2IsWinner && "font-bold text-yellow-500",
                            )}
                          >
                            {b.fighter2Name ?? b.fighter2Id}
                            {fighter2IsWinner && (
                              <Medal className="ml-1 inline h-3.5 w-3.5 text-yellow-500" />
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
