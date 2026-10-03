import {
  Book,
  Building,
  ClockRotateRight,
  Coins,
  Globe,
  Group,
  Heart,
  Map,
  Shield,
} from "iconoir-react";

/**
 * Icon mapping for different wiki section types
 * Provides contextual visual indicators for section categories
 */
export const SECTION_ICONS = {
  overview: Globe,
  geography: Map,
  government: Building,
  economy: Coins,
  demographics: Group,
  history: ClockRotateRight,
  culture: Heart,
  foreign_relations: Globe,
  military: Shield,
  education: Book,
  default: Book,
} as const;
