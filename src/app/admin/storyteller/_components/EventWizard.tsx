"use client";
// src/app/admin/storyteller/_components/EventWizard.tsx
// 5-step wizard for creating world events

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import { Textarea } from "~/components/ui/textarea";
import { ScrollArea } from "~/components/ui/scroll-area";
import { CountrySelector } from "./CountrySelector";
import {
  StatDown as TrendingDown,
  Tournament as Swords,
  Wind,
  ScaleFrameEnlarge as Scale,
  Cpu,
  Heart,
  FireFlame as Flame,
  MagicWand as Wand2,
  NavArrowRight as ChevronRight,
  NavArrowLeft as ChevronLeft,
  SystemRestart as Loader2,
  CheckCircle as CheckCircle2,
  WarningTriangle as AlertTriangle,
  Globe,
  Sparks as Sparkles,
} from "iconoir-react";

// ── Event Types ──────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  {
    value: "economic_crisis",
    label: "Economic Crisis",
    icon: TrendingDown,
    color: "text-red-500",
    bg: "bg-red-500/10 border-red-500/20",
    description: "Recession, market crash, or financial meltdown",
  },
  {
    value: "trade_war",
    label: "Trade War",
    icon: Swords,
    color: "text-orange-500",
    bg: "bg-orange-500/10 border-orange-500/20",
    description: "Tariffs, sanctions, and trade restrictions",
  },
  {
    value: "natural_disaster",
    label: "Natural Disaster",
    icon: Wind,
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/20",
    description: "Earthquakes, hurricanes, floods, or wildfires",
  },
  {
    value: "political_upheaval",
    label: "Political Upheaval",
    icon: Scale,
    color: "text-purple-500",
    bg: "bg-purple-500/10 border-purple-500/20",
    description: "Revolution, coup, or major political shift",
  },
  {
    value: "tech_revolution",
    label: "Tech Revolution",
    icon: Cpu,
    color: "text-blue-500",
    bg: "bg-blue-500/10 border-blue-500/20",
    description: "Major technological breakthrough or disruption",
  },
  {
    value: "peace_era",
    label: "Peace & Prosperity",
    icon: Sparkles,
    color: "text-green-500",
    bg: "bg-green-500/10 border-green-500/20",
    description: "Conflict resolution and economic flourishing",
  },
  {
    value: "pandemic",
    label: "Pandemic",
    icon: Heart,
    color: "text-pink-500",
    bg: "bg-pink-500/10 border-pink-500/20",
    description: "Global health crisis with economic fallout",
  },
  {
    value: "climate_disaster",
    label: "Climate Emergency",
    icon: Flame,
    color: "text-orange-600",
    bg: "bg-orange-600/10 border-orange-600/20",
    description: "Severe environmental and climate impacts",
  },
  {
    value: "custom",
    label: "Custom Event",
    icon: Wand2,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10 border-indigo-500/20",
    description: "Define your own narrative event",
  },
] as const;

type EventTypeValue = (typeof EVENT_TYPES)[number]["value"];

// ── Wizard Steps ─────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Event Type", number: 1 },
  { label: "Scope & Countries", number: 2 },
  { label: "Parameters", number: 3 },
  { label: "Impact Preview", number: 4 },
  { label: "Confirm & Schedule", number: 5 },
] as const;

// ── Form State ───────────────────────────────────────────────────────────────

interface WizardFormState {
  type: EventTypeValue | "";
  name: string;
  description: string;
  scope: "global" | "targeted";
  affectedCountryIds: string[];
  severity: number;
  duration: number;
  delayDays: number;
}

const defaultForm: WizardFormState = {
  type: "",
  name: "",
  description: "",
  scope: "targeted",
  affectedCountryIds: [],
  severity: 0.5,
  duration: 2,
  delayDays: 0,
};

// ── Component ────────────────────────────────────────────────────────────────

interface EventWizardProps {
  onCreated?: () => void;
}

export function EventWizard({ onCreated }: EventWizardProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardFormState>(defaultForm);

  const utils = api.useUtils();

  const createEvent = api.admin.createWorldEvent.useMutation({
    onSuccess: () => {
      utils.admin.getWorldEvents.invalidate();
      utils.admin.getUpcomingEvents.invalidate();
      setForm(defaultForm);
      setStep(1);
      onCreated?.();
    },
  });

  // Simulation query (only runs when on step 4 with valid data)
  const simulation = api.admin.simulateWorldEvent.useQuery(
    {
      type: form.type || "custom",
      severity: form.severity,
      duration: form.duration,
      affectedCountryIds: form.affectedCountryIds,
    },
    {
      enabled: step === 4 && form.affectedCountryIds.length > 0,
      refetchOnWindowFocus: false,
    }
  );

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return form.type !== "";
      case 2:
        return form.scope === "global" || form.affectedCountryIds.length > 0;
      case 3:
        return form.name.trim().length > 0;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = () => {
    const startsAt = new Date(Date.now() + form.delayDays * 24 * 60 * 60 * 1000);
    createEvent.mutate({
      name: form.name,
      type: form.type || "custom",
      description: form.description || undefined,
      severity: form.severity,
      duration: form.duration,
      startsAt,
      affectedCountryIds: form.affectedCountryIds,
      generateEffects: true,
      parameters: {
        scope: form.scope,
        delayDays: form.delayDays,
      },
    });
  };

  const selectedType = EVENT_TYPES.find((t) => t.value === form.type);

  return (
    <div className="space-y-6">
      {/* Step Progress */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.number} className="flex items-center">
            <button
              onClick={() => s.number < step && setStep(s.number)}
              disabled={s.number > step}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                s.number === step
                  ? "bg-primary text-primary-foreground"
                  : s.number < step
                    ? "bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <span>{s.number}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`mx-1 h-px w-4 ${s.number < step ? "bg-primary/40" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {step === 1 && (
          <Step1EventType
            selected={form.type}
            onSelect={(type) => {
              setForm((f) => ({
                ...f,
                type,
                name: f.name || EVENT_TYPES.find((t) => t.value === type)?.label || "",
              }));
            }}
          />
        )}

        {step === 2 && (
          <Step2Scope
            scope={form.scope}
            selectedIds={form.affectedCountryIds}
            onScopeChange={(scope) => setForm((f) => ({ ...f, scope }))}
            onSelectionChange={(ids) => setForm((f) => ({ ...f, affectedCountryIds: ids }))}
          />
        )}

        {step === 3 && (
          <Step3Parameters
            form={form}
            onChange={(updates) => setForm((f) => ({ ...f, ...updates }))}
            selectedType={selectedType}
          />
        )}

        {step === 4 && (
          <Step4Preview form={form} simulation={simulation.data} isLoading={simulation.isLoading} />
        )}

        {step === 5 && (
          <Step5Confirm
            form={form}
            selectedType={selectedType}
            error={createEvent.error?.message}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="border-border/30 flex items-center justify-between border-t pt-4">
        <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 1}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        {step < 5 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={createEvent.isPending} className="bg-primary">
            {createEvent.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Create World Event
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Step Components ──────────────────────────────────────────────────────────

function Step1EventType({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (type: EventTypeValue) => void;
}) {
  return (
    <div>
      <h3 className="text-foreground mb-1 text-lg font-semibold">Choose Event Type</h3>
      <p className="text-muted-foreground mb-4 text-sm">
        Select the category of world event to create.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {EVENT_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = selected === type.value;
          return (
            <button
              key={type.value}
              onClick={() => onSelect(type.value)}
              className={`rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? `${type.bg} border-2 shadow-sm`
                  : "border-border/50 hover:border-border hover:bg-muted/20"
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className={`h-5 w-5 ${type.color}`} />
                <span className="text-foreground text-sm font-medium">{type.label}</span>
              </div>
              <p className="text-muted-foreground text-xs">{type.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step2Scope({
  scope,
  selectedIds,
  onScopeChange,
  onSelectionChange,
}: {
  scope: "global" | "targeted";
  selectedIds: string[];
  onScopeChange: (scope: "global" | "targeted") => void;
  onSelectionChange: (ids: string[]) => void;
}) {
  return (
    <div>
      <h3 className="text-foreground mb-1 text-lg font-semibold">Scope & Countries</h3>
      <p className="text-muted-foreground mb-4 text-sm">
        Choose whether this event affects all countries or specific targets.
      </p>

      <div className="mb-4 flex gap-2">
        <Button
          variant={scope === "global" ? "default" : "outline"}
          size="sm"
          onClick={() => onScopeChange("global")}
        >
          <Globe className="mr-1 h-4 w-4" />
          Global (All Countries)
        </Button>
        <Button
          variant={scope === "targeted" ? "default" : "outline"}
          size="sm"
          onClick={() => onScopeChange("targeted")}
        >
          <Swords className="mr-1 h-4 w-4" />
          Targeted Countries
        </Button>
      </div>

      {scope === "targeted" ? (
        <CountrySelector selectedIds={selectedIds} onSelectionChange={onSelectionChange} />
      ) : (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-6 text-center">
          <Globe className="mx-auto mb-2 h-8 w-8 text-blue-500" />
          <p className="text-foreground font-medium">Global Event</p>
          <p className="text-muted-foreground text-sm">
            All countries will be affected. Countries will be automatically selected when the event
            is created.
          </p>
        </div>
      )}
    </div>
  );
}

function Step3Parameters({
  form,
  onChange,
  selectedType,
}: {
  form: WizardFormState;
  onChange: (updates: Partial<WizardFormState>) => void;
  selectedType: (typeof EVENT_TYPES)[number] | undefined;
}) {
  const Icon = selectedType?.icon ?? Wand2;

  return (
    <div>
      <h3 className="text-foreground mb-1 text-lg font-semibold">Event Parameters</h3>
      <p className="text-muted-foreground mb-4 text-sm">
        Configure the details and severity of this event.
      </p>

      <div className="space-y-5">
        {/* Event Name */}
        <div>
          <Label>Event Name</Label>
          <div className="relative mt-1">
            <Icon
              className={`absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 ${selectedType?.color ?? "text-muted-foreground"}`}
            />
            <Input
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g., Southeast Asian Trade Collapse"
              className="pl-10"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <Label>Narrative Description (optional)</Label>
          <Textarea
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Describe the world event narrative..."
            rows={3}
            className="mt-1"
          />
        </div>

        {/* Severity */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Severity</Label>
            <Badge
              variant="outline"
              className={
                form.severity >= 0.8
                  ? "border-red-500/30 text-red-600"
                  : form.severity >= 0.5
                    ? "border-amber-500/30 text-amber-600"
                    : "border-green-500/30 text-green-600"
              }
            >
              {form.severity >= 0.8 ? "Critical" : form.severity >= 0.5 ? "Moderate" : "Minor"} (
              {(form.severity * 100).toFixed(0)}%)
            </Badge>
          </div>
          <Slider
            value={[form.severity]}
            onValueChange={([v]) => onChange({ severity: v })}
            min={0.05}
            max={1}
            step={0.05}
          />
          <div className="text-muted-foreground mt-1 flex justify-between text-xs">
            <span>Minor</span>
            <span>Moderate</span>
            <span>Critical</span>
          </div>
        </div>

        {/* Duration */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Duration (IxTime years)</Label>
            <span className="text-foreground text-sm font-medium">
              {form.duration} year{form.duration !== 1 ? "s" : ""}
            </span>
          </div>
          <Slider
            value={[form.duration]}
            onValueChange={([v]) => onChange({ duration: v })}
            min={0.5}
            max={10}
            step={0.5}
          />
        </div>

        {/* Delay */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Delay Start (days from now)</Label>
            <span className="text-foreground text-sm font-medium">
              {form.delayDays === 0
                ? "Immediate"
                : `${form.delayDays} day${form.delayDays !== 1 ? "s" : ""}`}
            </span>
          </div>
          <Slider
            value={[form.delayDays]}
            onValueChange={([v]) => onChange({ delayDays: v })}
            min={0}
            max={30}
            step={1}
          />
        </div>
      </div>
    </div>
  );
}

function Step4Preview({
  form,
  simulation,
  isLoading,
}: {
  form: WizardFormState;
  simulation:
    | {
        projectedImpacts: Array<{
          countryId: string;
          countryName: string;
          countryFlag: string | null;
          economicTier: string;
          current: { gdp: number; population: number; growthRate: number | null };
          projected: { gdpChange: number; populationChange: number; stabilityChange: number };
        }>;
        summary: {
          totalCountriesAffected: number;
          avgGdpChange: number;
          totalGdpAtRisk: number;
        };
      }
    | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <p className="text-muted-foreground mt-3 text-sm">Simulating impact...</p>
      </div>
    );
  }

  if (!simulation) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-muted-foreground mt-3 text-sm">
          {form.affectedCountryIds.length === 0
            ? "No countries selected. Go back and select countries."
            : "Unable to generate simulation."}
        </p>
      </div>
    );
  }

  const fmtBig = (n: number) => {
    if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  return (
    <div>
      <h3 className="text-foreground mb-1 text-lg font-semibold">Impact Preview</h3>
      <p className="text-muted-foreground mb-4 text-sm">
        Projected impact based on event severity and affected economies.
      </p>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="border-border/50 rounded-lg border p-3 text-center">
          <div className="text-muted-foreground text-xs">Countries</div>
          <div className="text-foreground text-lg font-bold">
            {simulation.summary.totalCountriesAffected}
          </div>
        </div>
        <div className="border-border/50 rounded-lg border p-3 text-center">
          <div className="text-muted-foreground text-xs">Avg GDP Change</div>
          <div
            className={`text-lg font-bold ${
              simulation.summary.avgGdpChange < 0 ? "text-red-500" : "text-green-500"
            }`}
          >
            {simulation.summary.avgGdpChange >= 0 ? "+" : ""}
            {(simulation.summary.avgGdpChange * 100).toFixed(1)}%
          </div>
        </div>
        <div className="border-border/50 rounded-lg border p-3 text-center">
          <div className="text-muted-foreground text-xs">GDP at Risk</div>
          <div className="text-foreground text-lg font-bold">
            {fmtBig(simulation.summary.totalGdpAtRisk)}
          </div>
        </div>
      </div>

      {/* Country breakdown */}
      <ScrollArea className="border-border/50 h-[260px] rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border/50 bg-muted/30 border-b">
              <th className="px-3 py-2 text-left font-medium">Country</th>
              <th className="px-3 py-2 text-left font-medium">Tier</th>
              <th className="px-3 py-2 text-right font-medium">GDP Change</th>
              <th className="px-3 py-2 text-right font-medium">Pop Change</th>
              <th className="px-3 py-2 text-right font-medium">Stability</th>
            </tr>
          </thead>
          <tbody>
            {simulation.projectedImpacts.map((p) => (
              <tr key={p.countryId} className="border-border/20 border-b">
                <td className="px-3 py-2 font-medium">{p.countryName}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="text-xs">
                    {p.economicTier}
                  </Badge>
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono text-xs ${p.projected.gdpChange < 0 ? "text-red-500" : "text-green-500"}`}
                >
                  {p.projected.gdpChange >= 0 ? "+" : ""}
                  {(p.projected.gdpChange * 100).toFixed(1)}%
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono text-xs ${p.projected.populationChange < 0 ? "text-red-500" : "text-green-500"}`}
                >
                  {p.projected.populationChange >= 0 ? "+" : ""}
                  {(p.projected.populationChange * 100).toFixed(2)}%
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono text-xs ${p.projected.stabilityChange < 0 ? "text-red-500" : "text-green-500"}`}
                >
                  {p.projected.stabilityChange >= 0 ? "+" : ""}
                  {p.projected.stabilityChange.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}

function Step5Confirm({
  form,
  selectedType,
  error,
}: {
  form: WizardFormState;
  selectedType: (typeof EVENT_TYPES)[number] | undefined;
  error?: string;
}) {
  const Icon = selectedType?.icon ?? Wand2;

  return (
    <div>
      <h3 className="text-foreground mb-1 text-lg font-semibold">Confirm & Schedule</h3>
      <p className="text-muted-foreground mb-4 text-sm">
        Review all details before creating this world event.
      </p>

      <div className="space-y-4">
        <div className={`rounded-xl border p-4 ${selectedType?.bg ?? "border-border/50"}`}>
          <div className="flex items-center gap-3">
            <Icon className={`h-6 w-6 ${selectedType?.color ?? "text-muted-foreground"}`} />
            <div>
              <h4 className="text-foreground text-lg font-bold">{form.name || "Unnamed Event"}</h4>
              <p className="text-muted-foreground text-sm">{selectedType?.label ?? form.type}</p>
            </div>
          </div>
          {form.description && (
            <p className="text-muted-foreground mt-2 text-sm">{form.description}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <SummaryItem label="Severity" value={`${(form.severity * 100).toFixed(0)}%`} />
          <SummaryItem
            label="Duration"
            value={`${form.duration} year${form.duration !== 1 ? "s" : ""}`}
          />
          <SummaryItem label="Scope" value={form.scope === "global" ? "Global" : "Targeted"} />
          <SummaryItem label="Countries" value={`${form.affectedCountryIds.length}`} />
          <SummaryItem
            label="Start"
            value={form.delayDays === 0 ? "Immediate" : `${form.delayDays} day delay`}
          />
          <SummaryItem label="Effects" value="Auto-generated" />
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Error: {error}</span>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
            <p className="text-muted-foreground text-xs">
              This will create storyteller effects for {form.affectedCountryIds.length} countries
              and immediately affect their economic calculations. This action can be reversed by
              deactivating the event.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/30 rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-foreground text-sm font-medium">{value}</div>
    </div>
  );
}
