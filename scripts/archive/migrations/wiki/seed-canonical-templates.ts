/**
 * seed-canonical-templates.ts — Curates & Seeds Canonical WikiOS Template Registry & Alias Mappings
 *
 * Configures the 10 Canonical Infoboxes and 4 Canonical Formatting Primitives
 * with rich TemplateData schemas, parameter definitions, and points legacy aliases to them.
 *
 * Usage:
 *   bun run scripts/wiki/seed-canonical-templates.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CanonicalTemplateDef {
  name: string;
  category: "infobox" | "formatting" | "navigation" | "citation";
  description: string;
  params: Record<
    string,
    {
      label: string;
      description?: string;
      type?: string;
      required?: boolean;
      default?: string;
      example?: string;
    }
  >;
  aliases: string[];
}

const CANONICAL_TEMPLATES: CanonicalTemplateDef[] = [
  {
    name: "Infobox Sovereign State",
    category: "infobox",
    description: "Official sovereign nation, empire, confederation, or realm factbook.",
    params: {
      common_name: { label: "Common Name", required: true, example: "Burgundie", type: "string" },
      official_name: { label: "Official Name", example: "Grand Republic of Burgundie", type: "string" },
      native_name: { label: "Native Name", example: "République de Bourgogne", type: "string" },
      capital: { label: "Capital City", required: true, example: "Vilena", type: "wiki-page-name" },
      largest_city: { label: "Largest City", example: "Vilena", type: "wiki-page-name" },
      leader_title1: { label: "Leader Title", example: "President", type: "string" },
      leader_name1: { label: "Leader Name", example: "Jean Dupont", type: "string" },
      population: { label: "Population", example: "45,200,000", type: "string" },
      gdp_nominal: { label: "Nominal GDP", example: "$1.82 Trillion", type: "string" },
      currency: { label: "Currency", example: "Burgundian Franc (BGF)", type: "string" },
      flag_image: { label: "Flag Image", example: "File:Flag_of_Burgundie.svg", type: "wiki-file-name" },
      coat_details: { label: "Coat of Arms", example: "File:Coat_of_Burgundie.svg", type: "wiki-file-name" },
      motto: { label: "National Motto", example: "Liberté, Ordre, Concorde", type: "string" },
    },
    aliases: ["Infobox country", "Infobox former country", "Infobox realm", "Infobox nation", "Country infobox"],
  },
  {
    name: "Infobox Settlement",
    category: "infobox",
    description: "City, municipality, town, province, or geographic district factbook.",
    params: {
      name: { label: "Settlement Name", required: true, example: "Vilena", type: "string" },
      settlement_type: { label: "Type", example: "Capital City & Municipality", type: "string" },
      subdivision_name: { label: "Country", required: true, example: "Burgundie", type: "wiki-page-name" },
      leader_title: { label: "Mayor / Governor", example: "Mayor", type: "string" },
      leader_name: { label: "Leader Name", example: "Clara Vane", type: "string" },
      area_km2: { label: "Total Area (km²)", example: "582", type: "number" },
      population_total: { label: "Total Population", example: "3,420,000", type: "string" },
      elevation_m: { label: "Elevation (m)", example: "142", type: "number" },
      image_skyline: { label: "City Skyline Image", example: "File:Vilena_Skyline.jpg", type: "wiki-file-name" },
    },
    aliases: ["Infobox settlement", "Infobox city", "Infobox town", "Infobox district", "Infobox municipality"],
  },
  {
    name: "Infobox Person",
    category: "infobox",
    description: "Head of state, diplomat, military commander, scientist, or notable historical figure.",
    params: {
      name: { label: "Full Name", required: true, example: "Arthur Vance", type: "string" },
      image: { label: "Portrait Image", example: "File:Arthur_Vance_Portrait.jpg", type: "wiki-file-name" },
      office: { label: "Primary Office / Title", example: "High Chancellor of Vesper", type: "string" },
      term_start: { label: "Term Start", example: "2020", type: "string" },
      term_end: { label: "Term End", example: "Present", type: "string" },
      predecessor: { label: "Predecessor", example: "Elena Rostova", type: "string" },
      successor: { label: "Successor", example: "TBD", type: "string" },
      birth_date: { label: "Birth Date", example: "14 May 1968", type: "string" },
      nationality: { label: "Nationality", example: "Vesperian", type: "string" },
      political_party: { label: "Party", example: "Concord Party", type: "string" },
    },
    aliases: ["Infobox person", "Infobox officeholder", "Infobox royalty", "Infobox biography", "Infobox leader"],
  },
  {
    name: "Infobox Naval Vessel",
    category: "infobox",
    description: "Warship, submarine, auxiliary vessel, or commercial fleet flagship.",
    params: {
      ship_name: { label: "Ship Name & Hull No.", required: true, example: "BNS Vilena (BB-04)", type: "string" },
      ship_class: { label: "Class", example: "Vilena-class Battleship", type: "string" },
      operator: { label: "Operating Navy", required: true, example: "Royal Burgundian Navy", type: "string" },
      builder: { label: "Shipyard Builder", example: "Vilena Naval Works", type: "string" },
      commissioned: { label: "Commissioned Date", example: "1938", type: "string" },
      displacement_tons: { label: "Displacement", example: "45,000 tonnes", type: "string" },
      speed_knots: { label: "Top Speed", example: "31 knots (57 km/h)", type: "string" },
      armament: { label: "Primary Armament", example: "9 × 406mm (16 in) Guns", type: "string" },
      ship_image: { label: "Vessel Image", example: "File:BNS_Vilena.jpg", type: "wiki-file-name" },
    },
    aliases: ["Infobox ship begin", "Infobox ship career", "Infobox ship characteristics", "Infobox ship image", "Infobox warship"],
  },
  {
    name: "Infobox Enterprise",
    category: "infobox",
    description: "Commercial corporation, state-owned enterprise, conglomerate, or financial bank.",
    params: {
      name: { label: "Company Name", required: true, example: "Solcordia Energy Corp", type: "string" },
      logo: { label: "Corporate Logo", example: "File:Solcordia_Logo.svg", type: "wiki-file-name" },
      industry: { label: "Primary Industry", required: true, example: "Energy & Infrastructure", type: "string" },
      headquarters: { label: "Headquarters", required: true, example: "Vilena, Burgundie", type: "string" },
      key_people: { label: "Key Executives", example: "Marcus Sterling (CEO)", type: "string" },
      revenue: { label: "Annual Revenue", example: "$42.5 Billion (2025)", type: "string" },
      employees: { label: "Total Employees", example: "84,000", type: "string" },
    },
    aliases: ["Infobox company", "Infobox business", "Infobox conglomerate", "Infobox bank", "Infobox corporation"],
  },
  {
    name: "Infobox Military Conflict",
    category: "infobox",
    description: "War, military campaign, tactical battle, siege, or border skirmish.",
    params: {
      conflict: { label: "Conflict Name", required: true, example: "The Sand War", type: "string" },
      partof: { label: "Part of (Campaign)", example: "Continental Border Wars", type: "string" },
      date: { label: "Date / Duration", required: true, example: "14 June 1984 – 3 August 1986", type: "string" },
      place: { label: "Location", required: true, example: "Northern Oakhaven Basin", type: "string" },
      result: { label: "Outcome / Result", required: true, example: "Decisive Burgundian Victory; Treaty of Vilena", type: "string" },
      combatant1: { label: "Combatants (Side A)", example: "Burgundie & Vesper Alliance", type: "string" },
      combatant2: { label: "Combatants (Side B)", example: "Paulastran Cyber Corps", type: "string" },
      commanders1: { label: "Commanders (Side A)", example: "Gen. Arthur Vance", type: "string" },
      commanders2: { label: "Commanders (Side B)", example: "Marshal Kirov", type: "string" },
      casualties1: { label: "Casualties (Side A)", example: "4,200 casualties", type: "string" },
      casualties2: { label: "Casualties (Side B)", example: "12,800 casualties", type: "string" },
    },
    aliases: ["Infobox military conflict", "Infobox battle", "Infobox war", "Infobox campaign", "Infobox conflict"],
  },
  {
    name: "Infobox Government Agency",
    category: "infobox",
    description: "Ministry, department, intelligence bureau, supreme court, or parliament.",
    params: {
      agency_name: { label: "Agency Name", required: true, example: "Ministry of Foreign Affairs", type: "string" },
      abbreviation: { label: "Abbreviation", example: "MFA", type: "string" },
      jurisdiction: { label: "Jurisdiction / Country", required: true, example: "Burgundie", type: "string" },
      headquarters: { label: "Headquarters", example: "Palais Vilena, Vilena", type: "string" },
      minister: { label: "Executive Minister", example: "Minister Jean Dupont", type: "string" },
      budget: { label: "Annual Budget", example: "$12.4 Billion", type: "string" },
      seal: { label: "Agency Seal", example: "File:MFA_Seal.svg", type: "wiki-file-name" },
    },
    aliases: ["Infobox government agency", "Infobox ministry", "Infobox department", "Infobox parliament", "Infobox agency"],
  },
  {
    name: "Infobox Military Unit",
    category: "infobox",
    description: "Army brigade, armored division, air force squadron, or special forces group.",
    params: {
      unit_name: { label: "Unit Designation", required: true, example: "1st Royal Armored Division", type: "string" },
      country: { label: "Allegiance", required: true, example: "Burgundie", type: "string" },
      branch: { label: "Service Branch", required: true, example: "Royal Army", type: "string" },
      active_dates: { label: "Active Period", example: "1924–present", type: "string" },
      commanding_officer: { label: "Commander", example: "Maj. Gen. Thomas Drake", type: "string" },
      garrison: { label: "Home Garrison", example: "Fort Oakhaven", type: "string" },
      insignia: { label: "Unit Insignia", example: "File:1st_Armored_Patch.svg", type: "wiki-file-name" },
    },
    aliases: ["Infobox military unit", "Infobox regiment", "Infobox brigade", "Infobox division", "Infobox squadron"],
  },
  {
    name: "Infobox Political Party",
    category: "infobox",
    description: "Political party, parliamentary faction, or electoral alliance.",
    params: {
      party_name: { label: "Party Name", required: true, example: "Concord Party", type: "string" },
      leader: { label: "Party Leader", example: "Chancellor Elspeth Kane", type: "string" },
      ideology: { label: "Political Ideology", required: true, example: "Liberal Democracy, Free Market", type: "string" },
      seats_parliament: { label: "Parliamentary Seats", example: "142 / 300 Seats (Majority)", type: "string" },
      colorcode: { label: "Party Color", example: "Sky Blue", type: "string" },
      headquarters: { label: "Headquarters", example: "Vilena", type: "string" },
    },
    aliases: ["Infobox political party", "Infobox political party/seats", "Infobox faction", "Infobox party"],
  },
  {
    name: "Infobox Weapon & Equipment",
    category: "infobox",
    description: "Firearm, artillery piece, main battle tank, fighter aircraft, or weapon system.",
    params: {
      name: { label: "Weapon Name", required: true, example: "MAG-17 Battle Rifle", type: "string" },
      origin: { label: "Country of Origin", required: true, example: "Burgundie", type: "string" },
      designer: { label: "Manufacturer / Designer", example: "Vilena Armory", type: "string" },
      caliber: { label: "Caliber / Cartridge", example: "7.62 × 51mm", type: "string" },
      effective_range: { label: "Effective Range", example: "600 m", type: "string" },
      rate_of_fire: { label: "Rate of Fire", example: "650 rounds/min", type: "string" },
      image: { label: "Weapon Image", example: "File:MAG-17_Rifle.jpg", type: "wiki-file-name" },
    },
    aliases: ["Infobox weapon", "Infobox firearm", "Infobox aircraft", "Infobox vehicle", "Infobox tank"],
  },
  {
    name: "Hatnote Capsule",
    category: "formatting",
    description: "Article disambiguation notice, main article reference, or redirect context banner.",
    params: {
      text: { label: "Notice Text", required: true, example: "This article is about the sovereign state. For the capital, see [[Vilena]].", type: "string" },
      type: { label: "Hatnote Type", default: "disambiguation", example: "disambiguation | redirect | main | see_also", type: "string" },
    },
    aliases: ["main", "See also", "main other", "hatnote", "disambiguation"],
  },
  {
    name: "Quote Box",
    category: "formatting",
    description: "Highlighted speech excerpt, lore document citation, or notable quotation capsule.",
    params: {
      quote: { label: "Quote Text", required: true, example: "Freedom is won in the assembly and held on the border.", type: "string" },
      author: { label: "Speaker / Author", required: true, example: "Chancellor Elspeth Kane", type: "string" },
      source: { label: "Source / Speech", example: "Address to the Continental Senate, 2021", type: "string" },
    },
    aliases: ["Cquote", "Quote", "Blockquote", "Quote box", "Pullquote"],
  },
  {
    name: "Dynamic Navbox Deck",
    category: "navigation",
    description: "Structured series footer, national ministry index, or topic navigation table.",
    params: {
      title: { label: "Navbox Header Title", required: true, example: "Provinces & Territories of Burgundie", type: "string" },
      group1: { label: "Category / Group 1", example: "Core Provinces", type: "string" },
      list1: { label: "Articles in Group 1", example: "[[Vilena]] • [[Oakhaven]] • [[Sudmoll]]", type: "string" },
      group2: { label: "Category / Group 2", example: "Autonomous Regions", type: "string" },
      list2: { label: "Articles in Group 2", example: "[[Vonein Basin]] • [[Seneca Islands]]", type: "string" },
    },
    aliases: ["Navbox", "Burgundie NavBox", "Vithinja NavBox", "KirCitiesNavbox", "SeriesNavbox"],
  },
  {
    name: "Citation Reference",
    category: "citation",
    description: "Standardized scholarly footnote, archive citation, or external reference link.",
    params: {
      title: { label: "Source Article / Book Title", required: true, example: "Constitutional History of Burgundie", type: "string" },
      author: { label: "Author", example: "Dr. Henri Dubois", type: "string" },
      year: { label: "Year / Date", example: "2018", type: "string" },
      publisher: { label: "Publisher / Journal", example: "Vilena University Press", type: "string" },
      url: { label: "External URL Link", example: "https://archives.ixwiki.com/doc/142", type: "string" },
    },
    aliases: ["Cite web", "Cite book", "Reflist", "Citation", "Cite news"],
  },
];

async function main() {
  console.log("==================================================================");
  console.log("💎 Seeding Canonical WikiOS Template Registry & Alias Links");
  console.log("==================================================================");

  let canonicalCount = 0;
  let aliasCount = 0;

  for (const t of CANONICAL_TEMPLATES) {
    const paramCount = Object.keys(t.params).length;

    // 1. Upsert Canonical Template
    await (prisma as any).wikiTemplate.upsert({
      where: { name: t.name },
      create: {
        name: t.name,
        description: t.description,
        category: t.category,
        templateData: {
          title: t.name,
          description: t.description,
          params: t.params,
          format: "block",
        },
        paramCount,
        isCanonical: true,
        canonicalTarget: null,
      },
      update: {
        description: t.description,
        category: t.category,
        templateData: {
          title: t.name,
          description: t.description,
          params: t.params,
          format: "block",
        },
        paramCount,
        isCanonical: true,
        canonicalTarget: null,
        lastSynced: new Date(),
      },
    });
    canonicalCount++;

    // 2. Map Legacy Aliases to Point to Canonical Template
    for (const alias of t.aliases) {
      await (prisma as any).wikiTemplate.upsert({
        where: { name: alias },
        create: {
          name: alias,
          description: `Alias redirect to canonical ${t.name}`,
          category: t.category,
          templateData: {
            title: alias,
            canonicalTarget: t.name,
            params: t.params,
          },
          paramCount,
          isCanonical: false,
          canonicalTarget: t.name,
        },
        update: {
          canonicalTarget: t.name,
          category: t.category,
          lastSynced: new Date(),
        },
      });
      aliasCount++;
    }

    console.log(`   ✓ Registered Canonical: "${t.name}" with ${t.aliases.length} mapped aliases.`);
  }

  console.log("\n📊 Canonical Registry Summary:");
  console.log(`   - Canonical Featured Templates: ${canonicalCount}`);
  console.log(`   - Mapped Legacy Aliases:        ${aliasCount}`);
  console.log("\n==================================================================");
  console.log("✅ Canonical Template Suite Successfully Seeded!");
  console.log("==================================================================");
}

main()
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
