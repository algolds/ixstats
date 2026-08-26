"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Page as FileText, Settings as Settings2, NavArrowDown as ChevronDown, NavArrowRight as ChevronRight, ControlSlider as Sliders, Xmark as X, WarningTriangle as AlertTriangle } from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { PREDEFINED_DECRETALS } from "~/lib/policies/registry";

function getMatchingDepartmentCategory(policyCategory: string): string {
  const mapping: Record<string, string> = {
    fiscal: "finance",
    monetary: "finance",
    trade: "commerce",
    defense: "defense",
    education: "education",
    healthcare: "health",
    infrastructure: "interior",
    environment: "interior",
    governance: "interior",
    security: "interior",
    social: "interior",
    foreign: "foreign",
    diplomatic: "foreign",
  };
  return mapping[policyCategory.toLowerCase()] || "interior";
}

interface PolicyCreatorSheetProps {
  countryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  prefill?: {
    title?: string;
    description?: string;
    objectives?: string;
    targetMetrics?: { metric: string; value: number; timeline: string }[];
  };
}

const METRIC_OPTIONS = [
  { value: "gdpGrowth", label: "GDP Growth", unit: "%", lowerIsBetter: false },
  { value: "unemploymentRate", label: "Unemployment Rate", unit: "%", lowerIsBetter: true },
  { value: "stability", label: "Stability", unit: "%", lowerIsBetter: false },
  { value: "taxRevenue", label: "Tax Revenue", unit: "%", lowerIsBetter: false },
  { value: "population", label: "Population", unit: "", lowerIsBetter: false },
  { value: "inflation", label: "Inflation", unit: "%", lowerIsBetter: true },
];

const CATEGORY_BASE_COSTS: Record<string, { impl: number; maint: number }> = {
  infrastructure: { impl: 5000000, maint: 1000000 },
  fiscal: { impl: 2500000, maint: 500000 },
  technology: { impl: 1500000, maint: 300000 },
  healthcare: { impl: 1000000, maint: 200000 },
  education: { impl: 1000000, maint: 200000 },
  default: { impl: 500000, maint: 100000 },
};

const PRIORITY_MULTIPLIERS = {
  low: 0.5,
  medium: 1.0,
  high: 1.5,
  critical: 2.0,
};

const POLICY_TYPES = [
  { value: "economic", label: "Economic" },
  { value: "social", label: "Social" },
  { value: "diplomatic", label: "Diplomatic" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "governance", label: "Governance" },
];

const POLICY_CATEGORIES = [
  "fiscal",
  "trade",
  "labor",
  "education",
  "healthcare",
  "environment",
  "defense",
  "housing",
  "technology",
  "agriculture",
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "N/A";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

function CollapsibleSection({
  title,
  icon: Icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ElementType;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-border/50 rounded-lg border">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="hover:bg-muted/50 flex w-full items-center justify-between rounded-lg p-3 text-sm font-medium transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="text-muted-foreground h-4 w-4" />
          <span>{title}</span>
          {badge && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[0.65rem]">
              {badge}
            </Badge>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        ) : (
          <ChevronRight className="text-muted-foreground h-4 w-4" />
        )}
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export function PolicyCreatorSheet({
  countryId,
  open,
  onOpenChange,
  onCreated,
  prefill,
}: PolicyCreatorSheetProps) {
  const notify = useNotify();
  const { user } = useUser();

  // Queries
  const { data: catalog = [] } = api.policies.getPolicyCatalog.useQuery(undefined, {
    enabled: open,
  });
  const { data: country } = api.countries.getByIdBasic.useQuery(
    { id: countryId },
    { enabled: !!countryId && open }
  );
  const { data: reconContext } = api.policies.getPolicyReconContext.useQuery(
    { countryId },
    { enabled: !!countryId && open }
  );

  // Form state
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("custom");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("fiscal");
  const [formPriority, setFormPriority] = useState<"low" | "medium" | "high" | "critical">(
    "medium"
  );
  const [formType, setFormType] = useState("economic");
  const [formObjectives, setFormObjectives] = useState("");
  const [formImplCost, setFormImplCost] = useState("");
  const [formMaintCost, setFormMaintCost] = useState("");
  const [formTargetMetrics, setFormTargetMetrics] = useState("");

  const reqDept = getMatchingDepartmentCategory(formCategory);
  const hasDepartment =
    selectedTemplateKey !== "custom" ||
    !reconContext ||
    reconContext.departmentCategories.includes(reqDept);

  // Target metrics structured state
  const [targetMetrics, setTargetMetrics] = useState<
    { metric: string; value: number; timeline: string }[]
  >([]);
  const [newMetricKey, setNewMetricKey] = useState("gdpGrowth");
  const [newMetricValue, setNewMetricValue] = useState("");
  const [newMetricTimeline, setNewMetricTimeline] = useState("1 year");

  // Sliders state for templates
  const [sliderSettings, setSliderSettings] = useState<Record<string, number>>({});
  const [calculatedEffects, setCalculatedEffects] = useState<any>(null);

  const resetForm = () => {
    setSelectedTemplateKey("custom");
    setFormTitle("");
    setFormDescription("");
    setFormCategory("fiscal");
    setFormPriority("medium");
    setFormType("economic");
    setFormObjectives("");
    setFormImplCost("");
    setFormMaintCost("");
    setFormTargetMetrics("");
    setSliderSettings({});
    setCalculatedEffects(null);
    setTargetMetrics([]);
    setNewMetricValue("");
  };

  useEffect(() => {
    if (open && prefill) {
      // oxlint-disable-next-line
      if (prefill.title) setFormTitle(prefill.title);
      if (prefill.description) setFormDescription(prefill.description);
      if (prefill.objectives) setFormObjectives(prefill.objectives);
      if (prefill.targetMetrics) setTargetMetrics(prefill.targetMetrics);
      setSelectedTemplateKey("custom");
    }
  }, [open, prefill]);

  const [isPending, setIsPending] = useState(false);

  const createPolicy = api.policies.createPolicy.useMutation();
  const activatePolicy = api.policies.activatePolicy.useMutation();

  // Load selected template settings
  useEffect(() => {
    if (selectedTemplateKey === "custom") {
      // oxlint-disable-next-line
      setCalculatedEffects(null);
      return;
    }

    const template = catalog.find((c: any) => c.key === selectedTemplateKey);
    if (!template) return;

    setFormTitle(template.name);
    setFormDescription(template.description);
    setFormCategory(template.category);
    setFormType(template.policyType);

    // Initialize slider settings
    const initialSettings: Record<string, number> = {};
    template.sliders.forEach((slider: any) => {
      initialSettings[slider.key] = slider.options[0]?.value ?? 0;
    });
    setSliderSettings(initialSettings);
  }, [selectedTemplateKey, catalog]);

  // Recalculate template effects live
  useEffect(() => {
    if (selectedTemplateKey === "custom") return;

    const pop = country?.currentPopulation ?? 10000000;
    const predefined = PREDEFINED_DECRETALS[selectedTemplateKey];

    if (predefined) {
      const results = predefined.calculate(sliderSettings, { currentPopulation: pop });
      // oxlint-disable-next-line
      setCalculatedEffects(results);
      setFormImplCost(String(results.implementationCost));
      setFormMaintCost(String(results.maintenanceCost));
    } else {
      // Custom DB template fallback linear calculation
      const val = sliderSettings.funding ?? 2;
      const results = {
        implementationCost: val * 2500000,
        maintenanceCost: val * 500000,
        gdpEffect: val * 0.2,
        employmentEffect: val * 0.1,
        inflationEffect: val * 0.15,
        taxRevenueEffect: val * 0.3,
        stabilityEffect: val * 0.5,
      };
      setCalculatedEffects(results);
      setFormImplCost(String(results.implementationCost));
      setFormMaintCost(String(results.maintenanceCost));
    }
  }, [sliderSettings, selectedTemplateKey, country]);

  // Recalculate custom decretal cost live
  useEffect(() => {
    if (selectedTemplateKey !== "custom") return;

    const base = CATEGORY_BASE_COSTS[formCategory] ?? CATEGORY_BASE_COSTS.default;
    const metricCostImpl = targetMetrics.length * 500000;
    const metricCostMaint = targetMetrics.length * 100000;

    const multiplier = PRIORITY_MULTIPLIERS[formPriority] ?? 1.0;

    const calculatedImpl = (base.impl + metricCostImpl) * multiplier;
    const calculatedMaint = (base.maint + metricCostMaint) * multiplier;

    // oxlint-disable-next-line
    setFormImplCost(String(calculatedImpl));
    setFormMaintCost(String(calculatedMaint));
  }, [formCategory, formPriority, targetMetrics, selectedTemplateKey]);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      notify.error("Policy title is required");
      return;
    }
    if (!formDescription.trim()) {
      notify.error("Policy description is required");
      return;
    }
    if (!user?.id) {
      notify.error("You must be signed in to create a policy");
      return;
    }
    if (!hasDepartment) {
      notify.error(
        `You must establish an active Department of ${reqDept.charAt(0).toUpperCase() + reqDept.slice(1)} first.`
      );
      return;
    }

    setIsPending(true);
    try {
      await createPolicy.mutateAsync({
        countryId,
        userId: user.id,
        name: formTitle,
        description: formDescription,
        policyType: formType as any,
        category: formCategory,
        priority: formPriority,
        targetMetrics:
          selectedTemplateKey === "custom"
            ? targetMetrics.length > 0
              ? JSON.stringify(targetMetrics)
              : undefined
            : formTargetMetrics || undefined,
        implementationCost: formImplCost ? parseFloat(formImplCost) : undefined,
        maintenanceCost: formMaintCost ? parseFloat(formMaintCost) : undefined,
        decretalKey: selectedTemplateKey !== "custom" ? selectedTemplateKey : undefined,
        settings: selectedTemplateKey !== "custom" ? sliderSettings : undefined,
      });

      notify.success("Policy created as draft");
      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (error: any) {
      notify.error(error.message || "Failed to create policy");
    } finally {
      setIsPending(false);
    }
  };

  const handleCreateAndLaunch = async () => {
    if (!formTitle.trim()) {
      notify.error("Policy title is required");
      return;
    }
    if (!formDescription.trim()) {
      notify.error("Policy description is required");
      return;
    }
    if (!user?.id) {
      notify.error("You must be signed in to create a policy");
      return;
    }
    if (!hasDepartment) {
      notify.error(
        `You must establish an active Department of ${reqDept.charAt(0).toUpperCase() + reqDept.slice(1)} first.`
      );
      return;
    }

    setIsPending(true);
    try {
      const policy = await createPolicy.mutateAsync({
        countryId,
        userId: user.id,
        name: formTitle,
        description: formDescription,
        policyType: formType as any,
        category: formCategory,
        priority: formPriority,
        targetMetrics:
          selectedTemplateKey === "custom"
            ? targetMetrics.length > 0
              ? JSON.stringify(targetMetrics)
              : undefined
            : formTargetMetrics || undefined,
        implementationCost: formImplCost ? parseFloat(formImplCost) : undefined,
        maintenanceCost: formMaintCost ? parseFloat(formMaintCost) : undefined,
        decretalKey: selectedTemplateKey !== "custom" ? selectedTemplateKey : undefined,
        settings: selectedTemplateKey !== "custom" ? sliderSettings : undefined,
      });

      await activatePolicy.mutateAsync({ id: policy.id });

      notify.success("Policy created and launched!");
      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (error: any) {
      notify.error(error.message || "Failed to launch policy");
    } finally {
      setIsPending(false);
    }
  };

  const currentTemplate = catalog.find((c: any) => c.key === selectedTemplateKey);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          padding: 0,
          maxHeight: "85vh",
          overflow: "hidden",
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-500" />
            Create Policy
          </DialogTitle>
          <DialogDescription>
            Enact a predefined policy strategy template or draft a custom decree.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateDraft} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {/* Catalog Selector */}
            <div>
              <Label className="text-xs">Policy Template</Label>
              <Select value={selectedTemplateKey} onValueChange={setSelectedTemplateKey}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">✨ Custom Decree (Freeform)</SelectItem>
                  {catalog.map((c: any) => (
                    <SelectItem key={c.key} value={c.key}>
                      📜 {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recon Context Fog Warnings */}
            {reconContext && (
              <div className="space-y-2">
                {!hasDepartment && (
                  <div className="flex gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                    <div>
                      <span className="font-semibold">Tracking Unavailable:</span> No active
                      department manages this policy domain. You must establish an active Department
                      of {reqDept.charAt(0).toUpperCase() + reqDept.slice(1)} in Politics before
                      launching custom policies in this category.
                    </div>
                  </div>
                )}
                {reconContext.overCapacity && (
                  <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    <div>
                      <span className="font-semibold">Capacity Warning:</span> Preview estimates may
                      be inaccurate due to overloaded Civil Service capacity.
                    </div>
                  </div>
                )}
                {reconContext.lowEfficiency && (
                  <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    <div>
                      <span className="font-semibold">Detail Tracking Obscured:</span> Government
                      efficiency is too low ({"<"}45%). Estimates are highly speculative.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Basic Info — read-only for templates, editable for custom */}
            <div className="space-y-3">
              {selectedTemplateKey === "custom" && (
                <>
                  <div>
                    <Label htmlFor="policy-title" className="text-xs">
                      Title *
                    </Label>
                    <Input
                      id="policy-title"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g., National Infrastructure Investment Act"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="policy-desc" className="text-xs">
                      Description *
                    </Label>
                    <Textarea
                      id="policy-desc"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Describe the policy's purpose and expected impact..."
                      rows={3}
                    />
                  </div>
                </>
              )}

              {selectedTemplateKey !== "custom" && currentTemplate && (
                <div className="bg-muted/30 border-border/40 rounded-lg border p-3">
                  <h4 className="text-sm font-semibold">{currentTemplate.name}</h4>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    {currentTemplate.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={formType}
                    onValueChange={setFormType}
                    disabled={selectedTemplateKey !== "custom"}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POLICY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Category</Label>
                  <Select
                    value={formCategory}
                    onValueChange={setFormCategory}
                    disabled={selectedTemplateKey !== "custom"}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POLICY_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Priority</Label>
                  <Select
                    value={formPriority}
                    onValueChange={(v) => setFormPriority(v as typeof formPriority)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Template Sliders */}
            {selectedTemplateKey !== "custom" && currentTemplate && (
              <div className="space-y-4 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-indigo-400 uppercase">
                  <Sliders className="h-3.5 w-3.5" />
                  Policy Strategy Configurations
                </h4>

                {currentTemplate.sliders.map((slider: any) => (
                  <div key={slider.key} className="space-y-2">
                    <Label className="text-muted-foreground text-xs font-medium">
                      {slider.label}
                    </Label>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {slider.options.map((opt: any) => {
                        const isSelected = sliderSettings[slider.key] === opt.value;
                        return (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() =>
                              setSliderSettings((prev) => ({
                                ...prev,
                                [slider.key]: opt.value,
                              }))
                            }
                            className={`flex flex-col items-center justify-center rounded-md border p-2 text-center transition-all ${
                              isSelected
                                ? "border-indigo-500 bg-indigo-600 font-medium text-white shadow-sm shadow-indigo-600/20"
                                : "bg-muted/40 border-border/40 hover:bg-muted/80 text-muted-foreground text-xs"
                            }`}
                          >
                            <span className="text-center text-[10px] sm:text-xs">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Live Effects/Calculations for Templates */}
            {selectedTemplateKey !== "custom" && calculatedEffects && (
              <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-emerald-400 uppercase">
                  <Sliders className="h-3.5 w-3.5" />
                  Calculated Simulation Projections
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="border-border/30 flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Setup Cost:</span>
                    <span className="font-semibold">
                      {formatCurrency(calculatedEffects.implementationCost)}
                    </span>
                  </div>
                  <div className="border-border/30 flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Annual Maint:</span>
                    <span className="font-semibold">
                      {formatCurrency(calculatedEffects.maintenanceCost)}
                    </span>
                  </div>
                  <div className="border-border/30 flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">GDP growth:</span>
                    <span
                      className={`font-semibold ${calculatedEffects.gdpEffect >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                    >
                      {calculatedEffects.gdpEffect >= 0 ? "+" : ""}
                      {calculatedEffects.gdpEffect.toFixed(2)}%
                    </span>
                  </div>
                  <div className="border-border/30 flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Employment:</span>
                    <span
                      className={`font-semibold ${calculatedEffects.employmentEffect >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                    >
                      {calculatedEffects.employmentEffect >= 0 ? "+" : ""}
                      {calculatedEffects.employmentEffect.toFixed(2)}%
                    </span>
                  </div>
                  <div className="border-border/30 flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Inflation:</span>
                    <span
                      className={`font-semibold ${calculatedEffects.inflationEffect <= 2 ? "text-emerald-500" : "text-amber-500"}`}
                    >
                      {calculatedEffects.inflationEffect >= 0 ? "+" : ""}
                      {calculatedEffects.inflationEffect.toFixed(2)}%
                    </span>
                  </div>
                  <div className="border-border/30 flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Tax Revenue:</span>
                    <span className="font-semibold text-indigo-400">
                      {calculatedEffects.taxRevenueEffect >= 0 ? "+" : ""}
                      {calculatedEffects.taxRevenueEffect.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Decree: Cost Projections & Target Metrics Builder */}
            {selectedTemplateKey === "custom" && (
              <>
                <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3.5">
                  <p className="text-[10px] font-semibold tracking-wider text-indigo-400 uppercase">
                    Estimated Cost Projections
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">Setup Cost (Implementation):</span>
                      <span className="text-sm font-semibold text-white">
                        {formatCurrency(parseFloat(formImplCost) || 0)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">Annual Maintenance:</span>
                      <span className="text-sm font-semibold text-white">
                        {formatCurrency(parseFloat(formMaintCost) || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-border/40 space-y-3 border-t pt-3">
                  <Label className="text-xs font-semibold">Target Simulation Metrics</Label>

                  {/* Added Metrics List */}
                  {targetMetrics.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {targetMetrics.map((item, index) => {
                        const option = METRIC_OPTIONS.find((o) => o.value === item.metric);
                        return (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="flex items-center gap-1 border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-300"
                          >
                            <span>
                              {option?.label}: {item.value}
                              {option?.unit} ({item.timeline})
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setTargetMetrics((prev) => prev.filter((_, i) => i !== index))
                              }
                              className="ml-1 cursor-pointer rounded-full p-0.5 hover:bg-indigo-500/25"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {/* Metric Creator Form */}
                  <div className="bg-muted/20 border-border/40 flex flex-wrap items-end gap-2 rounded-lg border p-3">
                    <div className="min-w-[120px] flex-1">
                      <Label className="text-muted-foreground text-[10px]">Metric</Label>
                      <Select value={newMetricKey} onValueChange={setNewMetricKey}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {METRIC_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-[80px]">
                      <Label className="text-muted-foreground text-[10px]">Value</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.1"
                          value={newMetricValue}
                          onChange={(e) => setNewMetricValue(e.target.value)}
                          placeholder="0"
                          className="h-8 pr-4 text-xs"
                        />
                        <span className="text-muted-foreground absolute top-1/2 right-1.5 -translate-y-1/2 text-[10px]">
                          {METRIC_OPTIONS.find((o) => o.value === newMetricKey)?.unit}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-[100px] flex-1">
                      <Label className="text-muted-foreground text-[10px]">Timeline</Label>
                      <Select value={newMetricTimeline} onValueChange={setNewMetricTimeline}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Immediate">Immediate</SelectItem>
                          <SelectItem value="6 months">6 months</SelectItem>
                          <SelectItem value="1 year">1 year</SelectItem>
                          <SelectItem value="2 years">2 years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!newMetricValue.trim()) return;
                        const val = parseFloat(newMetricValue);
                        if (isNaN(val)) return;
                        setTargetMetrics((prev) => [
                          ...prev,
                          { metric: newMetricKey, value: val, timeline: newMetricTimeline },
                        ]);
                        setNewMetricValue("");
                      }}
                      className="h-8 border-indigo-500/20 px-2.5 text-xs text-indigo-300 hover:bg-indigo-500/10"
                    >
                      Add Metric
                    </Button>
                  </div>
                </div>

                <CollapsibleSection title="Advanced Options" icon={Settings2} defaultOpen={false}>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Objectives</Label>
                      <Textarea
                        value={formObjectives}
                        onChange={(e) => setFormObjectives(e.target.value)}
                        placeholder="Key objectives and goals..."
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </CollapsibleSection>
              </>
            )}
          </div>

          {/* Sticky footer */}
          <DialogFooter className="border-border/50 flex gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={isPending || !formTitle.trim() || !formDescription.trim() || !hasDepartment}
            >
              {isPending ? "Creating..." : "Save Draft"}
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isPending || !formTitle.trim() || !formDescription.trim() || !hasDepartment}
              onClick={handleCreateAndLaunch}
              className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {isPending ? "Launching..." : "Create & Launch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
