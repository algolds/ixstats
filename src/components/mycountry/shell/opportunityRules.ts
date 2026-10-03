import {
  Shield,
  Community as Handshake,
  ScaleFrameEnlarge as Scale,
  StatUp as TrendingUp,
  KeyCommand as Command,
  WarningCircle as AlertCircle,
} from "iconoir-react";
import type { RouterOutputs } from "~/trpc/react";
import type { useCountryData } from "~/components/mycountry/shared/primitives";
import type { DrillSheetKind } from "~/components/mycountry/shell/DrillSheets";
import { formatGrowthPeek } from "./ExecutiveActionCards";
import type { StatusTone } from "./status-tone";

export type OpportunityDrill = Exclude<DrillSheetKind, { kind: "intent" } | null>;

export interface Opportunity {
  id: string;
  domain: "defense" | "diplomacy" | "politics" | "economy" | "intent";
  title: string;
  subtitle: string;
  description: string;
  metricLabel?: string;
  metricValue?: string;
  icon: typeof Shield;
  tone: StatusTone;
  intentId?: string;
  drillKind?: OpportunityDrill;
}

export interface CountryIssueItem {
  id: string;
  title: string;
  description?: string | null;
  severity?: string | null;
  urgency?: number | null;
}

export interface CountryIntentItem {
  id: string;
  goal?: string | null;
  status?: string | null;
  tier?: string | null;
  category?: string | null;
}

export interface OpportunityContext {
  country: ReturnType<typeof useCountryData>["country"];
  issues: CountryIssueItem[];
  intents: CountryIntentItem[];
  civilService: RouterOutputs["government"]["getCivilServiceStatus"] | undefined;
  isDismissed: (id: string) => boolean;
}

const finiteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2 };
const severityOf = (issue: CountryIssueItem) => String(issue.severity ?? "").toLowerCase();
const issueScore = (issue: CountryIssueItem) =>
  (SEVERITY_RANK[severityOf(issue)] ?? 1) * 100 + (issue.urgency ?? 0);

const capitalize = (part: string) => part.charAt(0).toUpperCase() + part.slice(1);

// Only real figures drive the hero: a missing value skips its card, it is never invented.
type Rule = (ctx: OpportunityContext) => Opportunity | null;

/** Critical and urgent national issues come first. */
const issueRule: Rule = ({ issues, isDismissed }) => {
  const top = issues
    .filter((issue) => !isDismissed(`issue-${issue.id}`))
    .sort((a, b) => issueScore(b) - issueScore(a))[0];
  if (!top) return null;

  const isUrgent = ["critical", "high"].includes(severityOf(top)) || (top.urgency ?? 0) > 70;
  return {
    id: `issue-${top.id}`,
    domain: "politics",
    title: top.title,
    subtitle: isUrgent ? "Priority national issue" : "Open national issue",
    description: top.description || "This issue is waiting for your decision.",
    icon: AlertCircle,
    tone: isUrgent ? "critical" : "warning",
    drillKind: { kind: "issue", issueId: top.id },
  };
};

const defenseRule: Rule = ({ country, isDismissed }) => {
  const readiness = finiteNumber(country?.militaryReadiness ?? country?.readiness);
  if (readiness === null || readiness >= 85 || isDismissed("defense-readiness")) return null;

  const posture: string | null = country?.defensePosture ?? country?.posture ?? null;
  return {
    id: "defense-readiness",
    domain: "defense",
    title: "Military readiness is below target",
    subtitle: "Defense warning",
    description:
      "Armed forces readiness is under 85%. Reallocate supplies or adjust your defensive posture.",
    metricLabel: "Readiness",
    metricValue: posture ? `${readiness}% · ${posture}` : `${readiness}%`,
    icon: Shield,
    tone: "critical",
    drillKind: { kind: "defense" },
  };
};

const civilServiceRule: Rule = ({ civilService, isDismissed }) => {
  if (!civilService?.overCapacity || isDismissed("civil-service-overcap")) return null;
  return {
    id: "civil-service-overcap",
    domain: "politics",
    title: "Civil service bottleneck",
    subtitle: "Governance alert",
    description: "The civil service is over capacity. Add staff slots or rebalance allocations.",
    metricLabel: "Staff capacity",
    metricValue: `${civilService.utilizationPercent}% used`,
    icon: Scale,
    tone: "warning",
    drillKind: { kind: "politics" },
  };
};

const intentRule: Rule = ({ intents, isDismissed }) => {
  const top = intents.find(
    (intent) => intent.status?.toLowerCase() === "active" && !isDismissed(`intent-${intent.id}`)
  );
  if (!top) return null;
  return {
    id: `intent-${top.id}`,
    domain: "intent",
    title: top.goal ?? "Active directive",
    subtitle: "Directive in progress",
    description:
      "Your government is carrying out this directive. Check its progress or follow up with another.",
    metricLabel: "Package",
    metricValue:
      [top.tier, top.category]
        .filter((part): part is string => !!part)
        .map(capitalize)
        .join(" · ") || "Active",
    icon: Command,
    tone: "accent",
    intentId: top.id,
  };
};

const diplomacyRule: Rule = ({ country, isDismissed }) => {
  const embassies = finiteNumber(country?.activeEmbassiesCount ?? country?.embassies?.length) ?? 0;
  if (embassies <= 0 || isDismissed("diplomacy-opportunity")) return null;

  const stance: string | null = country?.diplomaticStance ?? null;
  return {
    id: "diplomacy-opportunity",
    domain: "diplomacy",
    title: "Bilateral alliance opportunity",
    subtitle: "Diplomatic opportunity",
    description: "Your embassies could support new bilateral accords and trade pacts.",
    metricLabel: "Embassies",
    metricValue: stance ? `${embassies} · ${stance}` : `${embassies}`,
    icon: Handshake,
    tone: "neutral",
    drillKind: { kind: "relations" },
  };
};

const economyRule: Rule = ({ country, isDismissed }) => {
  if (isDismissed("economy-growth")) return null;

  const growth = formatGrowthPeek(country);
  // InternalStabilityMetrics.stabilityScore (0-100); omitted until it has been computed
  const stability = country?.stabilityMetrics?.stabilityScore;
  const stabilityNote =
    typeof stability === "number" ? ` · ${Math.round(stability)}% stability` : "";
  return {
    id: "economy-growth",
    domain: "economy",
    title: "Set an economic priority",
    subtitle: "Suggested priority",
    description:
      "No urgent issues. A growth Directive could target investment, tax incentives or fiscal stimulus.",
    ...(growth ? { metricLabel: "GDP growth", metricValue: `${growth}${stabilityNote}` } : {}),
    icon: TrendingUp,
    tone: "neutral",
    drillKind: { kind: "economy" },
  };
};

const RULES: Rule[] = [
  issueRule,
  defenseRule,
  civilServiceRule,
  intentRule,
  diplomacyRule,
  economyRule,
];

/** The single most pressing thing to show the executive, in fixed priority order. */
export function deriveOpportunity(ctx: OpportunityContext): Opportunity | null {
  for (const rule of RULES) {
    const opportunity = rule(ctx);
    if (opportunity) return opportunity;
  }
  return null;
}
