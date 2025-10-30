/**
 * Glass Tooltip Component
 *
 * Reusable tooltip component for Recharts with glass morphism styling.
 *
 * @module GlassTooltip
 */

import React from 'react';
import { motion } from 'framer-motion';

interface GlassTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  formatter?: (value: number) => string;
}

export const GlassTooltip = React.memo<GlassTooltipProps>(({ active, payload, label, formatter }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border border-gray-200/50 dark:border-gray-700/50 rounded-lg p-3 shadow-lg"
    >
      {label && (
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600 dark:text-gray-400">
              {entry.name}:
            </span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {formatter ? formatter(entry.value) : entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
});

GlassTooltip.displayName = 'GlassTooltip';
