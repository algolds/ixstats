// Utility functions for Intelligence Briefing components
// Extracted from EnhancedIntelligenceBriefing.tsx

import React from "react";
import {
  RiArrowUpLine,
  RiArrowDownLine,
  RiSubtractLine
} from "react-icons/ri";
import type { TrendDirection, StatusLevel, ClearanceLevel } from './types';

export const getTrendIcon = (trend: TrendDirection) => {
  switch (trend) {
    case 'up': return RiArrowUpLine;
    case 'down': return RiArrowDownLine;
    default: return RiSubtractLine;
  }
};

export const getTrendColor = (trend: TrendDirection) => {
  switch (trend) {
    case 'up': return 'text-green-400';
    case 'down': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

export const getStatusFromValue = (value: number): StatusLevel => {
  if (value >= 80) return 'excellent';
  if (value >= 60) return 'good';
  if (value >= 40) return 'fair';
  return 'poor';
};

export const hasAccess = (
  viewerClearance: ClearanceLevel,
  classification: ClearanceLevel
): boolean => {
  const levels = { 'PUBLIC': 1, 'RESTRICTED': 2, 'CONFIDENTIAL': 3 };
  return levels[viewerClearance] >= levels[classification];
};

// Wiki content parsing utilities
export const parseWikiContent = (
  content: string,
  linkHandler: (link: string) => void
): string => {
  if (!content) return '';

  // Replace wiki links [[Link|Display]] or [[Link]]
  let parsed = content.replace(/\[\[([^|\]]+)(\|([^\]]+))?\]\]/g, (match, link, pipe, display) => {
    const displayText = display || link;
    return `<span class="text-blue-400 hover:text-blue-300 cursor-pointer underline" data-link="${link}">${displayText}</span>`;
  });

  // Replace external links [http://example.com Display]
  parsed = parsed.replace(/\[([^\s]+)\s+([^\]]+)\]/g, (match, url, display) => {
    return `<a href="${url}" target="_blank" class="text-blue-400 hover:text-blue-300 underline">${display}</a>`;
  });

  // Parse wiki markup for bold and italics
  parsed = parsed.replace(/'''([^']+)'''/g, '<strong class="font-bold">$1</strong>');
  parsed = parsed.replace(/''([^']+)''/g, '<em class="italic">$1</em>');

  // Add basic line breaks
  parsed = parsed.replace(/\n\n/g, '<br/><br/>');
  parsed = parsed.replace(/\n/g, ' ');

  return parsed;
};
