// src/lib/military-config.ts
// Static configuration for military branch types

import { Shield, Ship, Plane, Zap, Target, Radio, Star } from "lucide-react";

/**
 * Branch type configurations inspired by Caphiria structure.
 * Maps each branch type to its display metadata, available unit/asset types,
 * and default naming.
 */
export const BRANCH_CONFIGS = {
  army: {
    label: "Army",
    icon: Shield,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    unitTypes: ["division", "brigade", "regiment", "battalion"],
    assetTypes: ["vehicle", "weapon_system", "installation"],
    defaultName: "National Army",
  },
  navy: {
    label: "Navy",
    icon: Ship,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    unitTypes: ["fleet", "squadron", "division"],
    assetTypes: ["ship", "installation"],
    defaultName: "Naval Forces",
  },
  air_force: {
    label: "Air Force",
    icon: Plane,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
    unitTypes: ["wing", "squadron", "group"],
    assetTypes: ["aircraft", "installation"],
    defaultName: "Air Force",
  },
  space_force: {
    label: "Space Force",
    icon: Zap,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    unitTypes: ["squadron", "delta", "garrison"],
    assetTypes: ["installation", "weapon_system"],
    defaultName: "Space Command",
  },
  marines: {
    label: "Marine Corps",
    icon: Target,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    unitTypes: ["division", "regiment", "battalion"],
    assetTypes: ["vehicle", "aircraft", "ship"],
    defaultName: "Marine Corps",
  },
  cyber_command: {
    label: "Cyber Command",
    icon: Radio,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    unitTypes: ["group", "squadron", "team"],
    assetTypes: ["installation", "weapon_system"],
    defaultName: "Cyber Command",
  },
  special_forces: {
    label: "Special Operations",
    icon: Star,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    unitTypes: ["regiment", "battalion", "squadron"],
    assetTypes: ["weapon_system", "vehicle", "aircraft"],
    defaultName: "Special Operations Command",
  },
  coast_guard: {
    label: "Coast Guard",
    icon: Ship,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
    unitTypes: ["district", "sector", "station"],
    assetTypes: ["ship", "aircraft", "installation"],
    defaultName: "Coast Guard",
  },
} as const;

/** Union of all valid branch type keys */
export type BranchType = keyof typeof BRANCH_CONFIGS;
