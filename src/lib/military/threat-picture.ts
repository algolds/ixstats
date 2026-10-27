/**
 * A nation's threat picture, derived on read (owner decision 4): nothing stores threats, border
 * security or a security assessment. From
 *  - its map neighbours (geo adjacency), their combat strength and the relation with each;
 *  - its pending or active conflicts, the hostile foreign-policy actions in force against it and
 *    the active crises that affect it;
 *  - its own combat strength (national combat power from the defense model, realm time D2a),
 * this works out the active threats, a threat score per neighbour, border security and the
 * military strength score (own strength against the strongest rival, 0-100).
 */

export type ThreatSeverity = "low" | "moderate" | "high" | "critical";
export type ThreatLevel = "minimal" | ThreatSeverity;
export type SecurityStatus = "secure" | "guarded" | "elevated" | "critical";
export type RelationStance = "hostile" | "tense" | "neutral" | "friendly" | "allied";

export interface NeighborInput {
  countryId: string;
  name: string;
  strength: number;
  /** DiplomaticRelation.strength (0-100), null without a relation. */
  relationStrength: number | null;
}

export interface ConflictInput {
  id: string;
  type: string;
  status: string;
  opponentId: string;
  opponentName: string;
  detectedAt: Date;
}

export interface HostileActionInput {
  id: string;
  actionType: string;
  severity: string;
  initiatorId: string;
  initiatorName: string;
  detectedAt: Date;
}

export interface CrisisInput {
  id: string;
  title: string;
  severity: string;
  detectedAt: Date;
}

export interface ThreatPictureInput {
  ownStrength: number;
  neighbors: NeighborInput[];
  conflicts: ConflictInput[];
  hostileActions: HostileActionInput[];
  crises: CrisisInput[];
  /** Combat strength of conflict opponents and hostile initiators that are not neighbours. */
  rivalStrengths: Record<string, number>;
}

export interface DerivedThreat {
  id: string;
  threatName: string;
  severity: ThreatSeverity;
  source: "conflict" | "foreign_policy" | "crisis";
  detectedAt: Date;
}

export interface NeighborThreat {
  id: string;
  neighborCountryId: string;
  neighborName: string;
  borderType: "land";
  threatLevel: ThreatLevel;
  threatScore: number;
  militaryThreat: number;
  diplomaticRelations: RelationStance;
  notes: string | null;
}

export interface ThreatPicture {
  threats: DerivedThreat[];
  neighborThreats: NeighborThreat[];
  landBorders: number;
  borderSecurity: number;
  borderStatus: SecurityStatus;
  combatStrength: number;
  militaryStrength: number;
  overallSecurityScore: number;
  securityLevel: SecurityStatus;
  activeThreatCount: number;
  highSeverityThreats: number;
}

const SEVERITY_ORDER: readonly ThreatSeverity[] = ["low", "moderate", "high", "critical"];
/** Security points each active threat costs. */
const SEVERITY_WEIGHT: Record<ThreatSeverity, number> = {
  low: 5,
  moderate: 10,
  high: 20,
  critical: 35,
};
/** Neighbour threat points for an active conflict with it, and for a hostile action it imposed. */
const CONFLICT_WITH_NEIGHBOR = 30;
const HOSTILE_ACTION_BY_NEIGHBOR = 20;

const FP_LABELS: Record<string, string> = {
  embargo: "Trade embargo",
  sanction: "Economic sanctions",
  blockade: "Naval blockade",
};

const clamp100 = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

function bump(severity: ThreatSeverity): ThreatSeverity {
  const i = SEVERITY_ORDER.indexOf(severity);
  return SEVERITY_ORDER[Math.min(SEVERITY_ORDER.length - 1, i + 1)]!;
}

/** A crisis severity (`Priority`, either case) as a threat severity. */
function crisisSeverity(severity: string): ThreatSeverity {
  const s = severity.toLowerCase();
  if (s === "critical" || s === "high" || s === "low") return s;
  return "moderate";
}

/** A foreign-policy action's severity ("light" | "moderate" | "severe"); a blockade is one worse. */
function hostileSeverity(action: HostileActionInput): ThreatSeverity {
  const base: ThreatSeverity =
    action.severity === "severe" ? "high" : action.severity === "light" ? "low" : "moderate";
  return action.actionType === "blockade" ? bump(base) : base;
}

function deriveThreats(input: ThreatPictureInput): DerivedThreat[] {
  const fromConflicts = input.conflicts.map<DerivedThreat>((c) => ({
    id: `conflict-${c.id}`,
    threatName:
      c.status === "active"
        ? `Armed conflict with ${c.opponentName}`
        : `Conflict challenge with ${c.opponentName}`,
    severity: c.status === "active" ? "critical" : "high",
    source: "conflict",
    detectedAt: c.detectedAt,
  }));
  const fromActions = input.hostileActions.map<DerivedThreat>((a) => ({
    id: `fp-${a.id}`,
    threatName: `${FP_LABELS[a.actionType] ?? "Hostile action"} by ${a.initiatorName}`,
    severity: hostileSeverity(a),
    source: "foreign_policy",
    detectedAt: a.detectedAt,
  }));
  const fromCrises = input.crises.map<DerivedThreat>((c) => ({
    id: `crisis-${c.id}`,
    threatName: c.title,
    severity: crisisSeverity(c.severity),
    source: "crisis",
    detectedAt: c.detectedAt,
  }));
  return [...fromConflicts, ...fromActions, ...fromCrises].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity) ||
      b.detectedAt.getTime() - a.detectedAt.getTime()
  );
}

/** Share of the combined strength the other side holds, 0-100 (0 when neither has forces). */
function strengthShare(theirs: number, ours: number): number {
  const total = theirs + ours;
  return total > 0 ? clamp100((theirs / total) * 100) : 0;
}

function stance(relationStrength: number | null): RelationStance {
  if (relationStrength === null) return "neutral";
  if (relationStrength >= 80) return "allied";
  if (relationStrength >= 60) return "friendly";
  if (relationStrength >= 40) return "neutral";
  return relationStrength >= 20 ? "tense" : "hostile";
}

function threatLevel(score: number): ThreatLevel {
  if (score < 20) return "minimal";
  if (score < 40) return "low";
  if (score < 60) return "moderate";
  return score < 80 ? "high" : "critical";
}

export function securityStatus(score: number): SecurityStatus {
  if (score >= 80) return "secure";
  if (score >= 60) return "guarded";
  return score >= 40 ? "elevated" : "critical";
}

function deriveNeighborThreat(neighbor: NeighborInput, input: ThreatPictureInput): NeighborThreat {
  const militaryThreat = strengthShare(neighbor.strength, input.ownStrength);
  // An unknown relation counts as neutral (50).
  const hostility = 100 - (neighbor.relationStrength ?? 50);
  const inConflict = input.conflicts.some((c) => c.opponentId === neighbor.countryId);
  const actions = input.hostileActions.filter((a) => a.initiatorId === neighbor.countryId);
  const threatScore = clamp100(
    0.5 * militaryThreat +
      0.5 * hostility +
      (inConflict ? CONFLICT_WITH_NEIGHBOR : 0) +
      (actions.length > 0 ? HOSTILE_ACTION_BY_NEIGHBOR : 0)
  );
  const notes = [
    inConflict ? "Conflict pending or under way" : null,
    ...actions.map((a) => `${FP_LABELS[a.actionType] ?? "Hostile action"} in force`),
  ].filter((n): n is string => n !== null);
  return {
    id: `neighbor-${neighbor.countryId}`,
    neighborCountryId: neighbor.countryId,
    neighborName: neighbor.name,
    borderType: "land",
    threatLevel: threatLevel(threatScore),
    threatScore,
    militaryThreat,
    diplomaticRelations: stance(neighbor.relationStrength),
    notes: notes.length > 0 ? notes.join(". ") : null,
  };
}

/** Border security: 100 with no land neighbours, lowered by the worst and the average neighbour threat. */
function borderSecurityScore(neighborThreats: NeighborThreat[]): number {
  if (neighborThreats.length === 0) return 100;
  const scores = neighborThreats.map((n) => n.threatScore);
  const worst = Math.max(...scores);
  const average = scores.reduce((s, n) => s + n, 0) / scores.length;
  return clamp100(100 - (0.6 * worst + 0.4 * average));
}

/** Own strength against the strongest neighbour or rival, 0-100 (100 with no armed rival). */
function militaryStrengthScore(input: ThreatPictureInput): number {
  if (input.ownStrength <= 0) return 0;
  const rivals = [
    ...input.neighbors.map((n) => n.strength),
    ...Object.values(input.rivalStrengths),
  ];
  const strongest = Math.max(0, ...rivals);
  return strongest > 0 ? 100 - strengthShare(strongest, input.ownStrength) : 100;
}

export function deriveThreatPicture(input: ThreatPictureInput): ThreatPicture {
  const threats = deriveThreats(input);
  const neighborThreats = input.neighbors
    .map((n) => deriveNeighborThreat(n, input))
    .sort((a, b) => b.threatScore - a.threatScore);
  const borderSecurity = borderSecurityScore(neighborThreats);
  const militaryStrength = militaryStrengthScore(input);
  const threatPressure = clamp100(
    100 - threats.reduce((s, t) => s + SEVERITY_WEIGHT[t.severity], 0)
  );
  const overallSecurityScore = clamp100((militaryStrength + borderSecurity + threatPressure) / 3);
  return {
    threats,
    neighborThreats,
    landBorders: input.neighbors.length,
    borderSecurity,
    borderStatus: securityStatus(borderSecurity),
    combatStrength: Math.round(input.ownStrength),
    militaryStrength,
    overallSecurityScore,
    securityLevel: securityStatus(overallSecurityScore),
    activeThreatCount: threats.length,
    highSeverityThreats: threats.filter((t) => t.severity === "high" || t.severity === "critical")
      .length,
  };
}
