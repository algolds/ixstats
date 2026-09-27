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
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/20",
    borderColor: "border-indigo-500/40",
    label: "Cultural Festival",
    description: "Celebration of traditions and customs",
    primary: true,
  },
  exhibition: {
    icon: Building,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    borderColor: "border-blue-500/40",
    label: "Cultural Exhibition",
    description: "Showcase of cultural heritage",
    primary: true,
  },
  education: {
    icon: Book,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    borderColor: "border-emerald-500/40",
    label: "Educational Exchange",
    description: "Knowledge and academic collaboration",
    primary: true,
  },
  cuisine: {
    icon: Cutlery,
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    borderColor: "border-amber-500/40",
    label: "Culinary Exchange",
    description: "Food culture and traditions",
    primary: true,
  },
  arts: {
    icon: Palette,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    borderColor: "border-blue-500/40",
    label: "Arts Exchange",
    description: "Visual arts and creative works",
    primary: true,
  },
  sports: {
    icon: Trophy,
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/40",
    label: "Sports Exchange",
    description: "Athletic competition and culture",
    primary: true,
  },
  technology: {
    icon: Gamepad,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
    borderColor: "border-cyan-500/40",
    label: "Tech Exchange",
    description: "Innovation and technology",
    primary: true,
  },
  diplomacy: {
    icon: Globe,
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    borderColor: "border-amber-500/40",
    label: "Diplomatic Summit",
    description: "High-level dialogue",
    primary: true,
  },
  // More options (hidden by default)
  music: {
    icon: MusicNote,
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/20",
    borderColor: "border-indigo-500/40",
    label: "Music Exchange",
    description: "Musical traditions and performances",
    primary: false,
  },
  film: {
    icon: MediaVideo,
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/20",
    borderColor: "border-indigo-500/40",
    label: "Film & Media",
    description: "Cinema and media culture",
    primary: false,
  },
  environmental: {
    icon: Leaf,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    borderColor: "border-emerald-500/40",
    label: "Environmental",
    description: "Sustainability and conservation",
    primary: false,
  },
  science: {
    icon: Flask,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
    borderColor: "border-cyan-500/40",
    label: "Scientific Research",
    description: "Scientific collaboration",
    primary: false,
  },
  trade: {
    icon: DeliveryTruck,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    borderColor: "border-emerald-500/40",
    label: "Trade Mission",
    description: "Economic and commercial ties",
    primary: false,
  },
  humanitarian: {
    icon: Heart,
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/40",
    label: "Humanitarian Aid",
    description: "Relief and development programs",
    primary: false,
  },
  agriculture: {
    icon: Leaf,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    borderColor: "border-emerald-500/40",
    label: "Agricultural",
    description: "Farming and food security",
    primary: false,
  },
  heritage: {
    icon: Building,
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    borderColor: "border-amber-500/40",
    label: "Heritage Preservation",
    description: "Historical sites and artifacts",
    primary: false,
  },
  youth: {
    icon: Medal,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    borderColor: "border-yellow-500/40",
    label: "Youth Program",
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
  "ShareAndroid technological innovations",
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
