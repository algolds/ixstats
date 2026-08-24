/**
 * Atomic Government Component Data
 *
 * Pure data definitions for all government components, categories, and templates.
 * This file contains NO business logic - only TypeScript types and constants.
 *
 * @module atomic-government-data
 */

import { ComponentType } from "@prisma/client";
import { Settings, City as Building2, Group as Users, Shield, Crown, CheckSquare as Vote, Clock, StatUp as TrendingUp, Star, PharmacyCrossCircle as Cross, Suitcase as Briefcase, ScaleFrameEnlarge as Scale, WhiteFlag as Flag, Cpu, Eye, Dollar as DollarSign, Archery as Target, StatsReport as BarChart3, Heart, Leaf, Brain, ModernTv as Monitor, Globe, Network, Trophy as Award, CheckCircle, WarningTriangle as AlertTriangle, GraduationCap, OpenBook as BookOpen, Community as Handshake, Microscope, LightBulb as Lightbulb, ArrowSeparate as ArrowRightLeft, Copyright, Flash as Zap, Wifi, ChatBubble as MessageSquare, Refresh as RefreshCw } from "iconoir-react";

/**
 * Atomic Government Component Definition
 */
export interface AtomicGovernmentComponent {
  id: string;
  type: ComponentType;
  name: string;
  description: string;
  effectiveness: number;
  synergies: ComponentType[];
  conflicts: ComponentType[];
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
  category: string;
  prerequisites: string[];
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  metadata: {
    complexity: "Low" | "Medium" | "High";
    timeToImplement: string;
    staffRequired: number;
    technologyRequired: boolean;
  };
}

