"use client";
// src/app/admin/storyteller/_components/EventWizard.tsx
// 5-step wizard for creating world events

import { useState } from "react";
import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils/format-utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import { Textarea } from "~/components/ui/textarea";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { StepIndicator } from "~/components/ui/step-indicator";
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

// ── Event Types ──────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  {
    value: "economic_crisis",
    label: "Economic crisis",
    icon: TrendingDown,
    color: "text-red",
    bg: "bg-red/10 border-red/20",
    description: "Recession, market crash, or financial meltdown",
  },
  {
    value: "trade_war",
    label: "Trade war",
    icon: Swords,
    color: "text-orange",
    bg: "bg-orange/10 border-orange/20",
    description: "Tariffs, sanctions, and trade restrictions",
  },
  {
    value: "natural_disaster",
    label: "Natural disaster",
    icon: Wind,
    color: "text-yellow",
    bg: "bg-yellow/10 border-yellow/20",
    description: "Earthquakes, hurricanes, floods, or wildfires",
  },
  {
    value: "political_upheaval",
    label: "Political upheaval",
    icon: Scale,
    color: "text-purple",
    bg: "bg-purple/10 border-purple/20",
    description: "Revolution, coup, or major political shift",
  },
  {
    value: "tech_revolution",
    label: "Tech revolution",
    icon: Cpu,
    color: "text-blue",
    bg: "bg-blue/10 border-blue/20",
    description: "Major technological breakthrough or disruption",
  },
  {
    value: "peace_era",
    label: "Peace & prosperity",
    icon: Sparkles,
    color: "text-green",
    bg: "bg-green/10 border-green/20",
    description: "Conflict resolution and economic flourishing",
  },
  {
    value: "pandemic",
    label: "Pandemic",
    icon: Heart,
    color: "text-pink",
    bg: "bg-pink/10 border-pink/20",
    description: "Global health crisis with economic fallout",
  },
  {
    value: "climate_disaster",
    label: "Climate emergency",
    icon: Flame,
    color: "text-orange",
    bg: "bg-orange/10 border-orange/20",
    description: "Severe environmental and climate impacts",
  },
  {
    value: "custom",
    label: "Custom event",
    icon: Wand2,
    color: "text-indigo",
    bg: "bg-indigo/10 border-indigo/20",
    description: "Define your own narrative event",
  },
] as const;

type EventTypeValue = (typeof EVENT_TYPES)[number]["value"];

// ── Wizard Steps ─────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Event type", number: 1 },
  { label: "Scope & countries", number: 2 },
  { label: "Parameters", number: 3 },
  { label: "Impact preview", number: 4 },
  { label: "Confirm & schedule", number: 5 },
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
      <StepIndicator
        aria-label="Event wizard progress"
        steps={STEPS.map((st) => ({ id: String(st.number), label: st.label }))}
        current={step - 1}
        onStepClick={(index) => setStep(index + 1)}
      />

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
      <div className="border-separator flex items-center justify-between border-t pt-4">
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
          <Button onClick={handleSubmit} disabled={createEvent.isPending}>
            {createEvent.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Create world event
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
      <h3 className="text-label text-title-3 mb-1">Choose event type</h3>
      <p className="text-label-secondary text-body mb-4">
        Select the category of world event to create.
      </p>
      <RadioCardGroup
        aria-label="Event type"
        value={selected || null}
        onValueChange={(value) => onSelect(value as EventTypeValue)}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
      >
        {EVENT_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <RadioCard
              key={type.value}
              value={type.value}
              icon={<Icon className={type.color} />}
              title={type.label}
              description={type.description}
            />
          );
        })}
      </RadioCardGroup>
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
      <h3 className="text-label text-title-3 mb-1">Scope & countries</h3>
      <p className="text-label-secondary text-body mb-4">
        Choose whether this event affects all countries or specific targets.
      </p>

      <SegmentedControl
        aria-label="Event scope"
        className="mb-4"
        value={scope}
        onValueChange={onScopeChange}
        options={[
          { value: "global", label: "Global (All Countries)", icon: <Globe aria-hidden /> },
          { value: "targeted", label: "Targeted countries", icon: <Swords aria-hidden /> },
        ]}
      />

      {scope === "targeted" ? (
        <CountrySelector selectedIds={selectedIds} onSelectionChange={onSelectionChange} />
      ) : (
        <div className="rounded-row border-blue/20 bg-blue/5 border p-6 text-center">
          <Globe className="text-blue mx-auto mb-2 h-8 w-8" />
          <p className="text-label font-medium">Global event</p>
          <p className="text-label-secondary text-body">
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
      <h3 className="text-label text-title-3 mb-1">Event parameters</h3>
      <p className="text-label-secondary text-body mb-4">
        Configure the details and severity of this event.
      </p>

      <div className="space-y-5">
        {/* Event Name */}
        <div>
          <Label>Event name</Label>
          <div className="relative mt-1">
            <Icon
              className={`absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 ${selectedType?.color ?? "text-label-secondary"}`}
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
                  ? "border-red/30 text-red"
                  : form.severity >= 0.5
                    ? "border-yellow/30 text-yellow"
                    : "border-green/30 text-green"
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
          <div className="text-label-secondary text-footnote mt-1 flex justify-between">
            <span>Minor</span>
            <span>Moderate</span>
            <span>Critical</span>
          </div>
        </div>

        {/* Duration */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Duration (IxTime years)</Label>
            <span className="text-label text-body font-medium">
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
            <span className="text-label text-body font-medium">
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
        <Loader2 className="text-tint h-8 w-8 animate-spin" />
        <p className="text-label-secondary text-body mt-3">Simulating impact...</p>
      </div>
    );
  }

  if (!simulation) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="text-yellow h-8 w-8" />
        <p className="text-label-secondary text-body mt-3">
          {form.affectedCountryIds.length === 0
            ? "No countries selected. Go back and select countries."
            : "Unable to generate simulation."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-label text-title-3 mb-1">Impact preview</h3>
      <p className="text-label-secondary text-body mb-4">
        Projected impact based on event severity and affected economies.
      </p>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="border-separator rounded-control border p-3 text-center">
          <div className="text-label-secondary text-footnote">Countries</div>
          <div className="text-label text-title-3">{simulation.summary.totalCountriesAffected}</div>
        </div>
        <div className="border-separator rounded-control border p-3 text-center">
          <div className="text-label-secondary text-footnote">Avg GDP Change</div>
          <div
            className={`text-title-3 ${
              simulation.summary.avgGdpChange < 0 ? "text-red" : "text-green"
            }`}
          >
            {simulation.summary.avgGdpChange >= 0 ? "+" : ""}
            {(simulation.summary.avgGdpChange * 100).toFixed(1)}%
          </div>
        </div>
        <div className="border-separator rounded-control border p-3 text-center">
          <div className="text-label-secondary text-footnote">GDP at Risk</div>
          <div className="text-label text-title-3">
            {formatCurrency(simulation.summary.totalGdpAtRisk)}
          </div>
        </div>
      </div>

      {/* Country breakdown */}
      <Table containerClassName="h-[260px]">
        <TableHeader sticky>
          <TableRow>
            <TableHead className="px-3">Country</TableHead>
            <TableHead className="px-3">Tier</TableHead>
            <TableHead className="px-3 text-right">GDP Change</TableHead>
            <TableHead className="px-3 text-right">Pop change</TableHead>
            <TableHead className="px-3 text-right">Stability</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {simulation.projectedImpacts.map((p) => (
            <TableRow key={p.countryId}>
              <TableCell className="px-3 font-medium">{p.countryName}</TableCell>
              <TableCell className="px-3">
                <Badge variant="outline">{p.economicTier}</Badge>
              </TableCell>
              <TableCell
                className={`text-footnote px-3 py-2 text-right tabular-nums ${p.projected.gdpChange < 0 ? "text-red" : "text-green"}`}
              >
                {p.projected.gdpChange >= 0 ? "+" : ""}
                {(p.projected.gdpChange * 100).toFixed(1)}%
              </TableCell>
              <TableCell
                className={`text-footnote px-3 py-2 text-right tabular-nums ${p.projected.populationChange < 0 ? "text-red" : "text-green"}`}
              >
                {p.projected.populationChange >= 0 ? "+" : ""}
                {(p.projected.populationChange * 100).toFixed(2)}%
              </TableCell>
              <TableCell
                className={`text-footnote px-3 py-2 text-right tabular-nums ${p.projected.stabilityChange < 0 ? "text-red" : "text-green"}`}
              >
                {p.projected.stabilityChange >= 0 ? "+" : ""}
                {p.projected.stabilityChange.toFixed(0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
      <h3 className="text-label text-title-3 mb-1">Confirm & schedule</h3>
      <p className="text-label-secondary text-body mb-4">
        Review all details before creating this world event.
      </p>

      <div className="space-y-4">
        <div className={`rounded-row border p-4 ${selectedType?.bg ?? "border-separator"}`}>
          <div className="flex items-center gap-3">
            <Icon className={`h-6 w-6 ${selectedType?.color ?? "text-label-secondary"}`} />
            <div>
              <h4 className="text-label text-title-3">{form.name || "Unnamed Event"}</h4>
              <p className="text-label-secondary text-body">{selectedType?.label ?? form.type}</p>
            </div>
          </div>
          {form.description && (
            <p className="text-label-secondary text-body mt-2">{form.description}</p>
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
          <div className="rounded-control border-red/30 bg-red/10 border p-3">
            <div className="text-red flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-body font-medium">Error: {error}</span>
            </div>
          </div>
        )}

        <div className="rounded-control border-yellow/20 bg-yellow/5 border p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-yellow mt-0.5 h-4 w-4" />
            <p className="text-label-secondary text-footnote">
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
    <div className="border-separator rounded-control border p-3">
      <div className="text-label-secondary text-footnote">{label}</div>
      <div className="text-label text-body font-medium">{value}</div>
    </div>
  );
}
