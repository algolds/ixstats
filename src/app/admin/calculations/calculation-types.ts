// src/app/admin/calculations/calculation-types.ts
import {
  Dollar as DollarSign,
  Group as Users,
  Globe,
  StatUp as TrendingUp,
  Community as HandshakeIcon,
  Shield,
  ScaleFrameEnlarge as Scale,
} from "iconoir-react";

export interface CalculationModule {
  id: string;
  name: string;
  description: string;
  category:
    | "economic"
    | "demographic"
    | "stability"
    | "governance"
    | "synergy"
    | "military"
    | "diplomatic"
    | "tax";
  formula: string;
  variables: Record<string, number | string | string[]>;
  constants: Record<string, number>;
  dependencies: string[];
  testCases: TestCase[];
  lastModified: Date;
  modifiedBy: string;
  isActive: boolean;
  version: string;
}

export interface TestCase {
  id: string;
  name: string;
  inputs: Record<string, number | string | string[]>;
  expectedOutput: number;
  actualOutput?: number;
  status: "passed" | "failed" | "pending";
}

export interface CalculationResult {
  success: boolean;
  result?: number;
  error?: string;
  executionTime: number;
  intermediateSteps?: Record<string, number>;
}

export const CALCULATION_CATEGORIES = {
  economic: { label: "Economic", icon: DollarSign, color: "text-green-500" },
  demographic: { label: "Demographics", icon: Users, color: "text-blue-500" },
  stability: { label: "Stability", icon: Globe, color: "text-purple-500" },
  governance: { label: "Governance", icon: TrendingUp, color: "text-orange-500" },
  synergy: { label: "Synergy", icon: HandshakeIcon, color: "text-indigo-500" },
  military: { label: "Military", icon: Shield, color: "text-red-500" },
  diplomatic: { label: "Diplomatic", icon: Globe, color: "text-cyan-500" },
  tax: { label: "Tax System", icon: Scale, color: "text-amber-500" },
} as const;
