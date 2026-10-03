"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils/format-utils";
import { useUser } from "~/context/auth-context";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
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
  getMatchingDepartmentCategory,
} from "./policies/policy-creator-constants";
import { PolicyTargetMetrics, type TargetMetric } from "./policies/PolicyTargetMetrics";
import { PolicyTemplateSliders } from "./policies/PolicyTemplateSliders";
import { PolicyReconBanner } from "./policies/PolicyReconBanner";
import { Card } from "~/components/ui/card";

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
    <div className="border-separator rounded-control border">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="hover:bg-fill-3 rounded-control text-body flex w-full items-center justify-between p-3 font-medium transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="text-label-secondary h-4 w-4" />
          <span>{title}</span>
          {badge && (
            <Badge variant="default" className="text-footnote px-2 py-0">
              {badge}
            </Badge>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="text-label-secondary h-4 w-4" />
        ) : (
          <ChevronRight className="text-label-secondary h-4 w-4" />
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
  const [formType, setFormType] = useState<
    "economic" | "social" | "diplomatic" | "infrastructure" | "governance"
  >("economic");
  const [formCategory, setFormCategory] = useState("fiscal");
  const [formPriority, setFormPriority] = useState<"low" | "medium" | "high" | "critical">(
    "medium"
  );
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
      notify.success("Policy draft created");
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="wide" className="overflow-y-auto p-0">
        <form onSubmit={handleSubmit}>
          <SheetHeader className="border-separator border-b px-6 pt-6 pb-4">
            <SheetTitle className="text-title-3 flex items-center gap-2">
              <FileText aria-hidden className="text-label-secondary h-5 w-5" />
              New executive policy
            </SheetTitle>
            <SheetDescription className="text-label-secondary text-footnote">
              Set the policy, its budget and its expected effects.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-6 py-4">
            <div>
              <Label className="text-caption font-semibold">Policy template</Label>
              <Select value={selectedTemplateKey} onValueChange={setSelectedTemplateKey}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom (start from scratch)</SelectItem>
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
                    <Label htmlFor="policy-title" className="text-footnote">
                      Title *
                    </Label>
                    <Input
                      id="policy-title"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. National Infrastructure Investment Act"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="policy-desc" className="text-footnote">
                      Description *
                    </Label>
                    <Textarea
                      id="policy-desc"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="What the policy does and what you expect from it"
                      rows={3}
                    />
                  </div>
                </>
              )}

              {selectedTemplateKey !== "custom" && currentTemplate && (
                <Card variant="inset" padding="none" className="p-3">
                  <h4 className="text-headline">{currentTemplate.name}</h4>
                  <p className="text-label-secondary text-footnote mt-1 leading-relaxed">
                    {currentTemplate.description}
                  </p>
                </Card>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-footnote">Type</Label>
                  <Select
                    value={formType}
                    onValueChange={(v) => setFormType(v as any)}
                    disabled={selectedTemplateKey !== "custom"}
                  >
                    <SelectTrigger className="text-footnote h-8">
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
                  <Label className="text-footnote">Category</Label>
                  <Select
                    value={formCategory}
                    onValueChange={setFormCategory}
                    disabled={selectedTemplateKey !== "custom"}
                  >
                    <SelectTrigger className="text-footnote h-8">
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
                  <Label className="text-footnote">Priority</Label>
                  <Select
                    value={formPriority}
                    onValueChange={(v) => setFormPriority(v as typeof formPriority)}
                  >
                    <SelectTrigger className="text-footnote h-8">
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
              onSliderChange={(key, val) => setSliderSettings((prev) => ({ ...prev, [key]: val }))}
            />

            {selectedTemplateKey !== "custom" && calculatedEffects && (
              <div className="bg-surface-secondary rounded-row space-y-3 p-4">
                <h4 className="text-eyebrow text-label-secondary flex items-center gap-2">
                  <Sliders aria-hidden className="h-3.5 w-3.5" />
                  Projected effects
                </h4>
                <div className="text-footnote grid grid-cols-2 gap-2">
                  <div className="border-separator flex justify-between border-b pb-1">
                    <span className="text-label-secondary">Setup cost</span>
                    <span className="font-semibold">
                      {formatCurrency(calculatedEffects.implementationCost)}
                    </span>
                  </div>
                  <div className="border-separator flex justify-between border-b pb-1">
                    <span className="text-label-secondary">Annual maintenance</span>
                    <span className="font-semibold">
                      {formatCurrency(calculatedEffects.maintenanceCost)}
                    </span>
                  </div>
                  <div className="border-separator flex justify-between border-b pb-1">
                    <span className="text-label-secondary">GDP growth</span>
                    <span
                      className={`font-semibold ${calculatedEffects.gdpEffect >= 0 ? "text-green" : "text-red"}`}
                    >
                      {calculatedEffects.gdpEffect >= 0 ? "+" : ""}
                      {calculatedEffects.gdpEffect.toFixed(2)}%
                    </span>
                  </div>
                  <div className="border-separator flex justify-between border-b pb-1">
                    <span className="text-label-secondary">Employment</span>
                    <span
                      className={`font-semibold ${calculatedEffects.employmentEffect >= 0 ? "text-green" : "text-red"}`}
                    >
                      {calculatedEffects.employmentEffect >= 0 ? "+" : ""}
                      {calculatedEffects.employmentEffect.toFixed(2)}%
                    </span>
                  </div>
                  <div className="border-separator flex justify-between border-b pb-1">
                    <span className="text-label-secondary">Inflation</span>
                    <span
                      className={`font-semibold ${calculatedEffects.inflationEffect <= 2 ? "text-green" : "text-yellow"}`}
                    >
                      {calculatedEffects.inflationEffect >= 0 ? "+" : ""}
                      {calculatedEffects.inflationEffect.toFixed(2)}%
                    </span>
                  </div>
                  <div className="border-separator flex justify-between border-b pb-1">
                    <span className="text-label-secondary">Tax revenue</span>
                    <span className="font-semibold">
                      {calculatedEffects.taxRevenueEffect >= 0 ? "+" : ""}
                      {calculatedEffects.taxRevenueEffect.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedTemplateKey === "custom" && (
              <>
                <div className="bg-surface-secondary rounded-row space-y-2 p-4">
                  <p className="text-eyebrow text-label-secondary">Estimated costs</p>
                  <div className="text-footnote grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-label-secondary">Setup cost</span>
                      <span className="text-headline text-label">
                        {formatCurrency(parseFloat(formImplCost) || 0)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-label-secondary">Annual maintenance</span>
                      <span className="text-headline text-label">
                        {formatCurrency(parseFloat(formMaintCost) || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <PolicyTargetMetrics metrics={targetMetrics} onChange={setTargetMetrics} />

                <CollapsibleSection title="Advanced options" icon={Settings2} defaultOpen={false}>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-footnote">Objectives</Label>
                      <Textarea
                        value={formObjectives}
                        onChange={(e) => setFormObjectives(e.target.value)}
                        placeholder="What the policy should achieve"
                        rows={2}
                        className="text-body"
                      />
                    </div>
                  </div>
                </CollapsibleSection>
              </>
            )}
          </div>

          <SheetFooter className="border-separator flex gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={isPending || !formTitle.trim() || !formDescription.trim() || !hasDepartment}
            >
              {isPending ? "Creating" : "Save draft"}
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isPending || !formTitle.trim() || !formDescription.trim() || !hasDepartment}
              onClick={handleCreateAndLaunch}
            >
              {isPending ? "Launching" : "Create and launch"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
