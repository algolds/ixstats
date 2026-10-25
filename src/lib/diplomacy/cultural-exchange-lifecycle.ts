/**
 * A cultural exchange runs planning → active (at its start date) → completed (at its end date). The diplomatic-drift
 * cron moves it along and keeps its metrics computed from what actually happened: participants, artifacts and votes.
 * Completed embassy missions add their bonus on read (`getCulturalExchanges`), so they are not counted here.
 *
 * The metrics are 0-100 with 50 as an ordinary exchange's level: one participant and nothing else is a little under
 * it, a second participant or a few artifacts lift it over (calculateExchangeImpact reads the distance from 50).
 */
import type { PrismaClient } from "@prisma/client";

export interface ExchangeActivity {
  participants: number;
  artifacts: number;
  votes: number;
}

export interface ExchangeMetrics {
  culturalImpact: number;
  diplomaticValue: number;
  socialEngagement: number;
}

const clampMetric = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function exchangeMetrics({ participants, artifacts, votes }: ExchangeActivity): ExchangeMetrics {
  return {
    culturalImpact: clampMetric(30 + 15 * participants + 5 * artifacts),
    diplomaticValue: clampMetric(30 + 10 * participants + 2 * votes),
    socialEngagement: 10 * participants + 5 * artifacts + votes,
  };
}

type ExchangeStatus = "planning" | "active" | "completed";

/** The status an unfinished exchange should have at `now`. */
export function exchangeStatusAt(exchange: { startDate: Date; endDate: Date }, now: Date): ExchangeStatus {
  if (exchange.endDate.getTime() <= now.getTime()) return "completed";
  if (exchange.startDate.getTime() <= now.getTime()) return "active";
  return "planning";
}

interface AdvanceResult {
  exchangesActivated: number;
  exchangesCompleted: number;
}

/** Moves started exchanges to active or completed and refreshes their metrics (each write conditional on status). */
export async function advanceCulturalExchanges(
  db: Pick<PrismaClient, "culturalExchange">,
  now: Date = new Date()
): Promise<AdvanceResult> {
  const running = await db.culturalExchange.findMany({
    where: { status: { in: ["planning", "active"] }, startDate: { lte: now } },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      _count: { select: { participatingCountries: true, culturalArtifacts: true, votes: true } },
    },
  });
  const result: AdvanceResult = { exchangesActivated: 0, exchangesCompleted: 0 };
  for (const exchange of running) {
    const status = exchangeStatusAt(exchange, now);
    const metrics = exchangeMetrics({
      participants: exchange._count.participatingCountries,
      artifacts: exchange._count.culturalArtifacts,
      votes: exchange._count.votes,
    });
    const moved = await db.culturalExchange.updateMany({
      where: { id: exchange.id, status: exchange.status },
      data: { status, ...metrics, participants: exchange._count.participatingCountries },
    });
    if (moved.count === 0 || status === exchange.status) continue;
    if (status === "completed") result.exchangesCompleted++;
    else result.exchangesActivated++;
  }
  return result;
}
