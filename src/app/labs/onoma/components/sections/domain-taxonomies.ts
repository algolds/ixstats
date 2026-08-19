// src/app/labs/onoma/components/sections/domain-taxonomies.ts
// Unified domain taxonomy configurations for Onoma naming sections

import type { NameCategory } from "~/lib/onoma/types";

export interface DomainTaxonomyTab {
  id: NameCategory;
  label: string;
  desc: string;
  subTypes?: Array<{ value: string; label: string }>;
}

export interface DomainConfig {
  domain: string;
  defaultTab: NameCategory;
  tabs: DomainTaxonomyTab[];
}

export const DOMAIN_CONFIGS: Record<string, DomainConfig> = {
  places: {
    domain: "places",
    defaultTab: "city",
    tabs: [
      {
        id: "city",
        label: "Cities & Towns",
        desc: "Assemble names for capitals, settlements, colonies, and administrative cities.",
        subTypes: [
          { value: "generic", label: "City Name (Default)" },
          { value: "settlement-colony", label: "Settlement / Colony" },
        ],
      },
      {
        id: "province",
        label: "Provinces & States",
        desc: "Assemble names for regional subdivisions, provinces, cantons, and states.",
      },
      {
        id: "country",
        label: "Nations & Realms",
        desc: "Assemble names for sovereign nations, kingdoms, empires, and republics.",
      },
      {
        id: "geography",
        label: "Landmarks & Features",
        desc: "Assemble names for mountains, valleys, rivers, bays, and natural landmarks.",
        subTypes: [
          { value: "generic", label: "Landmark Name (Default)" },
          { value: "natural-landmark", label: "Natural Landmark" },
          { value: "architecture", label: "Architecture & Buildings" },
        ],
      },
    ],
  },
  people: {
    domain: "people",
    defaultTab: "person",
    tabs: [
      {
        id: "person",
        label: "Characters & Rulers",
        desc: "Assemble names for leaders, commanders, politicians, or specific role-play species.",
        subTypes: [
          { value: "generic", label: "Human Name (Default)" },
          { value: "goblin", label: "Goblin Name Preset" },
          { value: "orc", label: "Orc Name Preset" },
          { value: "ogre", label: "Ogre Name Preset" },
          { value: "primitive", label: "Primitive / Tribe Name Preset" },
          { value: "dwarf", label: "Dwarf Name Preset" },
          { value: "halfling", label: "Halfling Name Preset" },
          { value: "gnome", label: "Gnome Name Preset" },
          { value: "elf", label: "High Elf Name Preset" },
          { value: "elf-alt", label: "Elf Alternate Suffixes Preset" },
          { value: "faery", label: "Fey / Faery Name Preset" },
          { value: "faery-alt", label: "Faery Alternate Preset" },
          { value: "dark-elf", label: "Dark Elf Name Preset" },
          { value: "dark-elf-alt", label: "Dark Elf Alternate Preset" },
          { value: "half-demon", label: "Half-Demon Name Preset" },
          { value: "dragon", label: "Dragon Name Preset" },
          { value: "demon", label: "Demon Name Preset" },
          { value: "angel", label: "Angel Name Preset" },
        ],
      },
      {
        id: "dynasty",
        label: "Houses & Dynasties",
        desc: "Assemble family, clan, dynasty, or royal house surnames.",
        subTypes: [
          { value: "generic", label: "Dynasty Name (Default)" },
          { value: "fantasy-syllable", label: "Syllable-Concatenated Surname" },
          { value: "noble-surname", label: "Noble / Clan Surname" },
        ],
      },
    ],
  },
  organizations: {
    domain: "organizations",
    defaultTab: "organization",
    tabs: [
      {
        id: "organization",
        label: "Guilds & Organizations",
        desc: "Assemble names for political parties, government agencies, media outlets, NGOs, churches, companies, universities, guilds, and taverns.",
        subTypes: [
          { value: "generic", label: "Organization Name (Default)" },
          { value: "political-party", label: "Political Party / Movement" },
          { value: "government-agency", label: "Government Ministry / Agency" },
          { value: "media-outlet", label: "News / Media Outlet" },
          { value: "ngo-foundation", label: "NGO / Foundation" },
          { value: "religious-order", label: "Religious Order / Church" },
          { value: "business-company", label: "Business / Company" },
          { value: "academic-institution", label: "Academic Institution" },
          { value: "mystic-order", label: "Mystic & Academic Order" },
          { value: "covert-org", label: "Covert & Thieves Guild" },
          { value: "tavern", label: "Tavern & Brew House Establishment" },
        ],
      },
    ],
  },
  culture: {
    domain: "culture",
    defaultTab: "culture",
    tabs: [
      {
        id: "culture",
        label: "Cultures & Ethnicities",
        desc: "Generate names for indigenous tribes, historical ethnicities, linguistic dialects, traditional sports, and regional cuisine.",
        subTypes: [
          { value: "generic", label: "Cultures & Ethnicities" },
          { value: "sports", label: "Sports & Traditional Games" },
          { value: "cuisine", label: "Cuisine & Foods" },
        ],
      },
    ],
  },
  military: {
    domain: "military",
    defaultTab: "military",
    tabs: [
      {
        id: "military",
        label: "Units & Operations",
        desc: "Assemble names for military regiments, divisions, brigades, task forces, or military operations.",
        subTypes: [
          { value: "generic", label: "Military Name (Default)" },
          { value: "military-unit", label: "Template-Generated Military Unit" },
          { value: "mercenary-band", label: "Mercenary Company / Band" },
        ],
      },
      {
        id: "ship",
        label: "Naval Ships & Assets",
        desc: "Assemble names for aircraft carriers, destroyers, submarines, and fleets.",
      },
    ],
  },
};
