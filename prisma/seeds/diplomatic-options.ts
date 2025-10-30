/**
 * Diplomatic Options Seed Script
 * Migrates hardcoded diplomatic profile options from src/lib/diplomatic-profile-options.ts to database
 *
 * Run with: npx tsx prisma/seeds/diplomatic-options.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Auto-categorize options based on keywords in the label
 */
function categorizeOption(label: string): string {
  const lowerLabel = label.toLowerCase();

  // Economic keywords
  if (
    lowerLabel.includes("economic") ||
    lowerLabel.includes("trade") ||
    lowerLabel.includes("investment") ||
    lowerLabel.includes("market") ||
    lowerLabel.includes("financial") ||
    lowerLabel.includes("business") ||
    lowerLabel.includes("commerce") ||
    lowerLabel.includes("gdp") ||
    lowerLabel.includes("fiscal")
  ) {
    return "economic";
  }

  // Military keywords
  if (
    lowerLabel.includes("military") ||
    lowerLabel.includes("defense") ||
    lowerLabel.includes("security") ||
    lowerLabel.includes("intelligence") ||
    lowerLabel.includes("terrorism") ||
    lowerLabel.includes("peacekeeping") ||
    lowerLabel.includes("border") ||
    lowerLabel.includes("maritime")
  ) {
    return "military";
  }

  // Technology keywords
  if (
    lowerLabel.includes("technology") ||
    lowerLabel.includes("digital") ||
    lowerLabel.includes("innovation") ||
    lowerLabel.includes("research") ||
    lowerLabel.includes("space") ||
    lowerLabel.includes("artificial intelligence") ||
    lowerLabel.includes("ai ") ||
    lowerLabel.includes("telecommunications") ||
    lowerLabel.includes("cybersecurity") ||
    lowerLabel.includes("5g") ||
    lowerLabel.includes("satellite") ||
    lowerLabel.includes("patent")
  ) {
    return "technology";
  }

  // Environmental keywords
  if (
    lowerLabel.includes("climate") ||
    lowerLabel.includes("energy") ||
    lowerLabel.includes("environmental") ||
    lowerLabel.includes("renewable") ||
    lowerLabel.includes("sustainable") ||
    lowerLabel.includes("water") ||
    lowerLabel.includes("conservation") ||
    lowerLabel.includes("emission") ||
    lowerLabel.includes("carbon")
  ) {
    return "environmental";
  }

  // Cultural keywords
  if (
    lowerLabel.includes("cultural") ||
    lowerLabel.includes("education") ||
    lowerLabel.includes("scientific") ||
    lowerLabel.includes("student") ||
    lowerLabel.includes("scholar") ||
    lowerLabel.includes("university") ||
    lowerLabel.includes("heritage") ||
    lowerLabel.includes("artist") ||
    lowerLabel.includes("language") ||
    lowerLabel.includes("sports") ||
    lowerLabel.includes("festival") ||
    lowerLabel.includes("media") ||
    lowerLabel.includes("broadcasting") ||
    lowerLabel.includes("film") ||
    lowerLabel.includes("arts")
  ) {
    return "cultural";
  }

  // Social keywords
  if (
    lowerLabel.includes("healthcare") ||
    lowerLabel.includes("medical") ||
    lowerLabel.includes("pandemic") ||
    lowerLabel.includes("telemedicine") ||
    lowerLabel.includes("humanitarian") ||
    lowerLabel.includes("refugee") ||
    lowerLabel.includes("disaster") ||
    lowerLabel.includes("crisis")
  ) {
    return "social";
  }

  // Diplomatic keywords (default for many items)
  if (
    lowerLabel.includes("diplomatic") ||
    lowerLabel.includes("embassy") ||
    lowerLabel.includes("consulate") ||
    lowerLabel.includes("ambassador") ||
    lowerLabel.includes("state visit") ||
    lowerLabel.includes("summit") ||
    lowerLabel.includes("partnership") ||
    lowerLabel.includes("alliance") ||
    lowerLabel.includes("treaty") ||
    lowerLabel.includes("agreement") ||
    lowerLabel.includes("cooperation") ||
    lowerLabel.includes("visa") ||
    lowerLabel.includes("bilateral") ||
    lowerLabel.includes("regional")
  ) {
    return "diplomatic";
  }

  // Default to diplomatic if no specific category matches
  return "diplomatic";
}

/**
 * Strategic Priorities - 39 options
 */
const STRATEGIC_PRIORITIES = [
  // Economic & Trade
  "Economic Cooperation",
  "Trade Expansion",
  "Investment Opportunities",
  "Free Trade Agreement Negotiation",
  "Market Access Enhancement",
  "Joint Economic Zones",
  "Financial Services Integration",
  "Agricultural Trade Partnership",

  // Military & Security
  "Military Alliance",
  "Defense Cooperation",
  "Intelligence Sharing",
  "Joint Security Operations",
  "Cybersecurity Partnership",
  "Counter-Terrorism Collaboration",
  "Border Security Coordination",
  "Maritime Security Partnership",

  // Technology & Innovation
  "Technology Transfer",
  "Joint Research Initiatives",
  "Digital Infrastructure Development",
  "Space Cooperation",
  "Innovation Hub Creation",
  "Artificial Intelligence Partnership",
  "Telecommunications Advancement",

  // Cultural & Social
  "Cultural Exchange",
  "Educational Partnership",
  "Scientific Collaboration",
  "Healthcare Cooperation",
  "Sports & Athletics Exchange",
  "Media & Broadcasting Partnership",

  // Environmental & Energy
  "Climate Cooperation",
  "Energy Security",
  "Renewable Energy Development",
  "Environmental Protection",
  "Sustainable Development Goals",
  "Water Resource Management",

  // Diplomatic & Political
  "Regional Stability",
  "Humanitarian Assistance",
  "Conflict Resolution",
  "Democratic Governance Support",
];

/**
 * Partnership Goals - 44 options
 */
const PARTNERSHIP_GOALS = [
  // Trade & Economic Goals
  "Bilateral Trade Growth by 50%",
  "Double Foreign Direct Investment",
  "Establish Joint Investment Fund",
  "Launch Free Trade Zone",
  "Reduce Trade Barriers by 75%",
  "Create Bilateral Business Council",
  "Sign Comprehensive Economic Partnership",
  "Establish Currency Swap Agreement",
  "Develop Cross-Border E-Commerce Platform",
  "Launch Joint Infrastructure Projects",

  // Mobility & Travel Goals
  "Visa-Free Travel Agreement",
  "Establish Direct Flight Routes",
  "Mutual Recognition of Driving Licenses",
  "Expedited Immigration Processing",
  "Digital Nomad Visa Program",

  // Military & Security Goals
  "Joint Military Exercises",
  "Sign Defense Cooperation Agreement",
  "Establish Joint Training Programs",
  "Create Intelligence Fusion Center",
  "Deploy Joint Peacekeeping Forces",
  "Cybersecurity Task Force Formation",

  // Educational & Cultural Goals
  "Student Exchange Programs (500+ annually)",
  "Scholar Exchange Programs",
  "Establish Joint Universities",
  "Cultural Festival Exchange",
  "Language Learning Partnerships",
  "Joint Cultural Heritage Preservation",
  "Artist Residency Programs",
  "Sports Team Exchange Programs",

  // Technology & Research Goals
  "Joint Research Project Launched",
  "Technology Innovation Hub Creation",
  "Patent Sharing Agreement",
  "Joint Space Mission",
  "Collaborative AI Research Initiative",
  "Digital Skills Development Program",

  // Environmental Goals
  "Joint Climate Action Plan",
  "Renewable Energy Capacity Doubling",
  "Cross-Border Conservation Area",
  "Zero-Emission Transport Corridor",
  "Circular Economy Partnership",

  // Healthcare & Social Goals
  "Healthcare Cooperation Agreement",
  "Medical Personnel Exchange",
  "Joint Pandemic Response Plan",
  "Telemedicine Network Establishment",
];

/**
 * Key Achievements - 48 options
 */
const KEY_ACHIEVEMENTS = [
  // Diplomatic Milestones
  "Embassy Established",
  "Consulate Network Expanded",
  "Ambassadorial Visit Completed",
  "State Visit Hosted",
  "Bilateral Summit Conducted",
  "Diplomatic Ties Upgraded",
  "Strategic Partnership Declared",
  "Comprehensive Partnership Agreement Signed",

  // Trade & Economic Achievements
  "Trade Agreement Signed",
  "Investment Treaty Ratified",
  "Double Taxation Agreement Implemented",
  "Trade Volume Exceeded $1 Billion",
  "Joint Investment Fund Launched ($500M)",
  "Free Trade Zone Operational",
  "Economic Corridor Established",
  "First Joint Venture Company Founded",

  // Military & Security Achievements
  "Defense Pact Ratified",
  "Joint Military Exercise Completed",
  "Intelligence Sharing Protocol Signed",
  "Counter-Terrorism Operation Successful",
  "Cybersecurity Cooperation Framework Adopted",
  "Joint Peacekeeping Mission Deployed",
  "Border Security Enhanced",

  // Cultural & Educational Achievements
  "Cultural Festival Hosted",
  "Exchange Programs Launched (1000+ participants)",
  "Joint University Established",
  "Cultural Center Opened",
  "Language Institute Founded",
  "Heritage Site Jointly Restored",
  "Film Co-Production Agreement Signed",
  "International Arts Exhibition Held",

  // Crisis Management & Cooperation
  "Crisis Mediation Successful",
  "Humanitarian Aid Delivered",
  "Disaster Relief Coordination Achieved",
  "Pandemic Response Collaboration",
  "Refugee Support Program Established",

  // Technology & Innovation
  "Joint Research Center Opened",
  "Technology Transfer Agreement Signed",
  "Innovation Hub Launched",
  "Patent Pool Created",
  "Digital Infrastructure Project Completed",
  "5G Network Collaboration Initiated",
  "Satellite Launch Cooperation",

  // Environmental & Energy
  "Climate Agreement Ratified",
  "Renewable Energy Project Completed",
  "Environmental Protection MOU Signed",
  "Carbon Neutrality Partnership Formed",
  "Cross-Border Conservation Success",
];

async function main() {
  console.log("Starting diplomatic options seed...");

  let totalCreated = 0;
  let totalSkipped = 0;

  // Process Strategic Priorities
  console.log("\n📋 Processing Strategic Priorities...");
  for (let i = 0; i < STRATEGIC_PRIORITIES.length; i++) {
    const label = STRATEGIC_PRIORITIES[i]!;
    const category = categorizeOption(label);

    try {
      const existing = await prisma.diplomaticOption.findUnique({
        where: {
          type_value: {
            type: "strategic_priority",
            value: label,
          },
        },
      });

      if (existing) {
        console.log(`  ⏭️  Skipped (exists): ${label}`);
        totalSkipped++;
      } else {
        await prisma.diplomaticOption.create({
          data: {
            type: "strategic_priority",
            category: category,
            value: label,
            sortOrder: i,
            isActive: true,
          },
        });
        console.log(`  ✅ Created: ${label} (${category})`);
        totalCreated++;
      }
    } catch (error) {
      console.error(`  ❌ Error processing "${label}":`, error);
    }
  }

  // Process Partnership Goals
  console.log("\n🎯 Processing Partnership Goals...");
  for (let i = 0; i < PARTNERSHIP_GOALS.length; i++) {
    const label = PARTNERSHIP_GOALS[i]!;
    const category = categorizeOption(label);

    try {
      const existing = await prisma.diplomaticOption.findUnique({
        where: {
          type_value: {
            type: "partnership_goal",
            value: label,
          },
        },
      });

      if (existing) {
        console.log(`  ⏭️  Skipped (exists): ${label}`);
        totalSkipped++;
      } else {
        await prisma.diplomaticOption.create({
          data: {
            type: "partnership_goal",
            category: category,
            value: label,
            sortOrder: i,
            isActive: true,
          },
        });
        console.log(`  ✅ Created: ${label} (${category})`);
        totalCreated++;
      }
    } catch (error) {
      console.error(`  ❌ Error processing "${label}":`, error);
    }
  }

  // Process Key Achievements
  console.log("\n🏆 Processing Key Achievements...");
  for (let i = 0; i < KEY_ACHIEVEMENTS.length; i++) {
    const label = KEY_ACHIEVEMENTS[i]!;
    const category = categorizeOption(label);

    try {
      const existing = await prisma.diplomaticOption.findUnique({
        where: {
          type_value: {
            type: "key_achievement",
            value: label,
          },
        },
      });

      if (existing) {
        console.log(`  ⏭️  Skipped (exists): ${label}`);
        totalSkipped++;
      } else {
        await prisma.diplomaticOption.create({
          data: {
            type: "key_achievement",
            category: category,
            value: label,
            sortOrder: i,
            isActive: true,
          },
        });
        console.log(`  ✅ Created: ${label} (${category})`);
        totalCreated++;
      }
    } catch (error) {
      console.error(`  ❌ Error processing "${label}":`, error);
    }
  }

  // Summary statistics
  console.log("\n" + "=".repeat(60));
  console.log("📊 Seed Summary:");
  console.log("=".repeat(60));
  console.log(`✅ Total created:       ${totalCreated}`);
  console.log(`⏭️  Total skipped:       ${totalSkipped}`);
  console.log(`📋 Strategic Priorities: ${STRATEGIC_PRIORITIES.length}`);
  console.log(`🎯 Partnership Goals:    ${PARTNERSHIP_GOALS.length}`);
  console.log(`🏆 Key Achievements:     ${KEY_ACHIEVEMENTS.length}`);
  console.log(
    `📝 Total options:        ${STRATEGIC_PRIORITIES.length + PARTNERSHIP_GOALS.length + KEY_ACHIEVEMENTS.length}`
  );
  console.log("=".repeat(60));

  // Category breakdown
  const allOptions = await prisma.diplomaticOption.findMany();
  const categoryStats = allOptions.reduce(
    (acc, option) => {
      acc[option.category] = (acc[option.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log("\n📊 Category Breakdown:");
  Object.entries(categoryStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`  ${category.padEnd(15)}: ${count}`);
    });

  console.log("\n✅ Diplomatic options seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
