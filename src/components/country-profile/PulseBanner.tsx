import { Activity } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard } from "~/components/ui/facet-container";
import { Stat } from "~/components/ui/stat";
import { cn } from "~/lib/utils/cn";
import type { ProfileVitals } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { formatPercent, formatRate } from "~/app/countries/[slug]/_utils/profileLayer";
import { pulseStatus, type PulseTone } from "./derive";

const DOT: Record<PulseTone, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  neutral: "bg-label-tertiary",
};

/**
 * PulseBanner — the national pulse (the Sovereign Command OS banner) on real readings: a status
 * derived from GDP growth, population growth and stability (`pulseStatus`), one factual
 * sentence, and the telemetry behind it. Renders nothing without a GDP growth reading.
 */
export function PulseBanner({
  name,
  vitals,
  className,
}: {
  name: string;
  vitals: ProfileVitals;
  className?: string;
}) {
  const status = pulseStatus(vitals);
  if (!status) return null;

  const telemetry: { key: string; label: string; value: string }[] = [];
  if (vitals.gdpGrowth != null)
    telemetry.push({ key: "gdp", label: "Real GDP", value: formatRate(vitals.gdpGrowth) });
  if (vitals.populationGrowth != null)
    telemetry.push({
      key: "population",
      label: "Population",
      value: formatRate(vitals.populationGrowth),
    });
  if (vitals.stabilityScore != null)
    telemetry.push({
      key: "stability",
      label: "Stability",
      value: `${Math.round(vitals.stabilityScore)}/100`,
    });
  if (vitals.publicApproval != null)
    telemetry.push({
      key: "approval",
      label: "Approval",
      value: formatPercent(vitals.publicApproval, 0),
    });

  return (
    // Concept banner: glass with the ambient tint glow bleeding off the top-right corner.
    <FacetCard
      role="region"
      variant="glass"
      glow
      padding="md"
      aria-label={`National pulse: ${status.label}`}
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className="bg-surface text-tint border-separator rounded-control shadow-card relative flex size-10 shrink-0 items-center justify-center border"
        >
          <Activity className="size-5" />
          <span
            className={cn(
              "ring-surface absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2",
              DOT[status.tone]
            )}
          />
        </span>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>National pulse</Eyebrow>
            <Badge variant={status.tone}>{status.label}</Badge>
          </div>
          <p className="text-body text-label text-pretty">
            {name}: {status.summary}
          </p>
        </div>
      </div>
      {telemetry.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-3 lg:shrink-0 lg:justify-end">
          {telemetry.map((t) => (
            <div key={t.key}>
              <dt className="sr-only">{t.label}</dt>
              <dd>
                <Stat size="sm" label={t.label} value={t.value} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </FacetCard>
  );
}
