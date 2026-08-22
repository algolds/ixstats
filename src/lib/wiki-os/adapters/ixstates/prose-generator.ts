import { IxTime } from "~/lib/ixtime";

export interface ProseDetails {
  countryName: string;
  eventName: string; // e.g. policy name, issue title, target country
  details?: string;
  consequences?: Array<{
    targetField: string;
    delta: number;
    description?: string;
  }>;
  [key: string]: any;
}

export class WikiProseGenerator {
  /**
   * Generates wikitext prose for a given event type and associated details.
   */
  static generate(eventType: string, details: ProseDetails): string {
    const currentIxTime = IxTime.getCurrentIxTime();
    // Convert current in-game IxTime into a formatted date/period representation
    // Epoch is 2041-01-01, representing standard years.
    const year = Math.floor(currentIxTime / 12) + 2041;
    const month = (Math.floor(currentIxTime) % 12) + 1;
    const monthName = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ][month - 1];

    const timeStr = `[[IxTime: ${monthName} ${year}]]`;
    const country = `[[${details.countryName}]]`;

    const formatConsequences = (consequences = details.consequences): string => {
      if (!consequences || consequences.length === 0) return "";
      const parts = consequences.map((c) => {
        const sign = c.delta > 0 ? "+" : "";
        const label = this.getFieldLabel(c.targetField);
        return `${label} by '''${sign}${c.delta.toFixed(1)}%'''`;
      });
      if (parts.length === 1) return ` resulting in an adjustment of ${parts[0]}`;
      if (parts.length === 2) return ` resulting in adjustments of ${parts[0]} and ${parts[1]}`;
      return ` resulting in adjustments of ${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
    };

    switch (eventType.toLowerCase()) {
      case "policy_enacted":
      case "policy":
        return (
          `In ${timeStr}, the government of ${country} officially enacted the [[Policy: ${details.eventName}|${details.eventName}]] policy. ` +
          `According to cabinet advisors, this initiative was designed to target ${details.details || "national development goals"}${formatConsequences()}. ` +
          `The implementation is marked as active under the current administration's executive direction.`
        );

      case "policy_repealed":
        return (
          `In ${timeStr}, the government of ${country} formally repealed the [[Policy: ${details.eventName}|${details.eventName}]] policy. ` +
          `This decision followed legislative review of the policy's outcomes and cost-benefit metrics. ` +
          `All associated active storyteller effects and regulatory modifiers have been dissolved.`
        );

      case "policy_suspended":
        return (
          `In ${timeStr}, the government of ${country} suspended the [[Policy: ${details.eventName}|${details.eventName}]] policy. ` +
          `The suspension was implemented in response to ${details.details || "temporary structural adjustments"}. ` +
          `The policy's multipliers and effects are paused pending future administrative review.`
        );

      case "election_resolved":
      case "election":
        return (
          `A general legislative election was resolved in ${country} in ${timeStr}. ` +
          `The democratic process concluded with a recorded voter turnout of '''${(details.turnout ?? 75.0).toFixed(1)}%'''. ` +
          `The resulting legislative alignment has updated the seats in the [[Legislature: ${details.eventName}|${details.eventName}]] and redistributed political support among national parties.`
        );

      case "embassy_established":
      case "diplomacy":
        return (
          `In ${timeStr}, ${country} officially established a bilateral diplomatic embassy with [[${details.eventName}]]. ` +
          `The opening of this mission represents a strategic effort to foster regional cooperation, promote bilateral trade, and solidify international relations. ` +
          `The mission is fully staffed and active under the state's diplomatic department.`
        );

      case "decision_implemented":
      case "decision":
        return (
          `Following a cabinet session in ${timeStr}, the executive administration of ${country} implemented a strategic decision titled "${details.eventName}". ` +
          `This executive action resolved the agenda item concerning ${details.details || "administrative operations"}${formatConsequences()}. ` +
          `The decision has been logged in the national ledger and is in effect.`
        );

      case "national_issue_resolved":
      case "issue":
        return (
          `A critical national issue regarding "${details.eventName}" was resolved by ${country} in ${timeStr}. ` +
          `The administration chose the response: "''${details.details || "Applied standard resolution option"}''"${formatConsequences()}. ` +
          `The outcome has been audited and logged to ensure governmental accountability and stability.`
        );

      default:
        return (
          `An event of type "${eventType}" occurred in ${country} in ${timeStr}. ` +
          `Details: ${details.details || details.eventName || "No further details available."}`
        );
    }
  }

  /**
   * Helper to map database field names to friendly wiki display names.
   */
  private static getFieldLabel(field: string): string {
    const fieldLabels: Record<string, string> = {
      publicApproval: "Public Approval",
      unemploymentRate: "Unemployment Rate",
      inflationRate: "Inflation",
      currentTotalGdp: "GDP",
      currentGdpPerCapita: "GDP per Capita",
      infrastructureRating: "Infrastructure Rating",
      tradeBalance: "Trade Balance",
      povertyRate: "Poverty Rate",
      stabilityScore: "Internal Stability",
      crimeRate: "Crime Rate",
      protestFrequency: "Protest Frequency",
      riotRisk: "Riot Risk",
      socialCohesion: "Social Cohesion",
      ethnicTension: "Ethnic Tension",
      trustInGovernment: "Trust in Government",
      politicalStability: "Political Stability",
      democracyIndex: "Democracy Index",
      governmentEffectiveness: "Government Effectiveness",
      corruptionIndex: "Corruption Index",
      politicalPolarization: "Political Polarization",
      totalDebtGDPRatio: "Debt-to-GDP Ratio",
      economicVitality: "Economic Vitality",
      ruleOfLaw: "Rule of Law",
    };

    return fieldLabels[field] || field;
  }
}
