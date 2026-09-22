import type { GovernmentType } from "~/types/government";

export const governmentTypes: GovernmentType[] = [
  "Constitutional Monarchy",
  "Federal Republic",
  "Parliamentary Democracy",
  "Presidential Republic",
  "Federal Constitutional Republic",
  "Unitary State",
  "Federation",
  "Confederation",
  "Empire",
  "City-State",
  "Other",
];

export const validStances = [
  "Balanced Budget Directive",
  "Deficit Spending Strategy",
  "Sovereign Surplus Target",
  "Emergency Austerity Mode",
];

export const validAudits = [
  "Public Oversight & Audit",
  "Standard Executive Audit",
  "Classified Strategic Budgeting",
];

export const validReserves = ["0%", "5%", "10%", "20%"];
export const validDebts = ["0%", "5%", "15%", "30%"];

export const stanceDetails: Record<string, { desc: string; tooltip: string }> = {
  "Balanced Budget Directive": {
    desc: "Mandates matching revenues with outlays. Prevents structural debt expansion.",
    tooltip: "Statutory mandate to balance revenues and spending, limiting debt expansion.",
  },
  "Deficit Spending Strategy": {
    desc: "Finances infrastructure and public goods via debt to stimulate growth.",
    tooltip: "Leverages public debt to invest in strategic growth sectors and public services.",
  },
  "Sovereign Surplus Target": {
    desc: "Allocates excess revenue to sovereign wealth funds and savings.",
    tooltip:
      "Targets systemic savings to build national reserves and long-term financial security.",
  },
  "Emergency Austerity Mode": {
    desc: "Drastically cuts public spending to stabilize a critical debt crisis.",
    tooltip:
      "Implements aggressive spending cuts to restore investor confidence and resolve crises.",
  },
};

export const auditDetails: Record<string, { desc: string; tooltip: string }> = {
  "Public Oversight & Audit": {
    desc: "Full public transparency and regular independent citizen audits.",
    tooltip: "Grants citizens and media full access to municipal and federal transaction records.",
  },
  "Standard Executive Audit": {
    desc: "Regular audits by executive agencies with normal legislative oversight.",
    tooltip: "Balanced model featuring professional administrative review and standard security.",
  },
  "Classified Strategic Budgeting": {
    desc: "Hidden strategic budgets to protect military and intelligence ops.",
    tooltip:
      "Shields national security, intelligence, and high-priority military expenditures from public view.",
  },
};

export const reserveDetails: Record<string, { label: string; desc: string; tooltip: string }> = {
  "0%": {
    label: "0% (Fully Allocated)",
    desc: "No buffer. All incoming revenues are actively spent immediately.",
    tooltip: "High-efficiency, low-resilience model. Vulnerable to sudden revenue drops.",
  },
  "5%": {
    label: "5% (Sovereign Buffer)",
    desc: "Standard reserves to manage minor revenue fluctuations.",
    tooltip: "Moderate buffer protecting core operations against typical economic cycles.",
  },
  "10%": {
    label: "10% (High Resilience)",
    desc: "Robust savings to weather severe recessions or supply shocks.",
    tooltip: "Prepares the state treasury for major domestic and international crises.",
  },
  "20%": {
    label: "20% (Austerity Stash)",
    desc: "Maximum savings under strict budget controls for absolute safety.",
    tooltip: "High savings rate that secures national solvency during catastrophic events.",
  },
};

export const debtDetails: Record<string, { label: string; desc: string; tooltip: string }> = {
  "0%": {
    label: "0% (Balanced Directive)",
    desc: "Strict zero borrowing policy. The nation runs entirely on cash.",
    tooltip: "Zero debt tolerance. Eliminates interest service costs but limits rapid scaling.",
  },
  "5%": {
    label: "5% (Conservative Borrowing)",
    desc: "Small, controlled loans to fund critical infrastructure.",
    tooltip: "Low-risk leverage model designed to maintain excellent credit ratings.",
  },
  "15%": {
    label: "15% (Growth Deficit)",
    desc: "Standard leverage to support expansion and developmental projects.",
    tooltip: "Moderate debt levels targeted towards high-return economic investments.",
  },
  "30%": {
    label: "30% (Aggressive Leveraged)",
    desc: "High debt ceiling to fund rapid industrialization or wartime mobilization.",
    tooltip:
      "High-leverage, high-risk strategy that accelerates development at the cost of high debt servicing.",
  },
};
