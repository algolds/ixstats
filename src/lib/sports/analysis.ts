/**
 * Deterministic Match Analysis Engine (PRD §17)
 * Produces structured post-match analytical facts and objective explanations
 * directly from canonical match traces without external LLM dependencies.
 */

export interface MatchAnalysisFacts {
  dominantPhase: "early" | "mid" | "late" | "balanced";
  possessionDeltaPct: number; // e.g. +12 = home +12%
  chanceConversionRatio: {
    home: number; // e.g. 0.33 (33%)
    away: number;
  };
  tacticalAdvantageFactor: number; // positive = home advantage
  keyPerformer: {
    athleteId?: string;
    athleteName: string;
    teamName: string;
    metric: string;
    impactScore: number;
  } | null;
  tacticalKeynotes: string[];
}

interface MatchAnalysisInput {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  sportPreset: string;
  events: Array<{
    type: string;
    minute?: number;
    period?: number;
    actorId?: string;
    actorName?: string;
    teamId?: string;
    teamName?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }>;
  homeRatings?: { offense?: number; defense?: number; midfield?: number; coaching?: number };
  awayRatings?: { offense?: number; defense?: number; midfield?: number; coaching?: number };
  homeTactics?: string;
  awayTactics?: string;
}

type MatchEvent = MatchAnalysisInput["events"][number];

const SCORING_EVENTS = ["goal", "score", "touchdown"];
const SHOT_EVENTS = ["shot", "goal"];
const DEFAULT_RATINGS = { offense: 50, defense: 50, midfield: 50, coaching: 50 };

const conversionRatio = (score: number, shots: number) =>
  shots > 0 ? Number((score / Math.max(score, shots)).toFixed(2)) : score > 0 ? 1 : 0;

/** The phase with strictly the most goals, else "balanced". */
function dominantPhaseOf(goals: MatchEvent[]): MatchAnalysisFacts["dominantPhase"] {
  const phaseGoals = { early: 0, mid: 0, late: 0 };
  for (const g of goals) {
    const minute = g.minute ?? 45;
    phaseGoals[minute <= 30 ? "early" : minute <= 65 ? "mid" : "late"]++;
  }
  const [leader, runnerUp] = Object.entries(phaseGoals).sort(([, a], [, b]) => b - a);
  return leader![1] > runnerUp![1] ? (leader![0] as "early" | "mid" | "late") : "balanced";
}

/** The first scorer with the most goals. */
function keyPerformerOf(goals: MatchEvent[]): MatchAnalysisFacts["keyPerformer"] {
  const scorers = new Map<string, { name: string; team: string; count: number; id?: string }>();
  for (const g of goals) {
    if (!g.actorName) continue;
    const scorer = scorers.get(g.actorName) ?? {
      name: g.actorName,
      team: g.teamName ?? "",
      count: 0,
      id: g.actorId,
    };
    scorer.count++;
    scorers.set(g.actorName, scorer);
  }
  let best: { name: string; team: string; count: number; id?: string } | undefined;
  for (const p of scorers.values()) {
    if (p.count > (best?.count ?? 0)) best = p;
  }
  return best
    ? {
        athleteId: best.id,
        athleteName: best.name,
        teamName: best.team,
        metric: `${best.count} ${best.count === 1 ? "score" : "scores"}`,
        impactScore: 85 + best.count * 5,
      }
    : null;
}

function resultKeynote(
  input: MatchAnalysisInput,
  dominantPhase: MatchAnalysisFacts["dominantPhase"]
): string {
  const { homeTeamName, awayTeamName, homeScore, awayScore } = input;
  if (homeScore === awayScore) {
    return "Both clubs matched parity across midfield transition and defensive organization.";
  }
  const winner = homeScore > awayScore ? homeTeamName : awayTeamName;
  if (Math.abs(homeScore - awayScore) >= 3) {
    return `${winner} dictated full tactical supremacy, maintaining consistent finishing efficiency.`;
  }
  if (dominantPhase === "late") {
    return `${winner} capitalized in late-stage momentum to break through defensive lines.`;
  }
  if (dominantPhase === "early") {
    return `${winner} established an aggressive early lead and managed defensive containment.`;
  }
  return `${winner} prevailed through disciplined tactical execution in tight spaces.`;
}

export function generateMatchAnalysisFacts(input: MatchAnalysisInput): MatchAnalysisFacts {
  const {
    homeTeamName,
    awayTeamName,
    homeScore,
    awayScore,
    events,
    homeRatings = DEFAULT_RATINGS,
    awayRatings = DEFAULT_RATINGS,
    homeTactics = "Balanced",
    awayTactics = "Balanced",
  } = input;

  const possessionDeltaPct = Math.round(
    ((homeRatings.midfield ?? 50) - (awayRatings.midfield ?? 50)) * 0.4
  );
  const tacticalAdvantageFactor = Math.round(
    ((homeRatings.coaching ?? 50) - (awayRatings.coaching ?? 50)) * 0.2
  );

  const goals = events.filter((e) => SCORING_EVENTS.includes(e.type));
  const dominantPhase = dominantPhaseOf(goals);
  const keyPerformer = keyPerformerOf(goals);

  const shotsFor = (teamName: string) =>
    events.filter((e) => SHOT_EVENTS.includes(e.type) && e.teamName === teamName).length;
  const chanceConversionRatio = {
    home: conversionRatio(homeScore, shotsFor(homeTeamName)),
    away: conversionRatio(awayScore, shotsFor(awayTeamName)),
  };

  const tacticalKeynotes = [resultKeynote(input, dominantPhase)];
  if (Math.abs(possessionDeltaPct) >= 8) {
    const dominatingTeam = possessionDeltaPct > 0 ? homeTeamName : awayTeamName;
    tacticalKeynotes.push(
      `${dominatingTeam} commanded central territory (+${Math.abs(possessionDeltaPct)}% estimated possession advantage).`
    );
  }
  if (homeTactics !== "Balanced" || awayTactics !== "Balanced") {
    tacticalKeynotes.push(
      `Tactical posture: ${homeTeamName} deployed ${homeTactics}, met by ${awayTeamName}'s ${awayTactics} structure.`
    );
  }
  if (keyPerformer) {
    tacticalKeynotes.push(
      `${keyPerformer.athleteName} proved decisive for ${keyPerformer.teamName} with ${keyPerformer.metric}.`
    );
  }

  return {
    dominantPhase,
    possessionDeltaPct,
    chanceConversionRatio,
    tacticalAdvantageFactor,
    keyPerformer,
    tacticalKeynotes,
  };
}
