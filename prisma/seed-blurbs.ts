/**
 * seed-blurbs.ts — Seed the BlurbPrompt table with curated prompts
 * derived from the #lore-prompts Discord channel (2022–2025).
 *
 * Run: npx tsx prisma/seed-blurbs.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const SYSTEM_USER_ID = "system";

interface SeedPrompt {
  title: string;
  question: string;
  slug: string;
  status: "ACTIVE" | "DRAFT";
}

const PROMPTS: SeedPrompt[] = [
  // ── Culture & Daily Life ───────────────────────────────────────────────
  {
    title: "Hospitality & Customs",
    question:
      "How does your country deal with the reception of a foreign guest into one's home or office? What are the customs around hospitality?",
    slug: "hospitality-customs",
    status: "ACTIVE",
  },
  {
    title: "Nightlife",
    question:
      "What is nightlife like in your country? Bars, dance clubs, music venues, street food carts, late-night gatherings — what gets your people going after dark?",
    slug: "nightlife",
    status: "ACTIVE",
  },
  {
    title: "The Most Famous Bar",
    question:
      "What is the most famous bar in your country, for any reason at all? If your country bans alcohol, what is the most famous gathering place?",
    slug: "famous-bar",
    status: "ACTIVE",
  },
  {
    title: "Television & Entertainment",
    question:
      "Tell me about your country's televised entertainment. Cable TV? Digital? Streaming services? Do you dub over or subtitle foreign content?",
    slug: "television-entertainment",
    status: "ACTIVE",
  },
  {
    title: "Media & Entertainment Industry",
    question:
      "What does the media and entertainment industry look like in your country? Do you have a Hollywood equivalent? Who are some of the most notable actors, musicians, and artists?",
    slug: "media-entertainment",
    status: "ACTIVE",
  },
  {
    title: "Fashion & Clothing",
    question:
      "What kind of clothes are popular in your country? What are the fashion trends, traditional garments, and everyday wear?",
    slug: "fashion-clothing",
    status: "ACTIVE",
  },
  {
    title: "Halloween & Autumn Festivals",
    question:
      "How is Samhain, Day of the Dead, Halloween, or similar autumn/remembrance festivals celebrated in your country?",
    slug: "halloween-autumn-festivals",
    status: "ACTIVE",
  },
  {
    title: "National Cuisine",
    question:
      "What cuisine is popular in your country? What are the staple dishes, street foods, and celebrated recipes that define your national palate?",
    slug: "national-cuisine",
    status: "ACTIVE",
  },

  // ── History & Founding ─────────────────────────────────────────────────
  {
    title: "National Founding Fathers",
    question:
      "Does your nation have one or more characters considered crucial to its foundation? Was it a conquering warlord or a uniting leader of peoples?",
    slug: "founding-fathers",
    status: "ACTIVE",
  },
  {
    title: "Pyrrhic Victories",
    question:
      "What was a strategic defeat or a pyrrhic victory that your country fought? What were the consequences?",
    slug: "pyrrhic-victories",
    status: "ACTIVE",
  },
  {
    title: "Forgotten Wars",
    question:
      "Detail a major conflict in your nation's history that has since been erased, censored, or forgotten from your nation's records.",
    slug: "forgotten-wars",
    status: "DRAFT",
  },
  {
    title: "False Histories",
    question:
      "Write about a major conspiracy theory regarding your nation's history, and how it conflicts with its true history.",
    slug: "false-histories",
    status: "DRAFT",
  },
  {
    title: "Local Rebellions",
    question:
      "Detail a small-scale, local rebellion or protest against authority. What were the grievances, the key figures, and the ultimate outcome?",
    slug: "local-rebellions",
    status: "DRAFT",
  },
  {
    title: "A Significant Immigrant",
    question:
      "Tell the life and times of a person from another nation that moved to your country and had a major impact on its economy, society, religion, military, or political history.",
    slug: "significant-immigrant",
    status: "DRAFT",
  },

  // ── Government & Society ───────────────────────────────────────────────
  {
    title: "Civic Duties",
    question:
      "What civic duties and responsibilities do the citizens of your country have? Mandatory service, voting, jury duty, community obligations?",
    slug: "civic-duties",
    status: "ACTIVE",
  },
  {
    title: "Policing & Law Enforcement",
    question:
      "Who keeps law and order in your nation? Is there a single national police force, regional cops, or both? How is law enforcement perceived by the public?",
    slug: "policing",
    status: "ACTIVE",
  },
  {
    title: "Immigration",
    question:
      "Does your nation experience much in the way of emigration or immigration? What government bodies handle immigration, and what are the policies?",
    slug: "immigration",
    status: "ACTIVE",
  },
  {
    title: "Nondiscrimination Laws",
    question:
      "What are the nondiscrimination laws in force in your country, if any? Which groups do they cover, and in what areas of life? How far do they extend into the private sector?",
    slug: "nondiscrimination-laws",
    status: "DRAFT",
  },
  {
    title: "Stolen Valor",
    question:
      "What would be the legal consequences in your nation for things such as lying about or exaggerating military service, or wearing medals they did nothing to earn?",
    slug: "stolen-valor",
    status: "DRAFT",
  },

  // ── Economy & Resources ────────────────────────────────────────────────
  {
    title: "Energy Generation",
    question:
      "What are the main sources of energy generation in your country? How big a portion does each represent, and in what direction is it changing?",
    slug: "energy-generation",
    status: "ACTIVE",
  },
  {
    title: "Largest GDP Source",
    question:
      "What is your nation's largest single source of GDP? It could be natural resources, services, or manufacturing — what is the history of that industry and how does it shape the national economy?",
    slug: "largest-gdp-source",
    status: "ACTIVE",
  },
  {
    title: "Economic Vision",
    question:
      "Where does your nation see itself, economically, in the future? Do you want to become a regional power, a self-sufficient utopia, or a hub for innovation and trade? What steps are you taking?",
    slug: "economic-vision",
    status: "ACTIVE",
  },
  {
    title: "Merchant Guilds & Trading Companies",
    question:
      "Beyond official governments, what powerful merchant guilds, trading companies, or financial institutions held significant sway over historical events and political decisions in your nation?",
    slug: "merchant-guilds",
    status: "DRAFT",
  },
  {
    title: "Agriculture & Food Security",
    question:
      "What is your nation's agricultural landscape like? What are the primary cereal grains, livestock, and cash crops? How does food security factor into national policy?",
    slug: "agriculture-food-security",
    status: "ACTIVE",
  },

  // ── Geography & Environment ────────────────────────────────────────────
  {
    title: "Major Geographic Feature",
    question:
      "Detail a major geographical feature of your nation, including its origins, role in your nation's daily life, and any cultural or economic significance it brings.",
    slug: "geographic-feature",
    status: "DRAFT",
  },
  {
    title: "Natural Disasters",
    question:
      "What are the largest natural disasters in your nation's history? How many died or were displaced? Did any of them effect social or regime change?",
    slug: "natural-disasters",
    status: "ACTIVE",
  },
  {
    title: "Provincial Climate & Resources",
    question:
      "Research the climate for one of your provinces. What grows there, what animals live there, what building materials exist, and how does this shape local architecture and culture?",
    slug: "provincial-climate",
    status: "DRAFT",
  },
  {
    title: "World Heritage Sites",
    question:
      "What are the LoNESCO world heritage sites in your nation? Describe their history and cultural significance.",
    slug: "world-heritage-sites",
    status: "ACTIVE",
  },

  // ── Military ───────────────────────────────────────────────────────────
  {
    title: "Military Rations",
    question:
      "What does your military's average basic field ration contain? How long does it last? How do you eat it and heat it? Is it inspired by traditional cuisine or just calorie-rich grub?",
    slug: "military-rations",
    status: "ACTIVE",
  },
  {
    title: "Military Procurement Disasters",
    question:
      "What is the most plagued military procurement program in the history of your nation? Cost overruns? Did the product ever make it? What is your procurement landscape like?",
    slug: "military-procurement",
    status: "DRAFT",
  },

  // ── International Relations ────────────────────────────────────────────
  {
    title: "LON Headquarters Donation",
    question:
      "What has your country donated to the League of Nations' headquarters as a representation of your country's culture made manifest?",
    slug: "lon-donation",
    status: "ACTIVE",
  },
  {
    title: "Contested Borderlands",
    question:
      "Choose one of your provinces that has historically been a contested borderland between different powers or ethnic groups. How has this constant tension shaped its unique culture, architecture, and identity?",
    slug: "contested-borderlands",
    status: "DRAFT",
  },

  // ── Demographics ───────────────────────────────────────────────────────
  {
    title: "Average Height",
    question:
      "What is the average height in your country? Are there any groups that are major outliers? Are height differences between genders exaggerated or reduced by historical, dietary, or customary factors?",
    slug: "average-height",
    status: "ACTIVE",
  },

  // ── Religion & Philosophy ──────────────────────────────────────────────
  {
    title: "Religion & Technology",
    question:
      "How do the historical influences of major churches and religions in your country adapt to emerging social changes and ethical dilemmas posed by AI, automation, and globalized culture?",
    slug: "religion-technology",
    status: "DRAFT",
  },
];

async function main() {
  console.log(`Seeding ${PROMPTS.length} blurb prompts...`);

  let created = 0;
  let skipped = 0;

  for (const p of PROMPTS) {
    const existing = await db.blurbPrompt.findUnique({
      where: { slug: p.slug },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await db.blurbPrompt.create({
      data: {
        title: p.title,
        question: p.question,
        slug: p.slug,
        status: p.status,
        publishedAt: p.status === "ACTIVE" ? new Date() : null,
        createdBy: SYSTEM_USER_ID,
      },
    });
    created++;
  }

  console.log(`Done: ${created} created, ${skipped} skipped (already exist).`);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
