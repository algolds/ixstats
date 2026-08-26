/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { searchTemplates as searchTemplatesDB } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import {
  fetchTemplateData,
  getTemplatePreview as renderTemplatePreview,
  categorizeTemplate,
  isNoiseTemplate,
} from "~/lib/wiki-os/templates/template-registry";
import { db } from "~/server/db";
import type { Prisma } from "@prisma/client";

/**
 * Master Polymorphic Canonical Templates Registry.
 * Condenses legacy fragmented templates into unified masters with dynamic variant toggles.
 */
export const CANONICAL_BUILTIN_TEMPLATES = [
  // 1. Sovereign & Geopolitical
  {
    name: "Infobox country",
    description: "Master nation-state, realm, former empire, or territory factbook with dynamic variant toggles.",
    category: "sovereign",
    paramCount: 24,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
    variants: ["sovereign", "former", "subdivision"],
  },
  {
    name: "Infobox settlement",
    description: "Cities, provinces, municipalities, and geographic landmarks with skyline and spatial coordinates.",
    category: "sovereign",
    paramCount: 20,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
    variants: ["city", "province", "landmark"],
  },

  // 2. Biographies & Leadership
  {
    name: "Infobox person",
    description: "Universal biography for leaders, monarchs, commanders, scientists, aristocrats, and historical figures.",
    category: "biography",
    paramCount: 22,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
    variants: ["officeholder", "monarch", "military", "scholar", "noble", "cleric"],
  },

  // 3. Defense, Military & Fleet
  {
    name: "Infobox military conflict",
    description: "Historical wars, tactical campaigns, naval battles, sieges, and strategic outcomes.",
    category: "defense",
    paramCount: 16,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
    variants: ["war", "battle", "operation"],
  },
  {
    name: "Infobox military unit",
    description: "Armored divisions, air wings, infantry brigades, and national defense commands.",
    category: "defense",
    paramCount: 14,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox ship",
    description: "Warships, carriers, submarines, destroyers, and flagship vessels.",
    category: "defense",
    paramCount: 18,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
    variants: ["warship", "submarine", "civilian"],
  },
  {
    name: "Infobox aircraft",
    description: "Fighter jets, bombers, transports, helicopters, and aerospace assets.",
    category: "defense",
    paramCount: 16,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox weapon",
    description: "Small arms, main battle tanks, artillery, missiles, and ordnance systems.",
    category: "defense",
    paramCount: 14,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox military installation",
    description: "Fortresses, naval bases, radar stations, and military airfields.",
    category: "defense",
    paramCount: 12,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },

  // 4. Governance & Law
  {
    name: "Infobox government",
    description: "National executive cabinets, ministries, and state administrations.",
    category: "sovereign",
    paramCount: 12,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox government agency",
    description: "Ministries, intelligence bureaus, state commissions, and central banks.",
    category: "sovereign",
    paramCount: 12,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox political party",
    description: "Political parties, parliamentary coalitions, and electoral movements.",
    category: "sovereign",
    paramCount: 12,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox legislature",
    description: "Parliaments, senates, congresses, and diet assemblies.",
    category: "sovereign",
    paramCount: 12,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox treaty",
    description: "International accords, peace pacts, alliances, and conventions.",
    category: "sovereign",
    paramCount: 12,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },

  // 5. Economy & Infrastructure
  {
    name: "Infobox company",
    description: "Corporations, conglomerates, banks, and state-owned enterprises.",
    category: "economy",
    paramCount: 14,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox currency",
    description: "Sovereign legal tender, central bank currencies, and monetary units.",
    category: "economy",
    paramCount: 10,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox infrastructure",
    description: "Canals, ports, international airports, rail lines, and power stations.",
    category: "economy",
    paramCount: 14,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
    variants: ["airport", "port", "rail", "energy"],
  },

  // 6. Science, Lore & Culture
  {
    name: "Infobox language",
    description: "National tongues, indigenous conlangs, writing systems, and phonologies.",
    category: "lore",
    paramCount: 12,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox religion",
    description: "Faiths, monastic orders, sacred temples, and theological movements.",
    category: "lore",
    paramCount: 12,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox spacecraft",
    description: "Space stations, satellites, planetary probes, and launch vehicles.",
    category: "lore",
    paramCount: 14,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox invention",
    description: "Scientific breakthroughs, technological patents, and engineering milestones.",
    category: "lore",
    paramCount: 10,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox historical era",
    description: "Epochs, ages, dynasties, and historical milestones.",
    category: "lore",
    paramCount: 10,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },

  // 7. IxStates Engine Data Connectors
  {
    name: "CountryData",
    description: "Live real-time economic, vitality, and demographic simulation metrics connector.",
    category: "engine",
    paramCount: 6,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "BusinessData",
    description: "Live corporate valuation, balance sheet, and revenue indicators.",
    category: "engine",
    paramCount: 6,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Coord",
    description: "Geographic coordinate badge with IxWorld Voronoi spatial mesh projection.",
    category: "geographic",
    paramCount: 4,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },

  // 8. Editorial Layout & Citations
  {
    name: "Navbox",
    description: "Thematic series footer navigation matrix with grouped topic links.",
    category: "navigation",
    paramCount: 12,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Quote box",
    description: "Styled pull-quote capsule with author attribution, source, and alignment.",
    category: "formatting",
    paramCount: 4,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Hatnote",
    description: "Article disambiguation notice, main topic pointer, or redirect banner.",
    category: "formatting",
    paramCount: 2,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Cite web",
    description: "Standardized scholarly and treaty citation format.",
    category: "citation",
    paramCount: 8,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
];

/**
 * Polymorphic alias map resolving legacy templates to Master canonicals.
 */
export const CANONICAL_ALIASES_MAP: Record<string, { target: string; variant?: string }> = {
  // Country merges
  "infobox former country": { target: "Infobox country", variant: "former" },
  "infobox subdivision": { target: "Infobox country", variant: "subdivision" },
  "infobox caphirian province": { target: "Infobox country", variant: "subdivision" },
  "infobox kirstate": { target: "Infobox country", variant: "subdivision" },
  "infobox state of cartadania": { target: "Infobox country", variant: "subdivision" },
  "infobox province": { target: "Infobox country", variant: "subdivision" },
  
  // Settlement merges
  "infobox city": { target: "Infobox settlement", variant: "city" },
  "infobox town": { target: "Infobox settlement", variant: "city" },
  "infobox village": { target: "Infobox settlement", variant: "city" },
  "infobox mountain": { target: "Infobox settlement", variant: "landmark" },
  "infobox river": { target: "Infobox settlement", variant: "landmark" },
  "infobox islands": { target: "Infobox settlement", variant: "landmark" },

  // Person merges
  "infobox monarch": { target: "Infobox person", variant: "monarch" },
  "infobox imperator": { target: "Infobox person", variant: "monarch" },
  "infobox noble": { target: "Infobox person", variant: "noble" },
  "infobox officeholder": { target: "Infobox person", variant: "officeholder" },
  "infobox military person": { target: "Infobox person", variant: "military" },
  "infobox military personnel": { target: "Infobox person", variant: "military" },
  "infobox scientist": { target: "Infobox person", variant: "scholar" },
  "infobox academic": { target: "Infobox person", variant: "scholar" },
  "infobox saint": { target: "Infobox person", variant: "cleric" },
  "infobox religious biography": { target: "Infobox person", variant: "cleric" },

  // Ship & Fleet merges
  "infobox naval vessel": { target: "Infobox ship", variant: "warship" },
  "infobox submarine": { target: "Infobox ship", variant: "submarine" },
  "infobox ship career": { target: "Infobox ship", variant: "warship" },
  "infobox ship characteristics": { target: "Infobox ship", variant: "warship" },

  // Weapon & Aircraft merges
  "infobox aircraft type": { target: "Infobox aircraft" },
  "infobox aircraft engine": { target: "Infobox aircraft" },
  "infobox missile": { target: "Infobox weapon" },
  "infobox firearm": { target: "Infobox weapon" },
  "infobox firearm cartridge": { target: "Infobox weapon" },
  "infobox tank": { target: "Infobox weapon" },

  // Organization & Infrastructure merges
  "infobox enterprise": { target: "Infobox company" },
  "infobox corporation": { target: "Infobox company" },
  "infobox central bank": { target: "Infobox company" },
  "infobox airport": { target: "Infobox infrastructure", variant: "airport" },
  "infobox port": { target: "Infobox infrastructure", variant: "port" },
  "infobox rail line": { target: "Infobox infrastructure", variant: "rail" },
  "infobox power station": { target: "Infobox infrastructure", variant: "energy" },
  "infobox mine": { target: "Infobox infrastructure" },

  // Lore & Culture merges
  "infobox conlang": { target: "Infobox language" },
  "infobox church": { target: "Infobox religion" },
  "infobox historical event": { target: "Infobox historical era" },
  "infobox bilateral relations": { target: "Infobox historical era" },
};

export const BUILTIN_TEMPLATE_SCHEMAS: Record<
  string,
  {
    description: string;
    category: string;
    params: Record<string, { label: string; description: string; type: string; required?: boolean; default?: string; example?: string }>;
  }
> = {
  "infobox country": {
    description: "Master sovereign nation, empire, federation, or realm factbook.",
    category: "sovereign",
    params: {
      common_name: { label: "Common Name", description: "Short English name of the realm", type: "string", required: true, example: "Burgundie" },
      official_name: { label: "Official Name", description: "Full formal official state title", type: "string", example: "Grand Republic of Burgundie" },
      native_name: { label: "Native Name", description: "Name in indigenous language", type: "string" },
      capital: { label: "Capital City", description: "Primary seat of government", type: "wiki-page-name", required: true, example: "Vilena" },
      largest_city: { label: "Largest City", description: "Most populous city if different", type: "wiki-page-name" },
      government_type: { label: "Government Structure", description: "Constitutional structure", type: "string", example: "Federal Constitutional Republic" },
      leader_title1: { label: "Head of State Title", description: "Title (President, Emperor, Chancellor)", type: "string", example: "President" },
      leader_name1: { label: "Head of State Name", description: "Current leader name", type: "string", example: "Jean Dupont" },
      area_km2: { label: "Land Area (km²)", description: "Total geographic surface area", type: "number", example: "450000" },
      population_estimate: { label: "Population", description: "Total citizen population", type: "number", example: "45200000" },
      gdp_nominal: { label: "Nominal GDP", description: "Gross Domestic Product", type: "currency", example: "$1.82 Trillion" },
      currency: { label: "Currency", description: "Official national legal tender", type: "string", example: "Burgundian Franc (BGF)" },
      image_flag: { label: "Flag Image", description: "National flag vector filename", type: "wiki-file-name", example: "File:Flag_of_Burgundie.svg" },
      image_coat: { label: "Coat of Arms", description: "Emblem or national seal", type: "wiki-file-name", example: "File:Coat_of_Burgundie.svg" },
      image_map: { label: "Locator Map", description: "Cartographic territory map", type: "wiki-file-name" },
      motto: { label: "National Motto", description: "State motto", type: "string", example: "Liberté, Ordre, Concorde" },
      national_anthem: { label: "National Anthem", description: "State anthem", type: "string" },
      // Former state variant fields
      year_start: { label: "Established Year", description: "Formation date (for former states)", type: "string" },
      year_end: { label: "Dissolved Year", description: "Dissolution date (for former states)", type: "string" },
      predecessor: { label: "Predecessor State", description: "Predecessor realm", type: "wiki-page-name" },
      successor: { label: "Successor State", description: "Successor realm", type: "wiki-page-name" },
      countrydata_id: { label: "IxStates Simulation Slug", description: "Auto-binds to real-time engine metrics", type: "string" },
    },
  },
  "infobox settlement": {
    description: "Cities, municipalities, provinces, and geographic landmark factbook.",
    category: "sovereign",
    params: {
      name: { label: "Settlement Name", description: "City or region name", type: "string", required: true, example: "Vilena" },
      settlement_type: { label: "Settlement Type", description: "Capital City, Province, Port, Mountain", type: "string", example: "Capital City & Municipality" },
      subdivision_name: { label: "Country / Realm", description: "Parent sovereign state", type: "wiki-page-name", required: true, example: "Burgundie" },
      leader_title: { label: "Mayor / Governor Title", description: "Title of executive", type: "string", example: "Mayor" },
      leader_name: { label: "Leader Name", description: "Current officeholder", type: "string", example: "Clara Vane" },
      population_total: { label: "Total Population", description: "Citizen population count", type: "number", example: "3420000" },
      area_km2: { label: "Area (km²)", description: "Total geographic area", type: "number", example: "582" },
      elevation_m: { label: "Elevation (m)", description: "Height above sea level", type: "number", example: "120" },
      coordinates: { label: "Coordinates", description: "GIS latitude & longitude", type: "coordinates", example: "40.7128, -74.0060" },
      image_skyline: { label: "Skyline Image", description: "City skyline photo", type: "wiki-file-name", example: "File:Vilena_Skyline.jpg" },
    },
  },
  "infobox person": {
    description: "Universal biography for leaders, monarchs, commanders, scientists, and figures.",
    category: "biography",
    params: {
      name: { label: "Full Name", description: "Legal or historical name", type: "string", required: true, example: "Arthur Vance" },
      image: { label: "Portrait", description: "Portrait illustration or photo", type: "wiki-file-name", example: "File:Arthur_Vance.jpg" },
      birth_date: { label: "Birth Date", description: "Date of birth", type: "date", example: "14 May 1968" },
      birth_place: { label: "Birth Place", description: "City / country of birth", type: "string", example: "Vilena, Burgundie" },
      death_date: { label: "Death Date", description: "Date of death if deceased", type: "date" },
      nationality: { label: "Nationality", description: "Citizenship allegiance", type: "string", example: "Burgundian" },
      occupation: { label: "Occupation / Role", description: "Primary vocation", type: "string", example: "High Chancellor" },
      office: { label: "Public Office", description: "State office held", type: "string", example: "High Chancellor of Vesper" },
      term_start: { label: "Term Start", description: "Start year of term", type: "string", example: "2020" },
      term_end: { label: "Term End", description: "End year of term", type: "string", example: "Present" },
      political_party: { label: "Political Party", description: "Party affiliation", type: "wiki-page-name", example: "Concord Party" },
      // Monarch & Military Variant Fields
      title: { label: "Noble / Dynastic Title", description: "Royal title or rank", type: "string" },
      dynasty: { label: "House / Dynasty", description: "Ruling house", type: "string" },
      rank: { label: "Military Rank", description: "Military rank (General, Admiral)", type: "string" },
      allegiance: { label: "Military Allegiance", description: "Branch or realm allegiance", type: "string" },
    },
  },
  "infobox ship": {
    description: "Warships, aircraft carriers, submarines, and maritime flagships.",
    category: "defense",
    params: {
      name: { label: "Ship Name & Hull No.", description: "Full ship designation", type: "string", required: true, example: "BNS Vilena (BB-04)" },
      ship_class: { label: "Ship Class", description: "Vessel design class", type: "string", example: "Vilena-class Battleship" },
      operator: { label: "Operating Navy", description: "Operating service branch", type: "wiki-page-name", required: true, example: "Royal Burgundian Navy" },
      commissioned: { label: "Commissioned Date", description: "Entry into active service", type: "date", example: "1938" },
      displacement_tons: { label: "Displacement (tonnes)", description: "Full load displacement", type: "number", example: "45000" },
      length_m: { label: "Length (m)", description: "Overall vessel length", type: "number", example: "245" },
      propulsion: { label: "Propulsion", description: "Power turbines or nuclear reactor", type: "string", example: "4 Geared Steam Turbines, 150,000 shp" },
      speed_knots: { label: "Top Speed (knots)", description: "Maximum flank speed", type: "number", example: "30" },
      armament: { label: "Armament", description: "Main artillery and missile battery", type: "string", example: "9 × 406mm Guns, 20 × 127mm Guns" },
      armor: { label: "Armor Protection", description: "Belt, deck, and turret armor", type: "string", example: "Belt: 340mm, Deck: 150mm" },
      aircraft_carried: { label: "Aircraft Carried", description: "Air wing or floatplanes", type: "string" },
      ship_image: { label: "Ship Image", description: "Photo or silhouette", type: "wiki-file-name", example: "File:BNS_Vilena.jpg" },
    },
  },
  "infobox military conflict": {
    description: "Historical wars, tactical campaigns, naval battles, and sieges.",
    category: "defense",
    params: {
      conflict: { label: "Conflict Name", description: "Name of the battle or war", type: "string", required: true, example: "The Sand War" },
      date: { label: "Date / Duration", description: "Hostility date range", type: "string", required: true, example: "14 June 1984 – 3 August 1986" },
      place: { label: "Location / Theater", description: "Geographic theater of operations", type: "string", required: true, example: "Northern Oakhaven Basin" },
      result: { label: "Outcome", description: "Decisive treaty or victory outcome", type: "string", required: true, example: "Decisive Burgundian Victory" },
      combatant1: { label: "Belligerents (Side A)", description: "First alliance or state forces", type: "string", example: "Burgundie & Vesper Alliance" },
      combatant2: { label: "Belligerents (Side B)", description: "Opposing alliance or state forces", type: "string", example: "Paulastran Cyber Corps" },
      commanders1: { label: "Commanders (Side A)", description: "Commanding officers", type: "string", example: "Gen. Arthur Vance" },
      commanders2: { label: "Commanders (Side B)", description: "Opposing commanders", type: "string", example: "Marshal Kirov" },
      casualties1: { label: "Casualties (Side A)", description: "Losses Side A", type: "string" },
      casualties2: { label: "Casualties (Side B)", description: "Losses Side B", type: "string" },
    },
  },
  "infobox company": {
    description: "Commercial corporations, conglomerates, central banks, and state enterprises.",
    category: "economy",
    params: {
      name: { label: "Company Name", description: "Official corporate name", type: "string", required: true, example: "Solcordia Energy Corp" },
      industry: { label: "Primary Industry", description: "Commercial sector", type: "string", required: true, example: "Energy & Infrastructure" },
      headquarters: { label: "Headquarters", description: "Corporate HQ location", type: "string", required: true, example: "Vilena, Burgundie" },
      key_people: { label: "Key Executives", description: "CEO, Chairman, Founders", type: "string", example: "Marcus Sterling (CEO)" },
      revenue: { label: "Annual Revenue", description: "Total annual turnover", type: "currency", example: "$42.5 Billion" },
      employees: { label: "Total Employees", description: "Workforce headcount", type: "number", example: "84000" },
      logo: { label: "Logo Image", description: "Corporate logo vector", type: "wiki-file-name", example: "File:Solcordia_Logo.svg" },
      businessdata_id: { label: "IxStates Corporate Slug", description: "Auto-binds to real-time company ledger", type: "string" },
    },
  },
  countrydata: {
    description: "Live real-time economic and geopolitical data connector powered by the IxStates Engine.",
    category: "engine",
    params: {
      id: { label: "Country Identifier", description: "Country slug or ISO identifier in IxStates", type: "string", required: true, example: "burgundie" },
      metric: { label: "Metric Name", description: "gdp, population, debt, hdi, vitality, or stability", type: "string", required: true, example: "gdp" },
      format: { label: "Display Format", description: "currency, compact, percentage, or number", type: "string", example: "currency" },
      fallback: { label: "Fallback Value", description: "Fallback text if live sync is offline", type: "string", example: "$1.82T" },
    },
  },
  businessdata: {
    description: "Corporate, trade balance, and commercial enterprise financial indicators.",
    category: "engine",
    params: {
      company: { label: "Company Identifier", description: "Corporate entity slug", type: "string", required: true, example: "solcordia" },
      metric: { label: "Metric", description: "revenue, valuation, employees, or headquarters", type: "string", required: true, example: "revenue" },
      fallback: { label: "Fallback Value", description: "Fallback text if offline", type: "string" },
    },
  },
  navbox: {
    description: "Thematic series footer navigation matrix with grouped topic links.",
    category: "navigation",
    params: {
      title: { label: "Navbox Header Title", description: "Main title banner", type: "string", required: true, example: "Provinces & Territories of Burgundie" },
      group1: { label: "Group 1 Name", description: "First subcategory label", type: "string", example: "Core Provinces" },
      list1: { label: "Articles in Group 1", description: "Wikitext links", type: "string", example: "[[Vilena]] • [[Oakhaven]] • [[Sudmoll]]" },
      group2: { label: "Group 2 Name", description: "Second subcategory label", type: "string", example: "Autonomous Territories" },
      list2: { label: "Articles in Group 2", description: "Wikitext links", type: "string", example: "[[Vonein Basin]] • [[Seneca Islands]]" },
    },
  },
  "quote box": {
    description: "Highlighted speech excerpt, lore document citation, or quotation capsule.",
    category: "formatting",
    params: {
      quote: { label: "Quote Text", description: "Direct text quote", type: "string", required: true, example: "Freedom is won in the assembly and held on the border." },
      author: { label: "Speaker / Author", description: "Attributed figure", type: "string", required: true, example: "Chancellor Elspeth Kane" },
      source: { label: "Source / Speech", description: "Historical address or treaty", type: "string", example: "Address to the Continental Senate, 2021" },
    },
  },
  hatnote: {
    description: "Article disambiguation notice, main article reference, or redirect banner.",
    category: "formatting",
    params: {
      text: { label: "Notice Text", description: "Disambiguation explanation", type: "string", required: true, example: "This article is about the sovereign state. For the capital city, see [[Vilena]]." },
      type: { label: "Hatnote Type", description: "disambiguation | redirect | main | see_also", type: "string" },
    },
  },
  "cite web": {
    description: "Structured citation format for web sources, publications, and treaties.",
    category: "citation",
    params: {
      url: { label: "Source URL", description: "Direct web hyperlink", type: "string", required: true, example: "https://archives.ixwiki.com/doc/142" },
      title: { label: "Article Title", description: "Title of cited publication", type: "string", required: true, example: "Constitutional History of Burgundie" },
      author: { label: "Author", description: "Author or publishing agency", type: "string", example: "Dr. Henri Dubois" },
      publisher: { label: "Publisher", description: "Organization or publishing house", type: "string", example: "Vilena University Press" },
      date: { label: "Publication Date", description: "Release date", type: "date", example: "2018" },
      accessdate: { label: "Access Date", description: "Date source was accessed", type: "date", example: "2026-08-25" },
    },
  },
};

export const wikiosTemplatesRouter = createTRPCRouter({
  /**
   * Search templates with noise-rejection filtering and canonical tier promotion.
   */
  searchTemplates: publicProcedure
    .input(
      z.object({
        query: z.string().max(200).default(""),
        category: z.string().optional(),
        canonicalOnly: z.boolean().default(false),
        limit: z.number().min(1).max(100).default(35),
      })
    )
    .query(async ({ input }) => {
      const templateMap = new Map<string, {
        name: string;
        description: string | null;
        category: string;
        paramCount: number;
        isCanonical: boolean;
        canonicalTarget: string | null;
        hasTemplateData: boolean;
        variants?: string[];
      }>();

      const queryLower = input.query.trim().toLowerCase();

      // 1. Primary: Seed and prioritize Canonical Master Templates
      for (const canonical of CANONICAL_BUILTIN_TEMPLATES) {
        const key = canonical.name.toLowerCase();
        const matchesQuery = !queryLower || key.includes(queryLower) || canonical.description.toLowerCase().includes(queryLower);
        const matchesCat = !input.category || input.category === "all" || input.category === canonical.category;

        if (matchesQuery && matchesCat) {
          templateMap.set(key, canonical);
        }
      }

      // 2. Check local WikiTemplate database registry (custom user-registered templates)
      const where: {
        isCanonical?: boolean;
        category?: string;
        OR?: Array<{ name: { contains: string; mode: "insensitive" } }>;
      } = {};

      if (input.canonicalOnly) where.isCanonical = true;
      if (input.category && input.category !== "all") where.category = input.category;
      if (input.query) where.OR = [{ name: { contains: input.query, mode: "insensitive" } }];

      const localTemplates = await db.wikiTemplate.findMany({
        where,
        take: input.limit,
        orderBy: [{ isCanonical: "desc" }, { paramCount: "desc" }],
      });

      for (const t of localTemplates) {
        if (isNoiseTemplate(t.name)) continue;
        const key = t.name.toLowerCase();
        if (!templateMap.has(key)) {
          templateMap.set(key, {
            name: t.name,
            description: t.description,
            category: t.category ?? "general",
            paramCount: t.paramCount,
            isCanonical: t.isCanonical,
            canonicalTarget: t.canonicalTarget,
            hasTemplateData: !!t.templateData,
          });
        }
      }

      // 3. Check PostgreSQL WikiArticle table for namespace 10 with strict noise filtering
      if (!input.canonicalOnly && templateMap.size < input.limit) {
        const articleTemplates = await db.wikiArticle.findMany({
          where: {
            namespace: 10,
            ...(input.query ? { title: { contains: input.query, mode: "insensitive" } } : {}),
          },
          take: input.limit * 2, // oversample to account for noise filter
          select: { title: true, summary: true },
        });

        for (const art of articleTemplates) {
          const cleanName = art.title.replace(/^Template:/i, "").trim();
          if (isNoiseTemplate(cleanName)) continue;

          // Check if it's an alias to a canonical master
          const alias = CANONICAL_ALIASES_MAP[cleanName.toLowerCase()];
          const key = cleanName.toLowerCase();

          if (!templateMap.has(key)) {
            const cat = categorizeTemplate(cleanName, art.summary ?? undefined);
            if (!input.category || input.category === "all" || input.category === cat) {
              templateMap.set(key, {
                name: cleanName,
                description: art.summary || (alias ? `Variant of ${alias.target}` : "Registered Template"),
                category: cat,
                paramCount: 0,
                isCanonical: false,
                canonicalTarget: alias ? alias.target : null,
                hasTemplateData: false,
              });
            }
          }
        }
      }

      const templates = Array.from(templateMap.values()).slice(0, input.limit);
      return { templates };
    }),

  /**
   * Get TemplateData schema for a specific template with alias resolution.
   */
  getTemplateData: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      let templateName = input.title.replace(/^Template:/i, "").trim();
      const cleanKey = templateName.toLowerCase();

      // Check alias mapping first
      if (CANONICAL_ALIASES_MAP[cleanKey]) {
        const aliasTarget = CANONICAL_ALIASES_MAP[cleanKey]!.target;
        const schema = BUILTIN_TEMPLATE_SCHEMAS[aliasTarget.toLowerCase()];
        if (schema) {
          return {
            name: templateName,
            canonicalName: aliasTarget,
            description: schema.description,
            category: schema.category,
            isCanonical: true,
            templateData: {
              description: schema.description,
              params: schema.params,
            } as unknown as Record<string, unknown>,
            cached: true,
          };
        }
      }

      // Check builtin master schemas
      const builtin = BUILTIN_TEMPLATE_SCHEMAS[cleanKey];
      if (builtin) {
        return {
          name: templateName,
          description: builtin.description,
          category: builtin.category,
          isCanonical: true,
          templateData: {
            description: builtin.description,
            params: builtin.params,
          } as unknown as Record<string, unknown>,
          cached: true,
        };
      }

      // 1. Check local DB cache
      let cached = await db.wikiTemplate.findUnique({
        where: { name: templateName },
      });

      if (cached?.canonicalTarget) {
        const target = await db.wikiTemplate.findUnique({
          where: { name: cached.canonicalTarget },
        });
        if (target) cached = target;
      }

      if (cached?.templateData) {
        return {
          name: cached.name,
          description: cached.description,
          category: cached.category,
          isCanonical: cached.isCanonical,
          templateData: cached.templateData as Record<string, unknown>,
          cached: true,
        };
      }

      // 2. Fetch from MediaWiki API
      const tdMap = await fetchTemplateData([templateName]);
      const data = tdMap.get(templateName);
      if (!data) {
        return {
          name: templateName,
          description: null,
          category: categorizeTemplate(templateName),
          templateData: null,
          cached: false,
        };
      }

      // 3. Cache in DB for future requests
      const category = categorizeTemplate(templateName, data.description);
      const paramCount = data.params ? Object.keys(data.params).length : 0;

      await db.wikiTemplate.upsert({
        where: { name: templateName },
        create: {
          name: templateName,
          description: data.description ?? null,
          category,
          templateData: (data ?? null) as unknown as Prisma.InputJsonValue,
          paramCount,
        },
        update: {
          description: data.description ?? null,
          category,
          templateData: (data ?? null) as unknown as Prisma.InputJsonValue,
          paramCount,
        },
      });

      return {
        name: templateName,
        description: data.description ?? null,
        category,
        templateData: data as unknown as Record<string, unknown>,
        cached: false,
      };
    }),

  /**
   * Get rendered preview of a template with given parameters.
   */
  getTemplatePreview: publicProcedure
    .input(
      z.object({
        template: z.string().min(1).max(500),
        params: z.record(z.string(), z.string()),
      })
    )
    .query(async ({ input }) => {
      return renderTemplatePreview(input.template, input.params);
    }),

  /**
   * Sync/backfill all Template: pages into the WikiTemplate registry.
   */
  syncTemplates: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .mutation(async ({ input }) => {
      const templates = await searchTemplatesDB("", input.limit * 2);
      const cleanNames = templates.map((t) => t.replace(/^Template:/i, "")).filter((t) => !isNoiseTemplate(t)).slice(0, input.limit);
      const tdMap = await fetchTemplateData(cleanNames);
      let synced = 0;

      for (const name of cleanNames) {
        const data = tdMap.get(name);
        const category = categorizeTemplate(name, data?.description);
        const paramCount = data?.params ? Object.keys(data.params).length : 0;

        await db.wikiTemplate.upsert({
          where: { name },
          create: {
            name,
            description: data?.description ?? null,
            category,
            templateData: (data ?? null) as unknown as Prisma.InputJsonValue,
            paramCount,
          },
          update: {
            description: data?.description ?? null,
            category,
            templateData: (data ?? null) as unknown as Prisma.InputJsonValue,
            paramCount,
          },
        });
        synced++;
      }

      return { synced, total: cleanNames.length };
    }),

  /**
   * Save, create, or update a custom user-defined template / infobox.
   */
  saveCustomTemplate: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        category: z.string().default("sovereign"),
        params: z.array(
          z.object({
            name: z.string().min(1),
            label: z.string().min(1),
            description: z.string().optional(),
            type: z.string().default("string"),
            required: z.boolean().default(false),
            example: z.string().optional(),
            default: z.string().optional(),
          })
        ),
        wikitextTemplate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const cleanName = input.name.replace(/^Template:/i, "").trim();
      const paramMap: Record<string, any> = {};
      for (const p of input.params) {
        paramMap[p.name] = {
          label: p.label,
          description: p.description,
          type: p.type,
          required: p.required,
          example: p.example,
          default: p.default,
        };
      }

      const templateData = {
        title: cleanName,
        description: input.description ?? "",
        params: paramMap,
        format: "block",
      };

      // 1. Upsert in WikiTemplate registry
      const template = await db.wikiTemplate.upsert({
        where: { name: cleanName },
        create: {
          name: cleanName,
          description: input.description ?? null,
          category: input.category,
          templateData: templateData as unknown as Prisma.InputJsonValue,
          paramCount: input.params.length,
          isCanonical: false,
        },
        update: {
          description: input.description ?? null,
          category: input.category,
          templateData: templateData as unknown as Prisma.InputJsonValue,
          paramCount: input.params.length,
          lastSynced: new Date(),
        },
      });

      // 2. Register in wiki_articles (namespace 10)
      const rawWikitext =
        input.wikitextTemplate ||
        `<includeonly><div class="wikios-infobox wikios-custom-infobox">\n` +
          `  <div class="wikios-infobox-header">{{{name|${cleanName}}}}}</div>\n` +
          input.params
            .map(
              (p) =>
                `  {{#if:{{{${p.name}|}}}|<div class="wikios-infobox-row"><span class="wikios-infobox-label">${p.label}:</span> <span class="wikios-infobox-value">{{{${p.name}}}}}</span></div>}}`
            )
            .join("\n") +
          `\n</div></includeonly><noinclude>\n== Template Documentation ==\n${input.description || "Custom user-created template"}\n</noinclude>`;

      await db.wikiArticle.upsert({
        where: {
          source_title: {
            source: "ixwiki",
            title: `Template:${cleanName}`,
          },
        },
        create: {
          slug: `template-${cleanName.toLowerCase().replace(/[\s_]+/g, "-")}`,
          title: `Template:${cleanName}`,
          source: "ixwiki",
          namespace: 10,
          namespacePrefix: "Template",
          status: "PUBLISHED",
          wikitext: rawWikitext,
          summary: input.description || `Custom template for ${cleanName}`,
        },
        update: {
          wikitext: rawWikitext,
          summary: input.description || `Custom template for ${cleanName}`,
        },
      });

      return { success: true, template };
    }),

  /**
   * Delete a custom user-defined template.
   */
  deleteCustomTemplate: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const cleanName = input.name.replace(/^Template:/i, "").trim();
      const existing = await db.wikiTemplate.findUnique({ where: { name: cleanName } });
      if (!existing) throw new Error("Template not found");
      if (existing.isCanonical) throw new Error("Canonical templates cannot be deleted");

      await db.wikiTemplate.delete({ where: { name: cleanName } });
      return { success: true };
    }),
});

