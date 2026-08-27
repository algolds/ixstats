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
import {
  Page as FileText,
  Settings as Settings2,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
  ControlSlider as Sliders,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { PREDEFINED_DECRETALS } from "~/lib/policies/registry";
import {
  CATEGORY_BASE_COSTS,
  PRIORITY_MULTIPLIERS,
  POLICY_TYPES,
  POLICY_CATEGORIES,
  PRIORITY_OPTIONS,
  formatPolicyCurrency,
  getMatchingDepartmentCategory,
} from "./policies/policy-creator-constants";
import { PolicyTargetMetrics, type TargetMetric } from "./policies/PolicyTargetMetrics";
import { PolicyTemplateSliders } from "./policies/PolicyTemplateSliders";
import { PolicyReconBanner } from "./policies/PolicyReconBanner";

interface PolicyCreatorSheetProps {
  countryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  prefill?: {
    title?: string;
    description?: string;
    objectives?: string;
    targetMetrics?: TargetMetric[];
  };
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

  const { data: country } = api.countries.getByIdBasic.useQuery(
    { id: countryId },
    { enabled: open && !!countryId }
  );

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("custom");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<"economic" | "social" | "diplomatic" | "infrastructure" | "governance">("economic");
  const [formCategory, setFormCategory] = useState("fiscal");
  const [formPriority, setFormPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [formImplCost, setFormImplCost] = useState("500000");
  const [formMaintCost, setFormMaintCost] = useState("100000");
  const [formObjectives, setFormObjectives] = useState("");
  const [targetMetrics, setTargetMetrics] = useState<TargetMetric[]>([]);
  const [sliderSettings, setSliderSettings] = useState<Record<string, number>>({});

  useEffect(() => {
    if (prefill) {
      if (prefill.title) setFormTitle(prefill.title);
      if (prefill.description) setFormDescription(prefill.description);
      if (prefill.objectives) setFormObjectives(prefill.objectives);
      if (prefill.targetMetrics) setTargetMetrics(prefill.targetMetrics);
    }
  }, [prefill]);

  const currentTemplate =
    selectedTemplateKey !== "custom"
      ? PREDEFINED_DECRETALS[selectedTemplateKey as keyof typeof PREDEFINED_DECRETALS]
      : null;

  useEffect(() => {
    if (currentTemplate) {
      setFormTitle(currentTemplate.name);
      setFormDescription(currentTemplate.description);
      setFormType(currentTemplate.policyType as any);
      setFormCategory(currentTemplate.category);
      setFormObjectives("");
      const initialSliders: Record<string, number> = {};
      currentTemplate.sliders.forEach((s) => {
        initialSliders[s.key] = s.options[0]?.value ?? 1;
      });
      setSliderSettings(initialSliders);
    }
  }, [currentTemplate]);

  useEffect(() => {
    if (selectedTemplateKey === "custom") {
      const base = CATEGORY_BASE_COSTS[formCategory] || CATEGORY_BASE_COSTS.default;
      const mult = PRIORITY_MULTIPLIERS[formPriority] || 1.0;
      setFormImplCost(String(Math.round((base?.impl ?? 500000) * mult)));
      setFormMaintCost(String(Math.round((base?.maint ?? 100000) * mult)));
    }
  }, [formCategory, formPriority, selectedTemplateKey]);

  const departmentKey = getMatchingDepartmentCategory(formCategory);
  const targetDepartment = (country as any)?.departments?.find(
    (d: any) => d.category?.toLowerCase() === departmentKey.toLowerCase()
  );
  const hasDepartment = !!targetDepartment;

  const calculatedEffects = currentTemplate
    ? currentTemplate.calculate(sliderSettings, country)
    : null;

  const { data: reconContext } = api.policies.getPolicyReconContext.useQuery(
    { countryId },
    { enabled: open && !!countryId }
  );

  const utils = api.useUtils();
  const createPolicyMutation = api.policies.createPolicy.useMutation({
    onSuccess: () => {
      notify.success("Policy draft created successfully");
      utils.policies.invalidate();
      onOpenChange(false);
      onCreated?.();
    },
    onError: (err: { message?: string }) => {
      notify.error(err.message || "Failed to create policy");
    },
  });

  const isPending = createPolicyMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDescription.trim()) return;

    createPolicyMutation.mutate({
      countryId,
      userId: user?.id || "",
      name: formTitle.trim(),
      description: formDescription.trim(),
      policyType: formType,
      category: formCategory,
      priority: formPriority,
      implementationCost: parseFloat(formImplCost) || 0,
      maintenanceCost: parseFloat(formMaintCost) || 0,
      targetMetrics: targetMetrics.length > 0 ? JSON.stringify(targetMetrics) : undefined,
      decretalKey: selectedTemplateKey !== "custom" ? selectedTemplateKey : undefined,
      settings: selectedTemplateKey !== "custom" ? sliderSettings : undefined,
    });
  };

  const handleCreateAndLaunch = () => {
    if (!formTitle.trim() || !formDescription.trim()) return;
    createPolicyMutation.mutate({
      countryId,
      userId: user?.id || "",
      name: formTitle.trim(),
      description: formDescription.trim(),
      policyType: formType,
      category: formCategory,
      priority: formPriority,
      implementationCost: parseFloat(formImplCost) || 0,
      maintenanceCost: parseFloat(formMaintCost) || 0,
      targetMetrics: targetMetrics.length > 0 ? JSON.stringify(targetMetrics) : undefined,
      decretalKey: selectedTemplateKey !== "custom" ? selectedTemplateKey : undefined,
      settings: selectedTemplateKey !== "custom" ? sliderSettings : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto p-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-border/50 border-b px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <FileText className="text-indigo-400 h-5 w-5" />
              Declare New Executive Policy
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Establish a national decretal, allocate budget, and project macro impacts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-4">
            <div>
              <Label className="text-xs font-semibold">Policy Template / Blueprint</Label>
              <Select value={selectedTemplateKey} onValueChange={setSelectedTemplateKey}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Decretal (Scratch Design)</SelectItem>
                  {Object.entries(PREDEFINED_DECRETALS).map(([key, tmpl]) => (
                    <SelectItem key={key} value={key}>
                      {tmpl.name} ({tmpl.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <PolicyReconBanner
              reconContext={reconContext}
              targetDepartment={targetDepartment}
              departmentKey={departmentKey}
            />

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
                    onValueChange={(v) => setFormType(v as any)}
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

            <PolicyTemplateSliders
              currentTemplate={currentTemplate}
              sliderSettings={sliderSettings}
              onSliderChange={(key, val) =>
                setSliderSettings((prev) => ({ ...prev, [key]: val }))
              }
            />

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
                      {formatPolicyCurrency(calculatedEffects.implementationCost)}
                    </span>
                  </div>
                  <div className="border-border/30 flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Annual Maint:</span>
                    <span className="font-semibold">
                      {formatPolicyCurrency(calculatedEffects.maintenanceCost)}
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
                        {formatPolicyCurrency(parseFloat(formImplCost) || 0)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">Annual Maintenance:</span>
                      <span className="text-sm font-semibold text-white">
                        {formatPolicyCurrency(parseFloat(formMaintCost) || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <PolicyTargetMetrics
                  metrics={targetMetrics}
                  onChange={setTargetMetrics}
                />

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
