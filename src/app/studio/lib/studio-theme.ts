/**
 * Studio Theme — Section-specific color palettes
 *
 * Following the builder-theme.ts RPG pattern with unique themes per section.
 */

export const STUDIO_SECTIONS = [
  "dashboard",
  "create",
  "terrain",
  "climate",
  "nations",
  "populate",
  "economics",
  "preview",
  "publish",
] as const;

export type StudioSection = (typeof STUDIO_SECTIONS)[number];

export interface SectionTheme {
  id: StudioSection;
  label: string;
  icon: string;
  description: string;
  gradient: string;
  accentColor: string;
  bgTint: string;
}

export const SECTION_THEMES: Record<StudioSection, SectionTheme> = {
  dashboard: {
    id: "dashboard",
    label: "Dashboard",
    icon: "🏠",
    description: "Your realms and worlds",
    gradient: "from-slate-500 to-slate-700",
    accentColor: "rgb(100, 116, 139)",
    bgTint: "rgba(100, 116, 139, 0.05)",
  },
  create: {
    id: "create",
    label: "Create",
    icon: "✨",
    description: "Start a new realm",
    gradient: "from-violet-500 to-purple-700",
    accentColor: "rgb(139, 92, 246)",
    bgTint: "rgba(139, 92, 246, 0.05)",
  },
  terrain: {
    id: "terrain",
    label: "Terrain",
    icon: "🏔️",
    description: "Shape your world",
    gradient: "from-amber-600 to-orange-800",
    accentColor: "rgb(217, 119, 6)",
    bgTint: "rgba(217, 119, 6, 0.05)",
  },
  climate: {
    id: "climate",
    label: "Climate",
    icon: "🌤️",
    description: "Atmosphere and biomes",
    gradient: "from-sky-500 to-cyan-700",
    accentColor: "rgb(14, 165, 233)",
    bgTint: "rgba(14, 165, 233, 0.05)",
  },
  nations: {
    id: "nations",
    label: "Nations",
    icon: "🏛️",
    description: "Countries and cultures",
    gradient: "from-violet-600 to-indigo-800",
    accentColor: "rgb(124, 58, 237)",
    bgTint: "rgba(124, 58, 237, 0.05)",
  },
  populate: {
    id: "populate",
    label: "Populate",
    icon: "🏙️",
    description: "Cities, people, and routes",
    gradient: "from-emerald-500 to-green-700",
    accentColor: "rgb(16, 185, 129)",
    bgTint: "rgba(16, 185, 129, 0.05)",
  },
  economics: {
    id: "economics",
    label: "Economics",
    icon: "💰",
    description: "IxStats data generation",
    gradient: "from-yellow-500 to-amber-700",
    accentColor: "rgb(234, 179, 8)",
    bgTint: "rgba(234, 179, 8, 0.05)",
  },
  preview: {
    id: "preview",
    label: "Preview",
    icon: "🌍",
    description: "Explore your world",
    gradient: "from-teal-500 to-blue-700",
    accentColor: "rgb(20, 184, 166)",
    bgTint: "rgba(20, 184, 166, 0.05)",
  },
  publish: {
    id: "publish",
    label: "Publish",
    icon: "🚀",
    description: "Finalize and share",
    gradient: "from-rose-500 to-red-700",
    accentColor: "rgb(244, 63, 94)",
    bgTint: "rgba(244, 63, 94, 0.05)",
  },
};

export function getSectionTheme(section: StudioSection): SectionTheme {
  return SECTION_THEMES[section];
}

export function getSectionFromPathname(pathname: string): StudioSection {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (last && STUDIO_SECTIONS.includes(last as StudioSection)) {
    return last as StudioSection;
  }
  return "dashboard";
}
