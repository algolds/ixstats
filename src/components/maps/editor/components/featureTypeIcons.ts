import {
  MapPin,
  Hexagon,
  PathArrow as Route,
  Bank as Landmark,
  ModernTv as Mountain,
  SeaWaves as Waves,
  Droplet,
} from "iconoir-react";

const FEATURE_TYPE_ICONS = {
  city: MapPin,
  subdivision: Hexagon,
  poi: Landmark,
  storyPin: Landmark,
  peak: Mountain,
  river: Waves,
  lake: Droplet,
  route: Route,
};

export function getFeatureIcon(type: string, fallback = MapPin) {
  return FEATURE_TYPE_ICONS[type as keyof typeof FEATURE_TYPE_ICONS] ?? fallback;
}
