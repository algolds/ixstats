/**
 * Atomic Economic Components - Display Copy
 *
 * Hand-written player-facing copy for every economic component: a plain-language name and a
 * one-line effect ("what this does to your nation"). Names are written, never derived from the
 * enum (no more "Rd Investment"). Copy rules: sentence case, plain words, no em dashes, no
 * exclamation marks.
 *
 * Keys are the EconomicComponentType string values. This module imports the enum as a type only,
 * so ./types can import it at runtime without a cycle.
 *
 * @module atomic-economic-data/display
 */

import type { EconomicComponentType } from "./types";

export interface EconomicComponentDisplay {
  /** Plain-language name shown in pickers, summaries and synergy messages. */
  name: string;
  /** One sentence on what the component does to the nation. */
  effect: string;
}

export const ECONOMIC_COMPONENT_DISPLAY: Record<EconomicComponentType, EconomicComponentDisplay> = {
  // Economic model
  FREE_MARKET_SYSTEM: {
    name: "Free market",
    effect: "Businesses grow and wages rise faster, but the state does less to protect people.",
  },
  MIXED_ECONOMY: {
    name: "Mixed economy",
    effect: "Markets and the state share the economy, giving steady but moderate growth.",
  },
  STATE_CAPITALISM: {
    name: "State-run key industries",
    effect:
      "The state owns key industries, which builds up factories and utilities but slows wage growth.",
  },
  PLANNED_ECONOMY: {
    name: "Central planning",
    effect:
      "The state decides what gets made, which keeps prices fixed but makes the economy slow to adapt.",
  },
  SOCIAL_MARKET_ECONOMY: {
    name: "Market with a safety net",
    effect:
      "A market economy with strong welfare that keeps unemployment low and supports health and schools.",
  },
  RESOURCE_BASED_ECONOMY: {
    name: "Natural resource economy",
    effect:
      "Oil, minerals and other resources bring in money, but the economy rises and falls with their prices.",
  },
  KNOWLEDGE_ECONOMY: {
    name: "Ideas and expertise economy",
    effect: "Growth comes from skills and ideas, raising wages in tech and professional work.",
  },
  INNOVATION_ECONOMY: {
    name: "Innovation-driven economy",
    effect:
      "Constant invention creates new industries and well-paid jobs, but it is costly to set up.",
  },
  RULE_OF_LAW: {
    name: "Reliable courts and contracts",
    effect:
      "Fair courts and enforced contracts give businesses and investors the confidence to grow.",
  },

  // Sector focus
  AGRICULTURE_LED: {
    name: "Farming economy",
    effect: "Farming feeds the nation and earns exports, but wages and city growth stay low.",
  },
  MANUFACTURING_LED: {
    name: "Manufacturing economy",
    effect: "Factories create many steady jobs and goods to sell, but need large investment.",
  },
  SERVICE_BASED: {
    name: "Service economy",
    effect: "Shops, offices and services employ most people and keep jobs plentiful.",
  },
  TECHNOLOGY_FOCUSED: {
    name: "Technology sector",
    effect: "Tech companies drive growth and high wages, but need a highly educated workforce.",
  },
  FINANCE_CENTERED: {
    name: "Financial centre",
    effect:
      "Banks and investors bring wealth and high salaries, while farming and factories shrink.",
  },
  DOMESTIC_FOCUSED: {
    name: "Home market focus",
    effect:
      "Businesses sell mainly at home, which shields jobs from world shocks but limits growth.",
  },
  TOURISM_BASED: {
    name: "Tourism economy",
    effect:
      "Visitors spend money on hotels and services, creating jobs that rely on travel staying strong.",
  },
  REAL_ESTATE_FOCUSED: {
    name: "Property and construction",
    effect:
      "Building and property sales drive growth, but house prices can rise faster than wages.",
  },

  // Labour system
  FLEXIBLE_LABOR: {
    name: "Flexible hiring and firing",
    effect: "Employers hire easily so more people work, but jobs are less secure.",
  },
  PROTECTED_WORKERS: {
    name: "Strong worker protections",
    effect: "Workers get secure jobs and better pay, but employers hire more slowly.",
  },
  UNION_BASED: {
    name: "Strong trade unions",
    effect: "Unions bargain for higher wages and fairer conditions, which can slow hiring.",
  },
  GIG_ECONOMY: {
    name: "Gig and freelance work",
    effect: "Short-term work makes jobs easy to find, but pay and benefits are less reliable.",
  },
  PROFESSIONAL_SERVICES: {
    name: "Professional workforce",
    effect:
      "Lawyers, accountants and consultants earn high wages and help other businesses run well.",
  },
  SKILL_BASED: {
    name: "Skills-based hiring",
    effect: "People are hired for what they can do, which raises productivity and wages.",
  },
  EDUCATION_FIRST: {
    name: "Education as top priority",
    effect: "Heavy spending on learning builds a skilled workforce over time.",
  },
  MERIT_BASED: {
    name: "Merit-based pay and promotion",
    effect: "Pay and promotion follow performance, which rewards talent but can widen pay gaps.",
  },
  HIGH_SKILLED_WORKERS: {
    name: "Highly skilled workforce",
    effect: "A well-trained workforce attracts advanced industries and earns high wages.",
  },
  EDUCATION_FOCUSED: {
    name: "Free public schooling",
    effect: "Every child gets a good school education, which raises literacy and future earnings.",
  },
  HEALTHCARE_FOCUSED: {
    name: "Universal healthcare",
    effect: "Everyone gets medical care, so people live longer and stay able to work.",
  },
  VOCATIONAL_TRAINING: {
    name: "Apprenticeships and trade schools",
    effect: "Young people learn trades on the job, which keeps youth unemployment low.",
  },

  // Trade policy
  FREE_TRADE: {
    name: "Free trade",
    effect:
      "Low trade barriers open new markets and bring cheaper imports, but expose firms to competition.",
  },
  PROTECTIONIST: {
    name: "Tariffs to protect industry",
    effect: "Taxes on imports shield local firms, but raise prices and slow growth.",
  },
  EXPORT_ORIENTED: {
    name: "Export-led growth",
    effect: "Firms make goods to sell abroad, which builds up factories and jobs.",
  },
  BALANCED_TRADE: {
    name: "Balanced trade",
    effect: "Imports and exports are kept roughly even, which avoids debt but limits big gains.",
  },
  EXPORT_SUBSIDY: {
    name: "Support for exporters",
    effect: "The state helps exporters with grants and cheap loans, which costs the budget.",
  },
  IMPORT_SUBSTITUTION: {
    name: "Replacing imports at home",
    effect: "Local factories make goods the nation used to import, slowly building industry.",
  },
  TRADE_BLOC: {
    name: "Regional trade bloc",
    effect: "Neighbours trade freely with each other but keep shared tariffs on everyone else.",
  },
  BILATERAL_FOCUS: {
    name: "One-to-one trade deals",
    effect:
      "Deals are made with one partner at a time, which fits your needs but takes more effort.",
  },
  MULTILATERAL_FOCUS: {
    name: "Global trade agreements",
    effect: "Joining wide agreements opens many markets at once under shared rules.",
  },
  TRADE_FACILITATION: {
    name: "Fast customs and ports",
    effect: "Simple paperwork and good ports make trade cheaper and quicker.",
  },
  COMPETITIVE_MARKETS: {
    name: "Strong competition rules",
    effect: "Rules against monopolies keep prices fair and push firms to improve.",
  },

  // Innovation
  RD_INVESTMENT: {
    name: "Research funding",
    effect: "Money for research leads to new products and better jobs.",
  },
  TECH_TRANSFER: {
    name: "Adopting foreign technology",
    effect: "Learning from foreign firms helps local industry catch up quickly.",
  },
  STARTUP_ECOSYSTEM: {
    name: "Startup support",
    effect: "New businesses find it easy to start and grow, creating jobs and new ideas.",
  },
  PATENT_PROTECTION: {
    name: "Patent protection",
    effect: "Inventors keep the rights to their inventions, which rewards spending on new ideas.",
  },
  OPEN_INNOVATION: {
    name: "Open research sharing",
    effect: "Research is shared freely, which spreads ideas fast but gives inventors less reward.",
  },
  UNIVERSITY_PARTNERSHIPS: {
    name: "University and industry links",
    effect: "Universities work with businesses to turn research into products and jobs.",
  },
  VENTURE_CAPITAL: {
    name: "Startup investment funds",
    effect: "Investors back risky new companies, which speeds up the growth of new industries.",
  },
  INTELLECTUAL_PROPERTY: {
    name: "Copyright and trademarks",
    effect:
      "Creators and brands own their work, which helps creative and tech businesses earn money.",
  },
  RESEARCH_AND_DEVELOPMENT: {
    name: "Public research institutes",
    effect: "State laboratories carry out long-term research that businesses would not fund alone.",
  },

  // Resource management
  SUSTAINABLE_DEVELOPMENT: {
    name: "Sustainable growth",
    effect: "Growth is planned to protect resources for future generations, at a modest cost now.",
  },
  EXTRACTION_FOCUSED: {
    name: "Mining and drilling",
    effect: "Digging up resources earns quick money but damages the land and cannot last forever.",
  },
  RENEWABLE_ENERGY: {
    name: "Renewable energy",
    effect: "Wind, solar and water power provide clean energy and new jobs.",
  },
  CIRCULAR_ECONOMY: {
    name: "Recycling and reuse",
    effect: "Products are repaired and recycled, which cuts waste and saves resources.",
  },
  LINEAR_ECONOMY: {
    name: "Throwaway production",
    effect: "Goods are made, used and thrown away, which is cheap now but wastes resources.",
  },
  CONSERVATION_FIRST: {
    name: "Nature protection first",
    effect:
      "Large areas of land and sea are protected, which helps tourism but limits mining and building.",
  },
  GREEN_TECHNOLOGY: {
    name: "Clean technology industry",
    effect: "Local firms build clean energy and low-pollution products to use and sell.",
  },
  CARBON_NEUTRAL: {
    name: "Net zero emissions",
    effect:
      "The nation cuts its climate pollution to zero overall, costing money now to avoid harm later.",
  },
  CARBON_INTENSIVE: {
    name: "Fossil fuel power",
    effect: "Cheap coal, oil and gas power industry now, but pollution harms health and tourism.",
  },
  ECO_FRIENDLY: {
    name: "Everyday green rules",
    effect:
      "Rules on waste, packaging and pollution make daily life cleaner at a small cost to business.",
  },
  GREEN_ECONOMY: {
    name: "Green economy",
    effect: "The whole economy shifts toward clean industry, creating green jobs over time.",
  },
};

/** The written display name for an economic component type, if it is a known type. */
export function getEconomicComponentDisplay(
  componentType: string
): EconomicComponentDisplay | undefined {
  return Object.prototype.hasOwnProperty.call(ECONOMIC_COMPONENT_DISPLAY, componentType)
    ? ECONOMIC_COMPONENT_DISPLAY[componentType as EconomicComponentType]
    : undefined;
}

/** The one-line plain effect for an economic component type, or an empty string if unknown. */
export function getEconomicComponentEffect(componentType: string): string {
  return getEconomicComponentDisplay(componentType)?.effect ?? "";
}
