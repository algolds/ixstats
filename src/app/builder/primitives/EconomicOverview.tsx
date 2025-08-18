interface EconomicOverviewProps {
  metrics: Array<{
    label: string;
    value: string | React.ReactNode;
  }>;
}

export function EconomicOverview({ metrics }: EconomicOverviewProps) {
  return (
    <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 mb-6 border border-[var(--color-border-primary)]">
      <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
        Country Economic Overview
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <span className="text-[var(--color-text-muted)]">{metric.label}:</span>
            <div className="font-semibold text-[var(--color-text-primary)]">
              {metric.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}