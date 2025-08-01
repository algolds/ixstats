"use client";

import React from 'react';

// Content hierarchy definition for MyCountry system
// This establishes clear purpose, priority, and relationships between different content areas

export interface ContentSection {
  id: string;
  title: string;
  purpose: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  audience: 'public' | 'executive' | 'both';
  dataType: 'static' | 'dynamic' | 'real-time';
  updateFrequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  dependencies: string[];
  children?: ContentSection[];
}

// Unified content hierarchy for MyCountry system
export const CONTENT_HIERARCHY: ContentSection[] = [
  {
    id: 'national-identity',
    title: 'National Identity & Profile',
    purpose: 'Core country identification, flag, and basic demographics that establish national presence',
    priority: 'critical',
    audience: 'both',
    dataType: 'static',
    updateFrequency: 'weekly',
    dependencies: [],
    children: [
      {
        id: 'basic-info',
        title: 'Basic Information',
        purpose: 'Name, flag, government type, capital - fundamental identifiers',
        priority: 'critical',
        audience: 'both',
        dataType: 'static',
        updateFrequency: 'weekly',
        dependencies: [],
      },
      {
        id: 'geographic-data',
        title: 'Geographic Data',
        purpose: 'Land area, location, regional classification for spatial context',
        priority: 'high',
        audience: 'both',
        dataType: 'static',
        updateFrequency: 'weekly',
        dependencies: [],
      }
    ]
  },
  
  {
    id: 'vital-statistics',
    title: 'Vital National Statistics',
    purpose: 'Core performance metrics that define current national status and health',
    priority: 'critical',
    audience: 'both',
    dataType: 'real-time',
    updateFrequency: 'immediate',
    dependencies: ['national-identity'],
    children: [
      {
        id: 'population-metrics',
        title: 'Population Metrics',
        purpose: 'Current population, growth rate, demographic trends for social planning',
        priority: 'critical',
        audience: 'both',
        dataType: 'real-time',
        updateFrequency: 'immediate',
        dependencies: [],
      },
      {
        id: 'economic-metrics',
        title: 'Economic Performance',
        purpose: 'GDP, per capita wealth, economic tier, growth rates for financial assessment',
        priority: 'critical',
        audience: 'both',
        dataType: 'real-time',
        updateFrequency: 'immediate',
        dependencies: [],
      },
      {
        id: 'vitality-scores',
        title: 'National Vitality Assessment',
        purpose: 'Composite health scores across economic, social, diplomatic, and governance dimensions',
        priority: 'high',
        audience: 'both',
        dataType: 'real-time',
        updateFrequency: 'immediate',
        dependencies: ['population-metrics', 'economic-metrics'],
      }
    ]
  },
  
  {
    id: 'strategic-command',
    title: 'Executive Strategic Command',
    purpose: 'Private executive tools for national leadership and strategic decision-making',
    priority: 'critical',
    audience: 'executive',
    dataType: 'dynamic',
    updateFrequency: 'immediate',
    dependencies: ['vital-statistics'],
    children: [
      {
        id: 'intelligence-feed',
        title: 'Intelligence & Alerts',
        purpose: 'Real-time strategic intelligence, threats, opportunities, and actionable insights',
        priority: 'critical',
        audience: 'executive',
        dataType: 'real-time',
        updateFrequency: 'immediate',
        dependencies: ['vital-statistics'],
      },
      {
        id: 'quick-actions',
        title: 'Executive Actions',
        purpose: 'Direct policy controls, emergency responses, and strategic interventions',
        priority: 'critical',
        audience: 'executive',
        dataType: 'dynamic',
        updateFrequency: 'immediate',
        dependencies: ['intelligence-feed'],
      },
      {
        id: 'focus-areas',
        title: 'Strategic Focus Areas',
        purpose: 'Current national priorities, ongoing initiatives, and resource allocation',
        priority: 'high',
        audience: 'executive',
        dataType: 'dynamic',
        updateFrequency: 'daily',
        dependencies: ['vital-statistics'],
      }
    ]
  },
  
  {
    id: 'public-portfolio',
    title: 'Public National Portfolio',
    purpose: 'Public-facing achievements, rankings, and national story for international presence',
    priority: 'high',
    audience: 'public',
    dataType: 'dynamic',
    updateFrequency: 'daily',
    dependencies: ['vital-statistics'],
    children: [
      {
        id: 'achievements',
        title: 'National Achievements',
        purpose: 'Major accomplishments, milestones, and recognition earned through national development',
        priority: 'high',
        audience: 'public',
        dataType: 'dynamic',
        updateFrequency: 'daily',
        dependencies: ['vital-statistics'],
      },
      {
        id: 'rankings',
        title: 'International Rankings',
        purpose: 'Comparative global standing, regional position, and tier-based performance metrics',
        priority: 'high',
        audience: 'public',
        dataType: 'dynamic',
        updateFrequency: 'daily',
        dependencies: ['vital-statistics'],
      },
      {
        id: 'timeline',
        title: 'Development Timeline',
        purpose: 'Historical progression, major milestones, and national development narrative',
        priority: 'medium',
        audience: 'public',
        dataType: 'dynamic',
        updateFrequency: 'weekly',
        dependencies: ['achievements'],
      }
    ]
  },
  
  {
    id: 'analytics-insights',
    title: 'Analytics & Performance Insights',
    purpose: 'Deep analytical data, trends, and comparative intelligence for informed decision-making',
    priority: 'medium',
    audience: 'both',
    dataType: 'dynamic',
    updateFrequency: 'hourly',
    dependencies: ['vital-statistics'],
    children: [
      {
        id: 'performance-kpis',
        title: 'Key Performance Indicators',
        purpose: 'Critical metrics dashboard with growth trends, efficiency measures, and alerts',
        priority: 'high',
        audience: 'both',
        dataType: 'real-time',
        updateFrequency: 'immediate',
        dependencies: ['vital-statistics'],
      },
      {
        id: 'comparative-analysis',
        title: 'Comparative Intelligence',
        purpose: 'Benchmarking against peers, regional comparisons, and competitive positioning',
        priority: 'medium',
        audience: 'executive',
        dataType: 'dynamic',
        updateFrequency: 'hourly',
        dependencies: ['vital-statistics'],
      },
      {
        id: 'predictive-modeling',
        title: 'Predictive Analytics',
        purpose: 'Trend forecasting, scenario modeling, and strategic planning intelligence',
        priority: 'medium',
        audience: 'executive',
        dataType: 'dynamic',
        updateFrequency: 'daily',
        dependencies: ['performance-kpis', 'comparative-analysis'],
      }
    ]
  },
  
  {
    id: 'system-integration',
    title: 'System Integration & Technical',
    purpose: 'Technical infrastructure, system status, and integration with broader IxStats ecosystem',
    priority: 'low',
    audience: 'both',
    dataType: 'dynamic',
    updateFrequency: 'immediate',
    dependencies: [],
    children: [
      {
        id: 'ixtime-integration',
        title: 'IxTime Temporal System',
        purpose: 'Time acceleration status, temporal progression, and system synchronization',
        priority: 'medium',
        audience: 'both',
        dataType: 'real-time',
        updateFrequency: 'immediate',
        dependencies: [],
      },
      {
        id: 'data-freshness',
        title: 'Data Status & Freshness',
        purpose: 'Last update timestamps, data quality indicators, and system health metrics',
        priority: 'low',
        audience: 'both',
        dataType: 'real-time',
        updateFrequency: 'immediate',
        dependencies: [],
      },
      {
        id: 'external-resources',
        title: 'External Resources & Links',
        purpose: 'Connections to related systems, external dashboards, and supplementary tools',
        priority: 'low',
        audience: 'both',
        dataType: 'static',
        updateFrequency: 'weekly',
        dependencies: [],
      }
    ]
  }
];

// Content priority mapping for layout decisions
export const CONTENT_PRIORITIES = {
  critical: {
    order: 1,
    defaultExpanded: true,
    displayStyle: 'prominent',
    colorTheme: 'primary',
  },
  high: {
    order: 2,
    defaultExpanded: true,
    displayStyle: 'normal',
    colorTheme: 'secondary',
  },
  medium: {
    order: 3,
    defaultExpanded: false,
    displayStyle: 'compact',
    colorTheme: 'muted',
  },
  low: {
    order: 4,
    defaultExpanded: false,
    displayStyle: 'minimal',
    colorTheme: 'subtle',
  },
} as const;

// Audience-specific layout configurations
export const AUDIENCE_LAYOUTS = {
  public: {
    focus: ['national-identity', 'vital-statistics', 'public-portfolio', 'analytics-insights'],
    hidden: ['strategic-command'],
    defaultView: 'showcase',
  },
  executive: {
    focus: ['strategic-command', 'vital-statistics', 'analytics-insights', 'national-identity'],
    hidden: [],
    defaultView: 'command',
  },
} as const;

// Content relationship mapping for contextual navigation
export const CONTENT_RELATIONSHIPS = {
  // What content should be highlighted when viewing each section
  'national-identity': ['vital-statistics', 'public-portfolio'],
  'vital-statistics': ['analytics-insights', 'strategic-command'],
  'strategic-command': ['intelligence-feed', 'quick-actions', 'focus-areas'],
  'public-portfolio': ['achievements', 'rankings', 'timeline'],
  'analytics-insights': ['performance-kpis', 'comparative-analysis'],
  'system-integration': ['ixtime-integration', 'data-freshness'],
} as const;

// Helper functions for content hierarchy management
export function getContentByAudience(audience: 'public' | 'executive' | 'both') {
  return CONTENT_HIERARCHY.filter(section => 
    section.audience === audience || section.audience === 'both'
  );
}

export function getContentByPriority(priority: ContentSection['priority']) {
  return CONTENT_HIERARCHY.filter(section => section.priority === priority);
}

export function getSectionById(id: string): ContentSection | undefined {
  function findSection(sections: ContentSection[]): ContentSection | undefined {
    for (const section of sections) {
      if (section.id === id) return section;
      if (section.children) {
        const found = findSection(section.children);
        if (found) return found;
      }
    }
    return undefined;
  }
  return findSection(CONTENT_HIERARCHY);
}

export function getRelatedContent(sectionId: string): ContentSection[] {
  const relationships = CONTENT_RELATIONSHIPS[sectionId as keyof typeof CONTENT_RELATIONSHIPS] || [];
  return relationships.map(id => getSectionById(id)).filter(Boolean) as ContentSection[];
}

export function shouldDisplaySection(
  section: ContentSection, 
  audience: 'public' | 'executive',
  currentMode: 'public' | 'executive'
): boolean {
  // Always show content for current audience or both
  if (section.audience === audience || section.audience === 'both') return true;
  
  // In executive mode, show executive-only content
  if (currentMode === 'executive' && section.audience === 'executive') return true;
  
  return false;
}

export function getDisplayOrder(sections: ContentSection[]): ContentSection[] {
  return [...sections].sort((a, b) => {
    const priorityA = CONTENT_PRIORITIES[a.priority].order;
    const priorityB = CONTENT_PRIORITIES[b.priority].order;
    return priorityA - priorityB;
  });
}

export default {
  CONTENT_HIERARCHY,
  CONTENT_PRIORITIES,
  AUDIENCE_LAYOUTS,
  CONTENT_RELATIONSHIPS,
  getContentByAudience,
  getContentByPriority,
  getSectionById,
  getRelatedContent,
  shouldDisplaySection,
  getDisplayOrder,
};