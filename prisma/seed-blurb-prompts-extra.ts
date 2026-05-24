/**
 * seed-blurb-prompts-extra.ts — Add missing prompts from Discord #lore-prompts (2021-2022 era).
 * Run: npx tsx prisma/seed-blurb-prompts-extra.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const PROMPTS = [
  {
    title: "Hospitality & Guest Reception",
    question:
      "How does your country deal with the reception of a foreign guest into one's home or office? What are the customs around hospitality?",
    slug: "hospitality-guest-reception",
  },
  {
    title: "Veganism & Dietary Movements",
    question:
      "Do people in your country care about veganism or alternative diets? How mainstream is it, and what does the cultural attitude look like?",
    slug: "veganism-dietary-movements",
  },
  {
    title: "Spices & Seasonings",
    question:
      "What are the top spices in your nation? Are they imported or grown on a large scale domestically? How do they shape your national cuisine?",
    slug: "spices-seasonings",
  },
  {
    title: "Continuity of Government",
    question:
      "What is your nation's continuity of government plan? What happens when leadership is suddenly incapacitated or the capital is destroyed?",
    slug: "continuity-of-government",
  },
  {
    title: "Mega Construction Projects",
    question:
      "What are your nation's largest construction projects? Dams, bridges, skyscrapers, canals, walls, monuments — what have you built that defines your nation?",
    slug: "mega-construction",
  },
  {
    title: "Campfire Stories & Folklore",
    question:
      "One night on a camping trip, the adults and children gather round the fire. What stories, myths, or folklore would they tell? What legends does your nation keep alive?",
    slug: "campfire-stories-folklore",
  },
  {
    title: "National Heroes",
    question:
      "Who are the national heroes of your nation? Founders? War heroes? Scientists? Artists? Who gets a statue in the town square?",
    slug: "national-heroes",
  },
  {
    title: "National Tragedies",
    question:
      "Did the Great Depression bring your country to its knees? Did a natural disaster reshape your nation? What national tragedies define your collective memory?",
    slug: "national-tragedies",
  },
  {
    title: "Train Systems",
    question:
      "Are train lines for passengers in your country state-run or run by private entities? How extensive is your rail network, and what role does it play in daily life?",
    slug: "train-systems",
  },
  {
    title: "Symbols of Abandonment",
    question:
      "What is typically used in your country as a byword or symbol for abandonment, wilderness, or the frontier? What place or concept represents 'the middle of nowhere'?",
    slug: "symbols-of-abandonment",
  },
  {
    title: "Florida of Your Nation",
    question:
      "Where is your nation's Florida and why? That one region known for being wild, weird, or a cultural outlier.",
    slug: "your-nations-florida",
  },
  {
    title: "Oldest Settlement",
    question:
      "What is your nation's oldest permanent settlement? Roughly when was it founded? Is it still inhabited today, and what is it like now?",
    slug: "oldest-settlement",
  },
  {
    title: "Internet & Social Media",
    question:
      "How does your country interact with the internet and social media? Are there domestic platforms, government censorship, or a thriving online culture?",
    slug: "internet-social-media",
  },
  {
    title: "Agriculture & Food Production",
    question:
      "What kinds of food are grown in your country? How productive is your agricultural sector, and what role does farming play in your economy and culture?",
    slug: "agriculture-food-production",
  },
  {
    title: "Alcohol Culture",
    question:
      "What is alcohol consumption in your country like? Is it grown or imported? What are the popular drinks, and what's the drinking culture?",
    slug: "alcohol-culture",
  },
  {
    title: "Tourist Attractions",
    question:
      "What are the biggest tourist attractions in your nation? How important is tourism to your economy?",
    slug: "tourist-attractions",
  },
  {
    title: "Nightlife & After Dark",
    question:
      "What is nightlife like in your country? Bars, dance clubs, music venues, street food carts, late-night gatherings — what gets your people going after dark?",
    slug: "nightlife-after-dark",
  },
  {
    title: "Tropical Cyclones & Weather",
    question:
      "Does your nation face tropical cyclones, hurricanes, or typhoons? How do weather patterns shape your coastal infrastructure and emergency preparedness?",
    slug: "tropical-cyclones-weather",
  },
  {
    title: "Vanilla & Spice Trade",
    question:
      "How did your interactions with spice-producing regions result in the introduction of vanilla or other tropical spices to your country's cuisine?",
    slug: "vanilla-spice-trade",
  },
];

async function main() {
  console.log(`Seeding ${PROMPTS.length} extra blurb prompts...`);
  let created = 0;
  let skipped = 0;

  for (const p of PROMPTS) {
    const existing = await db.blurbPrompt.findUnique({ where: { slug: p.slug } });
    if (existing) {
      skipped++;
      continue;
    }

    await db.blurbPrompt.create({
      data: {
        title: p.title,
        question: p.question,
        slug: p.slug,
        status: "ACTIVE",
        publishedAt: new Date(),
        createdBy: "system",
      },
    });
    created++;
  }

  console.log(`Done: ${created} created, ${skipped} skipped.`);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
