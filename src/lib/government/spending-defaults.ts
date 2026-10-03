import { ComponentType } from "@prisma/client";

interface DerivedDirectiveInfo {
  id: string;
  name: string;
  category: string;
}

/**
 * Get human-readable directives enacted by selected components
 */
export function getDirectivesForComponents(components: ComponentType[]): DerivedDirectiveInfo[] {
  const directives: DerivedDirectiveInfo[] = [];
  const set = new Set(components);

  if (set.has(ComponentType.DEMOCRATIC_PROCESS) || set.has(ComponentType.ELECTORAL_LEGITIMACY)) {
    directives.push(
      { id: "participatoryBudgeting", name: "Participatory Budgeting", category: "Governance" },
      { id: "citizenEngagement", name: "Citizen Engagement Program", category: "Governance" },
      { id: "transparencyInitiative", name: "Public Transparency Directive", category: "Governance" }
    );
  }

  if (set.has(ComponentType.TECHNOCRATIC_PROCESS) || set.has(ComponentType.PERFORMANCE_LEGITIMACY)) {
    directives.push(
      { id: "performanceBasedBudgeting", name: "Performance-Based Budgeting", category: "Fiscal" },
      { id: "zeroBasedBudgeting", name: "Zero-Based Fiscal Auditing", category: "Fiscal" }
    );
  }

  if (set.has(ComponentType.WELFARE_STATE)) {
    directives.push(
      { id: "universalBasicServices", name: "Universal Basic Services", category: "Social" },
      { id: "affordableHousing", name: "Public Housing Access", category: "Social" },
      { id: "childWelfareFirstPolicy", name: "Child Welfare Priority", category: "Social" }
    );
  }

  if (set.has(ComponentType.UNIVERSAL_HEALTHCARE)) {
    directives.push(
      { id: "universalHealthcare", name: "Universal Healthcare Mandate", category: "Health" },
      { id: "preventiveCareEmphasis", name: "Preventive Care Priority", category: "Health" }
    );
  }

  if (set.has(ComponentType.PUBLIC_EDUCATION)) {
    directives.push(
      { id: "freeEducation", name: "Tuition-Free Public Education", category: "Education" },
      { id: "stemEducationFocus", name: "STEM Research Curriculum", category: "Education" }
    );
  }

  if (set.has(ComponentType.ENVIRONMENTAL_PROTECTION)) {
    directives.push(
      { id: "greenInvestmentPriority", name: "Green Energy Transition", category: "Environment" },
      { id: "biodiversityProtection", name: "Ecological Conservation", category: "Environment" }
    );
  }

  if (set.has(ComponentType.DIGITAL_GOVERNMENT) || set.has(ComponentType.DIGITAL_INFRASTRUCTURE)) {
    directives.push(
      { id: "digitalGovernmentInitiative", name: "Digital Services Overhaul", category: "Digital" },
      { id: "openDataInitiative", name: "Open Data Access Mandate", category: "Digital" }
    );
  }

  if (set.has(ComponentType.CYBERSECURITY)) {
    directives.push(
      { id: "cybersecurityInitiative", name: "National Cyber Defense Directive", category: "Defense" }
    );
  }

  if (set.has(ComponentType.RESEARCH_AND_DEVELOPMENT)) {
    directives.push(
      { id: "researchDevelopmentFund", name: "R&D Sovereign Capital Fund", category: "Innovation" }
    );
  }

  if (set.has(ComponentType.RULE_OF_LAW) || set.has(ComponentType.INSTITUTIONAL_LEGITIMACY)) {
    directives.push(
      { id: "antiCorruption", name: "Independent Integrity & Anti-Corruption", category: "Legal" },
      { id: "courtSystemModernization", name: "Judicial Modernization Directive", category: "Legal" }
    );
  }

  if (set.has(ComponentType.MULTILATERAL_DIPLOMACY)) {
    directives.push(
      { id: "diplomaticEngagement", name: "Multilateral Accords Directive", category: "Diplomacy" }
    );
  }

  return directives;
}
