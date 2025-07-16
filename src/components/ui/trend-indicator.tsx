import React from "react";

interface TrendIndicatorProps {
  trend: 'up' | 'down' | 'stable';
  value?: number;
}

export function TrendIndicator({ trend, value }: TrendIndicatorProps) {
  const icons = {
    up: '📈',
    down: '📉',
    stable: '➡️'
  };
  const colors = {
    up: 'text-[var(--color-success)]',
    down: 'text-[var(--color-error)]',
    stable: 'text-[var(--color-text-muted)]'
  };
  return (
    <div className={`flex items-center gap-1 ${colors[trend]}`}>
      <span>{icons[trend]}</span>
      {typeof value === 'number' && (
        <span className="text-xs font-medium">
          {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}{Math.abs(value)}%
        </span>
      )}
    </div>
  );
} 