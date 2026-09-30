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

export interface MatchAnalysisInput {
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

export function generateMatchAnalysisFacts(input: MatchAnalysisInput): MatchAnalysisFacts {
  const {
    homeTeamName,
    awayTeamName,
    homeScore,
    awayScore,
    events,
    homeRatings = { offense: 50, defense: 50, midfield: 50, coaching: 50 },
    awayRatings = { offense: 50, defense: 50, midfield: 50, coaching: 50 },
    homeTactics = "Balanced",
    awayTactics = "Balanced",
  } = input;

  // 1. Calculate tactical advantage & midfield delta
  const homeMid = homeRatings.midfield ?? 50;
  const awayMid = awayRatings.midfield ?? 50;
  const midDelta = homeMid - awayMid;
  const possessionDeltaPct = Math.round(midDelta * 0.4);

  const homeCoach = homeRatings.coaching ?? 50;
  const awayCoach = awayRatings.coaching ?? 50;
  const tacticalAdvantageFactor = Math.round((homeCoach - awayCoach) * 0.2);

  // 2. Identify dominant scoring phase
  const goals = events.filter((e) => e.type === "goal" || e.type === "score" || e.type === "touchdown");
  let earlyGoals = 0;
  let midGoals = 0;
  let lateGoals = 0;

  for (const g of goals) {
    const min = g.minute ?? 45;
    if (min <= 30) earlyGoals++;
    else if (min <= 65) midGoals++;
    else lateGoals++;
  }

  let dominantPhase: MatchAnalysisFacts["dominantPhase"] = "balanced";
  if (earlyGoals > midGoals && earlyGoals > lateGoals) dominantPhase = "early";
  else if (midGoals > earlyGoals && midGoals > lateGoals) dominantPhase = "mid";
  else if (lateGoals > earlyGoals && lateGoals > midGoals) dominantPhase = "late";

  // 3. Conversion ratios
  const homeShots = events.filter((e) => (e.type === "shot" || e.type === "goal") && e.teamName === homeTeamName).length;
  const awayShots = events.filter((e) => (e.type === "shot" || e.type === "goal") && e.teamName === awayTeamName).length;

  const chanceConversionRatio = {
    home: homeShots > 0 ? Number((homeScore / Math.max(homeScore, homeShots)).toFixed(2)) : homeScore > 0 ? 1.0 : 0.0,
    away: awayShots > 0 ? Number((awayScore / Math.max(awayScore, awayShots)).toFixed(2)) : awayScore > 0 ? 1.0 : 0.0,
  };

  // 4. Identify key performer
  const scorerCounts = new Map<string, { name: string; team: string; count: number; id?: string }>();
  for (const g of goals) {
    if (g.actorName) {
      const existing = scorerCounts.get(g.actorName) ?? {
        name: g.actorName,
        team: g.teamName ?? "",
        count: 0,
        id: g.actorId,
      };
      existing.count++;
      scorerCounts.set(g.actorName, existing);
    }
  }

  let keyPerformer: MatchAnalysisFacts["keyPerformer"] = null;
  let maxGoals = 0;
  for (const p of scorerCounts.values()) {
    if (p.count > maxGoals) {
      maxGoals = p.count;
      keyPerformer = {
        athleteId: p.id,
        athleteName: p.name,
        teamName: p.team,
        metric: `${p.count} ${p.count === 1 ? "score" : "scores"}`,
        impactScore: 85 + p.count * 5,
      };
    }
  }

  // 5. Generate structured factual bullet points
  const tacticalKeynotes: string[] = [];

  const winner = homeScore > awayScore ? homeTeamName : awayScore > homeScore ? awayTeamName : null;
  if (winner) {
    const isHome = winner === homeTeamName;
    const diff = Math.abs(homeScore - awayScore);
    if (diff >= 3) {
      tacticalKeynotes.push(`${winner} dictated full tactical supremacy, maintaining consistent finishing efficiency.`);
    } else if (dominantPhase === "late") {
      tacticalKeynotes.push(`${winner} capitalized in late-stage momentum to break through defensive lines.`);
    } else if (dominantPhase === "early") {
      tacticalKeynotes.push(`${winner} established an aggressive early lead and managed defensive containment.`);
    } else {
      tacticalKeynotes.push(`${winner} prevailed through disciplined tactical execution in tight spaces.`);
    }
  } else {
    tacticalKeynotes.push("Both clubs matched parity across midfield transition and defensive organization.");
  }

  if (Math.abs(possessionDeltaPct) >= 8) {
    const dominatingTeam = possessionDeltaPct > 0 ? homeTeamName : awayTeamName;
    tacticalKeynotes.push(`${dominatingTeam} commanded central territory (+${Math.abs(possessionDeltaPct)}% estimated possession advantage).`);
  }

  if (homeTactics !== "Balanced" || awayTactics !== "Balanced") {
    tacticalKeynotes.push(`Tactical posture: ${homeTeamName} deployed ${homeTactics}, met by ${awayTeamName}'s ${awayTactics} structure.`);
  }

  if (keyPerformer) {
    tacticalKeynotes.push(`${keyPerformer.athleteName} proved decisive for ${keyPerformer.teamName} with ${keyPerformer.metric}.`);
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
