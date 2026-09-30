/**
 * master-presets.ts — Canonical master template presets for the WikiOS editor.
 * These are the curated, IxWiki-specific template schemas with variant support.
 */

// Palette presets and builder flows guarantee `name`; refine the canonical type instead of redefining it.
import type { TemplateParam } from "~/lib/wiki-os/templates/template-registry";

// Palette presets and builder flows guarantee `name`; refine the canonical type instead of redefining it.
export type PaletteTemplateParam = TemplateParam & { name: string };

export interface MasterTemplatePreset {
  name: string;
  category:
    | "sovereign"
    | "biography"
    | "defense"
    | "economy"
    | "lore"
    | "engine"
    | "formatting"
    | "navigation"
    | "citation"
    | "geographic";
  description: string;
  isCanonical: boolean;
  variants?: Array<{ id: string; label: string; defaultFields: string[] }>;
  params: PaletteTemplateParam[];
}

export const MASTER_TEMPLATE_PRESETS: MasterTemplatePreset[] = [
  // 1. Sovereign & Geopolitical
  {
    name: "Infobox country",
    category: "sovereign",
    description: "Master nation-state, realm, former empire, or territory factbook.",
    isCanonical: true,
    variants: [
      {
        id: "sovereign",
        label: "🏛️ Sovereign State",
        defaultFields: [
          "common_name",
          "official_name",
          "capital",
          "government_type",
          "leader_title1",
          "leader_name1",
          "population_estimate",
          "gdp_nominal",
          "currency",
          "image_flag",
          "image_coat",
          "motto",
        ],
      },
      {
        id: "former",
        label: "📜 Former Empire / State",
        defaultFields: [
          "common_name",
          "official_name",
          "capital",
          "year_start",
          "year_end",
          "predecessor",
          "successor",
          "government_type",
          "image_flag",
          "image_map",
        ],
      },
      {
        id: "subdivision",
        label: "🗺️ Province / Territory",
        defaultFields: [
          "common_name",
          "official_name",
          "capital",
          "parent_country",
          "governor",
          "area_km2",
          "population_estimate",
          "image_map",
        ],
      },
    ],
    params: [
      { name: "common_name", label: "Common Name", required: true, example: "Burgundie" },
      { name: "official_name", label: "Official Name", example: "Grand Republic of Burgundie" },
      { name: "native_name", label: "Native Name", example: "Grande République de Burgundie" },
      {
        name: "capital",
        label: "Capital City",
        required: true,
        example: "Vilena",
        type: "wiki-page-name",
      },
      { name: "largest_city", label: "Largest City", example: "Vilena", type: "wiki-page-name" },
      {
        name: "government_type",
        label: "Government Structure",
        example: "Federal Constitutional Republic",
      },
      { name: "leader_title1", label: "Head of State Title", example: "President" },
      { name: "leader_name1", label: "Head of State Name", example: "Jean Dupont" },
      { name: "area_km2", label: "Land Area (km²)", example: "450000", type: "number" },
      { name: "population_estimate", label: "Population", example: "45200000", type: "number" },
      { name: "gdp_nominal", label: "Nominal GDP", example: "$1.82 Trillion", type: "currency" },
      { name: "currency", label: "Currency", example: "Burgundian Franc (BGF)" },
      {
        name: "image_flag",
        label: "Flag Vector",
        example: "File:Flag_of_Burgundie.svg",
        type: "wiki-file-name",
      },
      {
        name: "image_coat",
        label: "Coat of Arms",
        example: "File:Coat_of_Burgundie.svg",
        type: "wiki-file-name",
      },
      {
        name: "image_map",
        label: "Territory Map",
        example: "File:Burgundie_Locator_Map.png",
        type: "wiki-file-name",
      },
      { name: "motto", label: "National Motto", example: "Liberté, Ordre, Concorde" },
      // Former state fields
      { name: "year_start", label: "Established Year", example: "1789", variantOnly: ["former"] },
      { name: "year_end", label: "Dissolution Year", example: "1945", variantOnly: ["former"] },
      {
        name: "predecessor",
        label: "Predecessor Realm",
        example: "Kingdom of Vilena",
        type: "wiki-page-name",
        variantOnly: ["former"],
      },
      {
        name: "successor",
        label: "Successor Realm",
        example: "Federal Republic of Burgundie",
        type: "wiki-page-name",
        variantOnly: ["former"],
      },
      // Province fields
      {
        name: "parent_country",
        label: "Parent Sovereign State",
        example: "Burgundie",
        type: "wiki-page-name",
        variantOnly: ["subdivision"],
      },
      {
        name: "governor",
        label: "Governor / Chancellor",
        example: "Claire Delacroix",
        variantOnly: ["subdivision"],
      },
      // Engine connector
      { name: "countrydata_id", label: "IxStates Simulation Slug", example: "burgundie" },
    ],
  },
  {
    name: "Infobox settlement",
    category: "sovereign",
    description: "Cities, municipalities, provinces, and geographic landmark factbook.",
    isCanonical: true,
    variants: [
      {
        id: "city",
        label: "🏙️ City / Municipality",
        defaultFields: [
          "name",
          "settlement_type",
          "subdivision_name",
          "leader_title",
          "leader_name",
          "population_total",
          "area_km2",
          "image_skyline",
          "coordinates",
        ],
      },
      {
        id: "landmark",
        label: "🏔️ Landmark / Mountain / River",
        defaultFields: [
          "name",
          "settlement_type",
          "subdivision_name",
          "elevation_m",
          "coordinates",
          "image_skyline",
        ],
      },
    ],
    params: [
      { name: "name", label: "Settlement Name", required: true, example: "Vilena" },
      { name: "settlement_type", label: "Settlement Type", example: "Capital City & Municipality" },
      {
        name: "subdivision_name",
        label: "Country / Realm",
        required: true,
        example: "Burgundie",
        type: "wiki-page-name",
      },
      { name: "leader_title", label: "Mayor / Governor Title", example: "Mayor" },
      { name: "leader_name", label: "Leader Name", example: "Clara Vane" },
      { name: "population_total", label: "Total Population", example: "3420000", type: "number" },
      { name: "area_km2", label: "Area (km²)", example: "582", type: "number" },
      { name: "elevation_m", label: "Elevation (m)", example: "120", type: "number" },
      {
        name: "coordinates",
        label: "Coordinates (Lat, Lng)",
        example: "40.7128, -74.0060",
        type: "coordinates",
      },
      {
        name: "image_skyline",
        label: "Skyline Photo",
        example: "File:Vilena_Skyline.jpg",
        type: "wiki-file-name",
      },
    ],
  },

  // 2. Biographies & Figures
  {
    name: "Infobox person",
    category: "biography",
    description: "Universal biography for leaders, monarchs, commanders, scientists, and figures.",
    isCanonical: true,
    variants: [
      {
        id: "officeholder",
        label: "🏛️ Political Leader",
        defaultFields: [
          "name",
          "office",
          "term_start",
          "term_end",
          "political_party",
          "nationality",
          "birth_date",
          "birth_place",
          "image",
        ],
      },
      {
        id: "monarch",
        label: "👑 Monarch / Sovereign",
        defaultFields: [
          "name",
          "title",
          "reign_start",
          "reign_end",
          "dynasty",
          "consort",
          "predecessor",
          "successor",
          "image",
        ],
      },
      {
        id: "military",
        label: "⚔️ Military Commander",
        defaultFields: [
          "name",
          "rank",
          "allegiance",
          "commands",
          "battles",
          "awards",
          "birth_date",
          "image",
        ],
      },
      {
        id: "scholar",
        label: "🔬 Scholar / Scientist",
        defaultFields: [
          "name",
          "occupation",
          "institution",
          "known_for",
          "prizes",
          "nationality",
          "image",
        ],
      },
    ],
    params: [
      { name: "name", label: "Full Name", required: true, example: "Arthur Vance" },
      {
        name: "image",
        label: "Portrait",
        example: "File:Arthur_Vance.jpg",
        type: "wiki-file-name",
      },
      { name: "birth_date", label: "Birth Date", example: "14 May 1968", type: "date" },
      { name: "birth_place", label: "Birth Place", example: "Vilena, Burgundie" },
      { name: "death_date", label: "Death Date", example: "", type: "date" },
      { name: "nationality", label: "Nationality", example: "Burgundian" },
      { name: "occupation", label: "Occupation / Role", example: "High Chancellor" },
      { name: "office", label: "Public Office", example: "High Chancellor of Vesper" },
      { name: "term_start", label: "Term Start", example: "2020" },
      { name: "term_end", label: "Term End", example: "Present" },
      {
        name: "political_party",
        label: "Political Party",
        example: "Concord Party",
        type: "wiki-page-name",
      },
      // Monarch fields
      {
        name: "title",
        label: "Dynastic Title",
        example: "Emperor of Coscivia",
        variantOnly: ["monarch"],
      },
      {
        name: "dynasty",
        label: "Ruling Dynasty / House",
        example: "House of Vance",
        variantOnly: ["monarch"],
      },
      { name: "reign_start", label: "Reign Start", example: "1994", variantOnly: ["monarch"] },
      { name: "reign_end", label: "Reign End", example: "2018", variantOnly: ["monarch"] },
      // Military fields
      {
        name: "rank",
        label: "Military Rank",
        example: "General of the Army",
        variantOnly: ["military"],
      },
      {
        name: "allegiance",
        label: "Service Allegiance",
        example: "Armed Forces of Burgundie",
        variantOnly: ["military"],
      },
      {
        name: "commands",
        label: "Commands Held",
        example: "1st Armored Corps",
        variantOnly: ["military"],
      },
      {
        name: "battles",
        label: "Major Battles",
        example: "The Sand War",
        variantOnly: ["military"],
      },
    ],
  },

  // 3. Defense, Fleet & Warfare
  {
    name: "Infobox ship",
    category: "defense",
    description: "Warships, carriers, submarines, destroyers, and flagship vessels.",
    isCanonical: true,
    variants: [
      {
        id: "warship",
        label: "🚢 Surface Warship",
        defaultFields: [
          "name",
          "ship_class",
          "operator",
          "commissioned",
          "displacement_tons",
          "propulsion",
          "speed_knots",
          "armament",
          "armor",
          "ship_image",
        ],
      },
      {
        id: "submarine",
        label: "⚓ Submarine",
        defaultFields: [
          "name",
          "ship_class",
          "operator",
          "commissioned",
          "displacement_tons",
          "test_depth_m",
          "propulsion",
          "armament",
          "ship_image",
        ],
      },
    ],
    params: [
      {
        name: "name",
        label: "Ship Name & Hull No.",
        required: true,
        example: "BNS Vilena (BB-04)",
      },
      { name: "ship_class", label: "Ship Class", example: "Vilena-class Battleship" },
      {
        name: "operator",
        label: "Operating Navy",
        required: true,
        example: "Royal Burgundian Navy",
        type: "wiki-page-name",
      },
      { name: "commissioned", label: "Commissioned Date", example: "1938", type: "date" },
      {
        name: "displacement_tons",
        label: "Displacement (tonnes)",
        example: "45000",
        type: "number",
      },
      { name: "length_m", label: "Length (m)", example: "245", type: "number" },
      { name: "propulsion", label: "Propulsion", example: "4 Geared Steam Turbines, 150,000 shp" },
      { name: "speed_knots", label: "Top Speed (knots)", example: "30", type: "number" },
      { name: "armament", label: "Primary Armament", example: "9 × 406mm Guns, 20 × 127mm Guns" },
      { name: "armor", label: "Armor Protection", example: "Belt: 340mm, Deck: 150mm" },
      { name: "aircraft_carried", label: "Aircraft Carried", example: "3 Floatplanes" },
      {
        name: "test_depth_m",
        label: "Test Depth (m)",
        example: "450",
        type: "number",
        variantOnly: ["submarine"],
      },
      {
        name: "ship_image",
        label: "Ship Image",
        example: "File:BNS_Vilena.jpg",
        type: "wiki-file-name",
      },
    ],
  },
  {
    name: "Infobox military conflict",
    category: "defense",
    description: "Historical wars, tactical campaigns, naval battles, and strategic outcomes.",
    isCanonical: true,
    params: [
      { name: "conflict", label: "Conflict Name", required: true, example: "The Sand War" },
      {
        name: "date",
        label: "Date / Duration",
        required: true,
        example: "14 June 1984 – 3 August 1986",
      },
      {
        name: "place",
        label: "Location / Theater",
        required: true,
        example: "Northern Oakhaven Basin",
      },
      {
        name: "result",
        label: "Outcome / Treaty",
        required: true,
        example: "Decisive Burgundian Victory",
      },
      {
        name: "combatant1",
        label: "Belligerents (Side A)",
        example: "Burgundie & Vesper Alliance",
      },
      { name: "combatant2", label: "Belligerents (Side B)", example: "Paulastran Cyber Corps" },
      { name: "commanders1", label: "Commanders (Side A)", example: "Gen. Arthur Vance" },
      { name: "commanders2", label: "Commanders (Side B)", example: "Marshal Kirov" },
      { name: "casualties1", label: "Casualties (Side A)", example: "4,200 casualties" },
      { name: "casualties2", label: "Casualties (Side B)", example: "18,400 casualties" },
    ],
  },
  {
    name: "Infobox weapon",
    category: "defense",
    description: "Small arms, main battle tanks, aircraft, artillery, and missile systems.",
    isCanonical: true,
    params: [
      {
        name: "name",
        label: "Weapon / System Name",
        required: true,
        example: "MAG-17 Battle Rifle",
      },
      { name: "type", label: "Weapon Type", example: "Select-Fire Battle Rifle" },
      { name: "origin", label: "Origin Country", required: true, example: "Burgundie" },
      { name: "caliber", label: "Caliber / Cartridge", example: "7.62 × 51mm" },
      { name: "effective_range", label: "Effective Range", example: "600 m" },
      { name: "designer", label: "Designer / Manufacturer", example: "Vilena Armory" },
    ],
  },

  // 4. Economy & Infrastructure
  {
    name: "Infobox company",
    category: "economy",
    description: "Commercial corporations, conglomerates, central banks, and state enterprises.",
    isCanonical: true,
    params: [
      { name: "name", label: "Company Name", required: true, example: "Solcordia Energy Corp" },
      {
        name: "industry",
        label: "Industry Sector",
        required: true,
        example: "Energy & Infrastructure",
      },
      { name: "headquarters", label: "Headquarters", required: true, example: "Vilena, Burgundie" },
      { name: "key_people", label: "Key Executives", example: "Marcus Sterling (CEO)" },
      { name: "revenue", label: "Annual Revenue", example: "$42.5 Billion", type: "currency" },
      { name: "employees", label: "Total Employees", example: "84000", type: "number" },
      {
        name: "logo",
        label: "Logo Image",
        example: "File:Solcordia_Logo.svg",
        type: "wiki-file-name",
      },
      { name: "businessdata_id", label: "IxStates Corporate Slug", example: "solcordia" },
    ],
  },

  // 5. Engine Connectors
  {
    name: "CountryData",
    category: "engine",
    description: "Live real-time economic, vitality, and demographic simulation metrics connector.",
    isCanonical: true,
    params: [
      { name: "id", label: "Country Slug", required: true, example: "burgundie" },
      { name: "metric", label: "Metric Name", required: true, example: "gdp" },
      { name: "format", label: "Format (currency, compact, number)", example: "currency" },
      { name: "fallback", label: "Fallback Text", example: "$1.82T" },
    ],
  },
  {
    name: "BusinessData",
    category: "engine",
    description: "Live corporate valuation, balance sheet, and revenue indicators.",
    isCanonical: true,
    params: [
      { name: "company", label: "Company Slug", required: true, example: "solcordia" },
      { name: "metric", label: "Metric Name", required: true, example: "revenue" },
      { name: "fallback", label: "Fallback Text", example: "$42.5B" },
    ],
  },
  {
    name: "Coord",
    category: "geographic",
    description: "Geographic coordinate badge with IxWorld Voronoi spatial mesh projection.",
    isCanonical: true,
    params: [
      { name: "1", label: "Latitude", required: true, example: "40.7128" },
      { name: "2", label: "Longitude", required: true, example: "-74.0060" },
      { name: "display", label: "Display Mode", example: "inline,title" },
    ],
  },

  // 6. Editorial Layout & Citations
  {
    name: "Navbox",
    category: "navigation",
    description: "Thematic series footer navigation matrix with grouped topic links.",
    isCanonical: true,
    params: [
      {
        name: "title",
        label: "Navbox Header Title",
        required: true,
        example: "Provinces & Territories of Burgundie",
      },
      { name: "group1", label: "Group 1 Name", example: "Core Provinces" },
      {
        name: "list1",
        label: "Articles in Group 1",
        example: "[[Vilena]] • [[Oakhaven]] • [[Sudmoll]]",
      },
      { name: "group2", label: "Group 2 Name", example: "Autonomous Territories" },
      {
        name: "list2",
        label: "Articles in Group 2",
        example: "[[Vonein Basin]] • [[Seneca Islands]]",
      },
    ],
  },
  {
    name: "Quote box",
    category: "formatting",
    description: "Highlighted speech excerpt, lore document citation, or quotation capsule.",
    isCanonical: true,
    params: [
      {
        name: "quote",
        label: "Quote Text",
        required: true,
        example: "Freedom is won in the assembly and held on the border.",
      },
      {
        name: "author",
        label: "Speaker / Author",
        required: true,
        example: "Chancellor Elspeth Kane",
      },
      {
        name: "source",
        label: "Source / Speech",
        example: "Address to the Continental Senate, 2021",
      },
    ],
  },
  {
    name: "Hatnote",
    category: "formatting",
    description: "Article disambiguation notice, main article reference, or redirect banner.",
    isCanonical: true,
    params: [
      {
        name: "text",
        label: "Notice Text",
        required: true,
        example: "This article is about the sovereign state. For the capital city, see [[Vilena]].",
      },
      { name: "type", label: "Hatnote Type", example: "disambiguation" },
    ],
  },
  {
    name: "Cite web",
    category: "citation",
    description: "Standardized scholarly, historical, and treaty citation format.",
    isCanonical: true,
    params: [
      {
        name: "url",
        label: "Source URL",
        required: true,
        example: "https://archives.ixwiki.com/doc/142",
      },
      {
        name: "title",
        label: "Article Title",
        required: true,
        example: "Constitutional History of Burgundie",
      },
      { name: "author", label: "Author", example: "Dr. Henri Dubois" },
      { name: "publisher", label: "Publisher", example: "Vilena University Press" },
      { name: "date", label: "Release Date", example: "2018", type: "date" },
    ],
  },
];
