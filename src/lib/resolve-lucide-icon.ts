import {
  // Chat Badges / Cosmetics
  Crown,
  Shield,
  Sparkles,
  Flame,
  Swords,
  Award,
  Star,
  Heart,
  Check,
  Zap,
  Trophy,
  ShieldAlert,
  Gem,
  Gift,

  // Department Category Icons
  GraduationCap,
  Briefcase,
  Globe,
  Home,
  Users,
  Truck,
  Leaf,
  Building,
  Wifi,
  Palette,
  Beaker,
  Medal,
  Eye,
  AlertTriangle,
  MoreHorizontal,

  // Government Component Icons
  Settings,
  Building2,
  Vote,
  Clock,
  TrendingUp,
  Cross,
  Scale,
  Flag,
  Cpu,
  DollarSign,
  Target,
  BarChart3,
  Brain,
  Monitor,
  Network,
  CheckCircle,
  BookOpen,
  Handshake,
  Microscope,
  Lightbulb,
  ArrowRightLeft,
  Copyright,
  MessageSquare,
  RefreshCw,
  Info,
  Upload,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Crown,
  Shield,
  Sparkles,
  Flame,
  Swords,
  Award,
  Star,
  Heart,
  Check,
  Zap,
  Trophy,
  ShieldAlert,
  Gem,
  Gift,
  GraduationCap,
  Briefcase,
  Globe,
  Home,
  Users,
  Truck,
  Leaf,
  Building,
  Wifi,
  Palette,
  Beaker,
  Medal,
  Eye,
  AlertTriangle,
  MoreHorizontal,
  Settings,
  Building2,
  Vote,
  Clock,
  TrendingUp,
  Cross,
  Scale,
  Flag,
  Cpu,
  DollarSign,
  Target,
  BarChart3,
  Brain,
  Monitor,
  Network,
  CheckCircle,
  BookOpen,
  Handshake,
  Microscope,
  Lightbulb,
  ArrowRightLeft,
  Copyright,
  MessageSquare,
  RefreshCw,
  Info,
  Upload,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
};

/**
 * Resolves a Lucide icon by its component name.
 * This helper avoids dynamic imports / wildcards that degrade compilation times.
 */
export function resolveLucideIcon(iconName: string | undefined): LucideIcon | null {
  if (!iconName) return null;

  // Support exact match first
  if (iconName in ICON_MAP) {
    return ICON_MAP[iconName]!;
  }

  // Support capitalizing first letter
  const capitalized = iconName.charAt(0).toUpperCase() + iconName.slice(1);
  if (capitalized in ICON_MAP) {
    return ICON_MAP[capitalized]!;
  }

  return null;
}

/**
 * Returns a chat badge icon, falling back to Crown if not found.
 */
export function getChatBadgeIcon(iconName: string | undefined): LucideIcon {
  return resolveLucideIcon(iconName) || Crown;
}
