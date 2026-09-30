import React from "react";
import {
  Globe as IconoirGlobe,
  Building as IconoirBuilding,
  Palette as IconoirPalette,
  GraphUp as IconoirGraphUp,
  MapPin as IconoirMapPin,
  Bank as IconoirBank,
  Timer as IconoirTimer,
  Shield as IconoirShield,
  Leaf as IconoirLeaf,
  Group as IconoirGroup,
  Megaphone as IconoirMegaphone,
  Cpu as IconoirCpu,
  Packages as Layers,
} from "iconoir-react";

export interface DomainCategory {
  name: string;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  metric: string;
  description: string;
}

export const DOMAIN_CATEGORIES: DomainCategory[] = [
  {
    name: "Countries",
    color: "#3b82f6",
    icon: IconoirGlobe,
    metric: "Sovereign States & Territories",
    description: "Nations, sovereign states, dependent territories, and geopolitical entities.",
  },
  {
    name: "Economy",
    color: "#22c55e",
    icon: IconoirGraphUp,
    metric: "GDP, Trade & Industries",
    description:
      "Economic systems, international trade, currencies, financial markets, and industry.",
  },
  {
    name: "Government",
    color: "#6366f1",
    icon: IconoirBank,
    metric: "Political Systems & Law",
    description:
      "Political systems, constitutional structures, governance, and public administration.",
  },
  {
    name: "Military",
    color: "#ef4444",
    icon: IconoirShield,
    metric: "Defense & Armed Forces",
    description:
      "Armed forces branches, military equipment, defense doctrines, and historic conflicts.",
  },
  {
    name: "People",
    color: "#ec4899",
    icon: IconoirGroup,
    metric: "Demographics & Society",
    description:
      "Demographics, ethnic groups, linguistics, notable figures, and social structures.",
  },
  {
    name: "Politics",
    color: "#8b5cf6",
    icon: IconoirMegaphone,
    metric: "Elections, Parties & Treaties",
    description: "Elections, political movements, political parties, alliances, and diplomacy.",
  },
  {
    name: "History",
    color: "#eab308",
    icon: IconoirTimer,
    metric: "Timelines & Epochs",
    description: "Historical events, timelines, ancient eras, revolutions, and world history.",
  },
  {
    name: "Geography",
    color: "#14b8a6",
    icon: IconoirMapPin,
    metric: "Landforms & Regions",
    description: "Physical geography, continents, mountain ranges, bodies of water, and climates.",
  },
  {
    name: "Culture",
    color: "#a855f7",
    icon: IconoirPalette,
    metric: "Art, Heritage & Customs",
    description: "Art, architecture, music, folklore, cuisine, holidays, and cultural traditions.",
  },
  {
    name: "Technology",
    color: "#06b6d4",
    icon: IconoirCpu,
    metric: "Science & Innovation",
    description:
      "Science, technological development, aerospace, transport, and research institutions.",
  },
  {
    name: "Companies",
    color: "#f97316",
    icon: IconoirBuilding,
    metric: "Corporations & Commerce",
    description:
      "Commercial enterprises, conglomerates, state-owned corporations, and market leaders.",
  },
  {
    name: "Nature",
    color: "#10b981",
    icon: IconoirLeaf,
    metric: "Flora, Fauna & Ecology",
    description:
      "Flora, fauna, nature reserves, ecosystems, and natural phenomena across the world.",
  },
  {
    name: "Miscellaneous",
    color: "#64748b",
    icon: Layers,
    metric: "Indexes, Documents & General",
    description:
      "General topics, uncategorized articles, cross-disciplinary subjects, and reference indexes.",
  },
];

export const ALPHABET = ["ALL", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), "#"] as const;
