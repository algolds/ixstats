// Cultural exchange wizard configuration and types (no JSX).

import {
  Building,
  Book,
  Cutlery,
  MediaVideo,
  Flask,
  Gamepad,
  Globe,
  Heart,
  Leaf,
  Medal,
  MusicNote,
  Palette,
  DeliveryTruck,
  Star,
  Trophy,
} from "iconoir-react";
import type { RouterOutputs } from "~/trpc/react";

// Exchange type configurations
export const WIZARD_EXCHANGE_TYPES = {
  festival: {
    icon: Star,
    color: "text-label-secondary",
    bgColor: "bg-indigo/20",
    borderColor: "border-indigo/40",
    label: "Cultural festival",
    description: "Celebration of traditions and customs",
    primary: true,
  },
  exhibition: {
    icon: Building,
    color: "text-label-secondary",
    bgColor: "bg-blue/20",
    borderColor: "border-blue/40",
    label: "Cultural exhibition",
    description: "Showcase of cultural heritage",
    primary: true,
  },
  education: {
    icon: Book,
    color: "text-label-secondary",
    bgColor: "bg-green/20",
    borderColor: "border-green/40",
    label: "Educational exchange",
    description: "Knowledge and academic collaboration",
    primary: true,
  },
  cuisine: {
    icon: Cutlery,
    color: "text-label-secondary",
    bgColor: "bg-yellow/20",
    borderColor: "border-yellow/40",
    label: "Culinary exchange",
    description: "Food culture and traditions",
    primary: true,
  },
  arts: {
    icon: Palette,
    color: "text-label-secondary",
    bgColor: "bg-blue/20",
    borderColor: "border-blue/40",
    label: "Arts exchange",
    description: "Visual arts and creative works",
    primary: true,
  },
  sports: {
    icon: Trophy,
    color: "text-label-secondary",
    bgColor: "bg-red/20",
    borderColor: "border-red/40",
    label: "Sports exchange",
    description: "Athletic competition and culture",
    primary: true,
  },
  technology: {
    icon: Gamepad,
    color: "text-label-secondary",
    bgColor: "bg-cyan/20",
    borderColor: "border-cyan/40",
    label: "Tech exchange",
    description: "Innovation and technology",
    primary: true,
  },
  diplomacy: {
    icon: Globe,
    color: "text-label-secondary",
    bgColor: "bg-yellow/20",
    borderColor: "border-yellow/40",
    label: "Diplomatic summit",
    description: "High-level dialogue",
    primary: true,
  },
  // More options (hidden by default)
  music: {
    icon: MusicNote,
    color: "text-label-secondary",
    bgColor: "bg-indigo/20",
    borderColor: "border-indigo/40",
    label: "Music exchange",
    description: "Musical traditions and performances",
    primary: false,
  },
  film: {
    icon: MediaVideo,
    color: "text-label-secondary",
    bgColor: "bg-indigo/20",
    borderColor: "border-indigo/40",
    label: "Film & media",
    description: "Cinema and media culture",
    primary: false,
  },
  environmental: {
    icon: Leaf,
    color: "text-label-secondary",
    bgColor: "bg-green/20",
    borderColor: "border-green/40",
    label: "Environmental",
    description: "Sustainability and conservation",
    primary: false,
  },
  science: {
    icon: Flask,
    color: "text-label-secondary",
    bgColor: "bg-cyan/20",
    borderColor: "border-cyan/40",
    label: "Scientific research",
    description: "Scientific collaboration",
    primary: false,
  },
  trade: {
    icon: DeliveryTruck,
    color: "text-label-secondary",
    bgColor: "bg-green/20",
    borderColor: "border-green/40",
    label: "Trade mission",
    description: "Economic and commercial ties",
    primary: false,
  },
  humanitarian: {
    icon: Heart,
    color: "text-label-secondary",
    bgColor: "bg-red/20",
    borderColor: "border-red/40",
    label: "Humanitarian aid",
    description: "Relief and development programs",
    primary: false,
  },
  agriculture: {
    icon: Leaf,
    color: "text-label-secondary",
    bgColor: "bg-green/20",
    borderColor: "border-green/40",
    label: "Agricultural",
    description: "Farming and food security",
    primary: false,
  },
  heritage: {
    icon: Building,
    color: "text-label-secondary",
    bgColor: "bg-yellow/20",
    borderColor: "border-yellow/40",
    label: "Heritage preservation",
    description: "Historical sites and artifacts",
    primary: false,
  },
  youth: {
    icon: Medal,
    color: "text-label-secondary",
    bgColor: "bg-yellow/20",
    borderColor: "border-yellow/40",
    label: "Youth program",
    description: "Young leaders development",
    primary: false,
  },
} as const;

export type WizardExchangeType = keyof typeof WIZARD_EXCHANGE_TYPES;

// Common objectives
export const COMMON_OBJECTIVES = [
  "Strengthen cultural understanding",
  "Promote artistic collaboration",
  "Enhance educational ties",
  "Foster economic partnerships",
  "Build diplomatic goodwill",
  "Share technological innovations",
  "Preserve cultural heritage",
  "Develop youth programs",
];

export const getCountryFlagUrl = (country?: { flagUrl?: string | null; flag?: string | null }) =>
  country?.flagUrl ?? country?.flag ?? undefined;

export const WIZARD_STEP_COUNT = 5;

/** A country row from `countries.getAll`. */
export type WizardCountry = RouterOutputs["countries"]["getAll"]["countries"][number];

export interface WizardHostCountry {
  id: string;
  name: string;
  flagUrl?: string | null;
  economicTier?: string;
}

/** Payload the wizard hands to `onComplete`. */
export interface ExchangeWizardData {
  title: string;
  type: string;
  description: string;
  participantCountryId: string;
  narrative: string;
  objectives: string[];
  startDate: string;
  endDate: string;
  isPublic: boolean;
  maxParticipants: number;
}
