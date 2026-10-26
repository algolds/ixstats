// src/app/admin/storyteller/_components/event-wizard-config.tsx
// The world event wizard's event types, steps and form state.

import {
  StatDown as TrendingDown,
  Tournament as Swords,
  Wind,
  ScaleFrameEnlarge as Scale,
  Cpu,
  Heart,
  FireFlame as Flame,
  MagicWand as Wand2,
  Sparks as Sparkles,
} from "iconoir-react";

export const EVENT_TYPES = [
  {
    value: "economic_crisis",
    label: "Economic crisis",
    icon: TrendingDown,
    color: "text-red",
    bg: "bg-red/10 border-red/20",
    description: "Recession, market crash, or financial meltdown",
  },
  {
    value: "trade_war",
    label: "Trade war",
    icon: Swords,
    color: "text-orange",
    bg: "bg-orange/10 border-orange/20",
    description: "Tariffs, sanctions, and trade restrictions",
  },
  {
    value: "natural_disaster",
    label: "Natural disaster",
    icon: Wind,
    color: "text-yellow",
    bg: "bg-yellow/10 border-yellow/20",
    description: "Earthquakes, hurricanes, floods, or wildfires",
  },
  {
    value: "political_upheaval",
    label: "Political upheaval",
    icon: Scale,
    color: "text-purple",
    bg: "bg-purple/10 border-purple/20",
    description: "Revolution, coup, or major political shift",
  },
  {
    value: "tech_revolution",
    label: "Tech revolution",
    icon: Cpu,
    color: "text-blue",
    bg: "bg-blue/10 border-blue/20",
    description: "Major technological breakthrough or disruption",
  },
  {
    value: "peace_era",
    label: "Peace & prosperity",
    icon: Sparkles,
    color: "text-green",
    bg: "bg-green/10 border-green/20",
    description: "Conflict resolution and economic flourishing",
  },
  {
    value: "pandemic",
    label: "Pandemic",
    icon: Heart,
    color: "text-pink",
    bg: "bg-pink/10 border-pink/20",
    description: "Global health crisis with economic fallout",
  },
  {
    value: "climate_disaster",
    label: "Climate emergency",
    icon: Flame,
    color: "text-orange",
    bg: "bg-orange/10 border-orange/20",
    description: "Severe environmental and climate impacts",
  },
  {
    value: "custom",
    label: "Custom event",
    icon: Wand2,
    color: "text-indigo",
    bg: "bg-indigo/10 border-indigo/20",
    description: "Define your own narrative event",
  },
] as const;

export type EventTypeValue = (typeof EVENT_TYPES)[number]["value"];

export const STEPS = [
  { label: "Event type", number: 1 },
  { label: "Scope & countries", number: 2 },
  { label: "Parameters", number: 3 },
  { label: "Impact preview", number: 4 },
  { label: "Confirm & schedule", number: 5 },
] as const;

export interface WizardFormState {
  type: EventTypeValue | "";
  name: string;
  description: string;
  scope: "global" | "targeted";
  affectedCountryIds: string[];
  severity: number;
  duration: number;
  delayDays: number;
}

export const defaultForm: WizardFormState = {
  type: "",
  name: "",
  description: "",
  scope: "targeted",
  affectedCountryIds: [],
  severity: 0.5,
  duration: 2,
  delayDays: 0,
};
