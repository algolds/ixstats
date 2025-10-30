/**
 * Policy Templates and Type Configuration
 *
 * This module provides pre-configured policy templates and type-specific
 * configurations for the policy creation system.
 *
 * Features:
 * - Pre-configured policy templates for common policy types
 * - Policy type configurations with icons, colors, and styling
 * - Type definitions for policy-related data structures
 *
 * @module policy-templates
 */

import {
  TrendingUp,
  Users,
  Globe,
  Briefcase,
  Shield,
  type LucideIcon
} from 'lucide-react';

/**
 * Policy type categorization
 */
export type PolicyType = 'economic' | 'social' | 'diplomatic' | 'infrastructure' | 'governance';

/**
 * Policy priority levels
 */
export type PolicyPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Policy category (more specific than type)
 */
export type PolicyCategory = string;

/**
 * Policy template interface
 */
export interface PolicyTemplate {
  /** Unique template identifier */
  id: string;
  /** Template display name */
  name: string;
  /** Template description */
  description: string;
  /** Policy type category */
  policyType: PolicyType;
  /** Specific policy category */
  category: string;
  /** Default settings for this template */
  defaultSettings: {
    /** Initial implementation cost (in currency units) */
    implementationCost?: number;
    /** Ongoing annual maintenance cost */
    maintenanceCost?: number;
    /** Default priority level */
    priority?: PolicyPriority;
    /** Target metrics and their expected changes */
    targetMetrics?: Record<string, number>;
  };
}

/**
 * Policy type configuration with UI metadata
 */
export interface PolicyTypeConfig {
  /** Icon component for this policy type */
  icon: LucideIcon;
  /** Text color class */
  color: string;
  /** Background color class */
  bg: string;
}

/**
 * Pre-configured policy templates for common policy types
 *
 * These templates provide sensible defaults for common policy initiatives,
 * saving users time and providing guidance on appropriate cost levels
 * and expected outcomes.
 */
export const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: 'stimulus',
    name: 'Economic Stimulus Package',
    description: 'Boost economic growth through targeted spending and tax incentives',
    policyType: 'economic',
    category: 'economic',
    defaultSettings: {
      implementationCost: 5000000,
      maintenanceCost: 0,
      priority: 'high',
      targetMetrics: { gdpGrowth: 2.5, unemployment: -1.0 }
    }
  },
  {
    id: 'healthcare',
    name: 'Universal Healthcare Initiative',
    description: 'Expand healthcare coverage to all citizens',
    policyType: 'social',
    category: 'healthcare',
    defaultSettings: {
      implementationCost: 10000000,
      maintenanceCost: 5000000,
      priority: 'critical',
      targetMetrics: { healthcareAccess: 100, lifeExpectancy: 5 }
    }
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure Modernization',
    description: 'Upgrade national infrastructure and transportation systems',
    policyType: 'infrastructure',
    category: 'infrastructure',
    defaultSettings: {
      implementationCost: 15000000,
      maintenanceCost: 3000000,
      priority: 'high',
      targetMetrics: { infrastructureQuality: 25, economicEfficiency: 15 }
    }
  },
  {
    id: 'education',
    name: 'Education Reform',
    description: 'Improve education quality and access',
    policyType: 'social',
    category: 'education',
    defaultSettings: {
      implementationCost: 8000000,
      maintenanceCost: 4000000,
      priority: 'high',
      targetMetrics: { literacyRate: 10, skillLevel: 20 }
    }
  },
  {
    id: 'trade',
    name: 'Trade Agreement Initiative',
    description: 'Negotiate favorable trade agreements with partner nations',
    policyType: 'diplomatic',
    category: 'trade',
    defaultSettings: {
      implementationCost: 2000000,
      maintenanceCost: 500000,
      priority: 'medium',
      targetMetrics: { tradeVolume: 20, diplomaticInfluence: 10 }
    }
  }
];

/**
 * Policy type configuration mapping
 *
 * Maps each policy type to its visual representation (icon, colors)
 * for consistent UI rendering across the application.
 */
export const POLICY_TYPE_CONFIG: Record<PolicyType, PolicyTypeConfig> = {
  economic: {
    icon: TrendingUp,
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-950/20'
  },
  social: {
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/20'
  },
  diplomatic: {
    icon: Globe,
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-950/20'
  },
  infrastructure: {
    icon: Briefcase,
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-950/20'
  },
  governance: {
    icon: Shield,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 dark:bg-indigo-950/20'
  }
};

/**
 * Get template by ID
 *
 * @param templateId - Unique template identifier
 * @returns Policy template or undefined if not found
 */
export function getTemplateById(templateId: string): PolicyTemplate | undefined {
  return POLICY_TEMPLATES.find(t => t.id === templateId);
}

/**
 * Get templates by policy type
 *
 * @param policyType - Policy type to filter by
 * @returns Array of matching templates
 */
export function getTemplatesByType(policyType: PolicyType): PolicyTemplate[] {
  return POLICY_TEMPLATES.filter(t => t.policyType === policyType);
}

/**
 * Get all available policy types
 *
 * @returns Array of all policy type strings
 */
export function getAllPolicyTypes(): PolicyType[] {
  return Object.keys(POLICY_TYPE_CONFIG) as PolicyType[];
}
