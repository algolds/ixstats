/**
 * Diplomatic Profile Dropdown Options
 * Comprehensive options for embassy profile customization
 */

/**
 * Strategic Priorities - Areas of focus for diplomatic relationships
 * 39 options covering military, economic, cultural, technological, and environmental cooperation
 */
export const STRATEGIC_PRIORITIES = [
  // Economic & Trade
  'Economic Cooperation',
  'Trade Expansion',
  'Investment Opportunities',
  'Free Trade Agreement Negotiation',
  'Market Access Enhancement',
  'Joint Economic Zones',
  'Financial Services Integration',
  'Agricultural Trade Partnership',

  // Military & Security
  'Military Alliance',
  'Defense Cooperation',
  'Intelligence Sharing',
  'Joint Security Operations',
  'Cybersecurity Partnership',
  'Counter-Terrorism Collaboration',
  'Border Security Coordination',
  'Maritime Security Partnership',

  // Technology & Innovation
  'Technology Transfer',
  'Joint Research Initiatives',
  'Digital Infrastructure Development',
  'Space Cooperation',
  'Innovation Hub Creation',
  'Artificial Intelligence Partnership',
  'Telecommunications Advancement',

  // Cultural & Social
  'Cultural Exchange',
  'Educational Partnership',
  'Scientific Collaboration',
  'Healthcare Cooperation',
  'Sports & Athletics Exchange',
  'Media & Broadcasting Partnership',

  // Environmental & Energy
  'Climate Cooperation',
  'Energy Security',
  'Renewable Energy Development',
  'Environmental Protection',
  'Sustainable Development Goals',
  'Water Resource Management',

  // Diplomatic & Political
  'Regional Stability',
  'Humanitarian Assistance',
  'Conflict Resolution',
  'Democratic Governance Support',
] as const;

/**
 * Partnership Goals - Measurable objectives for bilateral relationships
 * 44 options with specific, actionable targets
 */
export const PARTNERSHIP_GOALS = [
  // Trade & Economic Goals
  'Bilateral Trade Growth by 50%',
  'Double Foreign Direct Investment',
  'Establish Joint Investment Fund',
  'Launch Free Trade Zone',
  'Reduce Trade Barriers by 75%',
  'Create Bilateral Business Council',
  'Sign Comprehensive Economic Partnership',
  'Establish Currency Swap Agreement',
  'Develop Cross-Border E-Commerce Platform',
  'Launch Joint Infrastructure Projects',

  // Mobility & Travel Goals
  'Visa-Free Travel Agreement',
  'Establish Direct Flight Routes',
  'Mutual Recognition of Driving Licenses',
  'Expedited Immigration Processing',
  'Digital Nomad Visa Program',

  // Military & Security Goals
  'Joint Military Exercises',
  'Sign Defense Cooperation Agreement',
  'Establish Joint Training Programs',
  'Create Intelligence Fusion Center',
  'Deploy Joint Peacekeeping Forces',
  'Cybersecurity Task Force Formation',

  // Educational & Cultural Goals
  'Student Exchange Programs (500+ annually)',
  'Scholar Exchange Programs',
  'Establish Joint Universities',
  'Cultural Festival Exchange',
  'Language Learning Partnerships',
  'Joint Cultural Heritage Preservation',
  'Artist Residency Programs',
  'Sports Team Exchange Programs',

  // Technology & Research Goals
  'Joint Research Project Launched',
  'Technology Innovation Hub Creation',
  'Patent Sharing Agreement',
  'Joint Space Mission',
  'Collaborative AI Research Initiative',
  'Digital Skills Development Program',

  // Environmental Goals
  'Joint Climate Action Plan',
  'Renewable Energy Capacity Doubling',
  'Cross-Border Conservation Area',
  'Zero-Emission Transport Corridor',
  'Circular Economy Partnership',

  // Healthcare & Social Goals
  'Healthcare Cooperation Agreement',
  'Medical Personnel Exchange',
  'Joint Pandemic Response Plan',
  'Telemedicine Network Establishment',
] as const;

/**
 * Key Achievements - Major milestones in diplomatic relationships
 * 48 options covering diplomatic, economic, cultural, and operational successes
 */
export const KEY_ACHIEVEMENTS = [
  // Diplomatic Milestones
  'Embassy Established',
  'Consulate Network Expanded',
  'Ambassadorial Visit Completed',
  'State Visit Hosted',
  'Bilateral Summit Conducted',
  'Diplomatic Ties Upgraded',
  'Strategic Partnership Declared',
  'Comprehensive Partnership Agreement Signed',

  // Trade & Economic Achievements
  'Trade Agreement Signed',
  'Investment Treaty Ratified',
  'Double Taxation Agreement Implemented',
  'Trade Volume Exceeded $1 Billion',
  'Joint Investment Fund Launched ($500M)',
  'Free Trade Zone Operational',
  'Economic Corridor Established',
  'First Joint Venture Company Founded',

  // Military & Security Achievements
  'Defense Pact Ratified',
  'Joint Military Exercise Completed',
  'Intelligence Sharing Protocol Signed',
  'Counter-Terrorism Operation Successful',
  'Cybersecurity Cooperation Framework Adopted',
  'Joint Peacekeeping Mission Deployed',
  'Border Security Enhanced',

  // Cultural & Educational Achievements
  'Cultural Festival Hosted',
  'Exchange Programs Launched (1000+ participants)',
  'Joint University Established',
  'Cultural Center Opened',
  'Language Institute Founded',
  'Heritage Site Jointly Restored',
  'Film Co-Production Agreement Signed',
  'International Arts Exhibition Held',

  // Crisis Management & Cooperation
  'Crisis Mediation Successful',
  'Humanitarian Aid Delivered',
  'Disaster Relief Coordination Achieved',
  'Pandemic Response Collaboration',
  'Refugee Support Program Established',

  // Technology & Innovation
  'Joint Research Center Opened',
  'Technology Transfer Agreement Signed',
  'Innovation Hub Launched',
  'Patent Pool Created',
  'Digital Infrastructure Project Completed',
  '5G Network Collaboration Initiated',
  'Satellite Launch Cooperation',

  // Environmental & Energy
  'Climate Agreement Ratified',
  'Renewable Energy Project Completed',
  'Environmental Protection MOU Signed',
  'Carbon Neutrality Partnership Formed',
  'Cross-Border Conservation Success',
] as const;

// Type exports for TypeScript usage
export type StrategicPriority = (typeof STRATEGIC_PRIORITIES)[number];
export type PartnershipGoal = (typeof PARTNERSHIP_GOALS)[number];
export type KeyAchievement = (typeof KEY_ACHIEVEMENTS)[number];

/**
 * Helper function to get all strategic priorities
 * @returns Array of strategic priority options
 */
export function getStrategicPriorities(): readonly string[] {
  return STRATEGIC_PRIORITIES;
}

/**
 * Helper function to get all partnership goals
 * @returns Array of partnership goal options
 */
export function getPartnershipGoals(): readonly string[] {
  return PARTNERSHIP_GOALS;
}

/**
 * Helper function to get all key achievements
 * @returns Array of key achievement options
 */
export function getKeyAchievements(): readonly string[] {
  return KEY_ACHIEVEMENTS;
}

/**
 * Get random samples from each category for demo/testing purposes
 */
export function getRandomSamples(count = 3) {
  const getRandomItems = <T>(arr: readonly T[], num: number): T[] => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, num);
  };

  return {
    priorities: getRandomItems(STRATEGIC_PRIORITIES, count),
    goals: getRandomItems(PARTNERSHIP_GOALS, count),
    achievements: getRandomItems(KEY_ACHIEVEMENTS, count),
  };
}

/**
 * Validate if a value is a valid option
 */
export function isValidStrategicPriority(
  value: string,
): value is StrategicPriority {
  return STRATEGIC_PRIORITIES.includes(value as StrategicPriority);
}

export function isValidPartnershipGoal(value: string): value is PartnershipGoal {
  return PARTNERSHIP_GOALS.includes(value as PartnershipGoal);
}

export function isValidKeyAchievement(value: string): value is KeyAchievement {
  return KEY_ACHIEVEMENTS.includes(value as KeyAchievement);
}
