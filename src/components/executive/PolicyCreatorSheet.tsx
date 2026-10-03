"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils/format-utils";
import { cn } from "~/lib/utils";
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

function FieldSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div>
      <Label className="text-footnote">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="text-footnote h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CustomPolicyFields({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
}: {
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}) {
  return (
    <>
      <div>
        <Label htmlFor="policy-title" className="text-footnote">
          Title *
        </Label>
        <Input
          id="policy-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
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
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="What the policy does and what you expect from it"
          rows={3}
        />
      </div>
    </>
  );
}

const signedPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

type PolicyEffects = ReturnType<(typeof PREDEFINED_DECRETALS)[string]["calculate"]>;

function ProjectedEffects({ effects }: { effects: PolicyEffects }) {
  const rows: [label: string, value: string, tone?: string][] = [
    ["Setup cost", formatCurrency(effects.implementationCost)],
    ["Annual maintenance", formatCurrency(effects.maintenanceCost)],
    [
      "GDP growth",
      signedPct(effects.gdpEffect),
      effects.gdpEffect >= 0 ? "text-green" : "text-red",
    ],
    [
      "Employment",
      signedPct(effects.employmentEffect),
      effects.employmentEffect >= 0 ? "text-green" : "text-red",
    ],
    [
      "Inflation",
      signedPct(effects.inflationEffect),
      effects.inflationEffect <= 2 ? "text-green" : "text-yellow",
    ],
    ["Tax revenue", signedPct(effects.taxRevenueEffect)],
  ];
  return (
    <div className="bg-surface-secondary rounded-row space-y-3 p-4">
      <h4 className="text-eyebrow text-label-secondary flex items-center gap-2">
        <Sliders aria-hidden className="h-3.5 w-3.5" />
        Projected effects
      </h4>
      <div className="text-footnote grid grid-cols-2 gap-2">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="border-separator flex justify-between border-b pb-1">
            <span className="text-label-secondary">{label}</span>
            <span className={cn("font-semibold", tone)}>{value}</span>
          </div>
        ))}
      </div>
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

  const isTemplate = selectedTemplateKey !== "custom";
  const currentTemplate = isTemplate
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
    if (!isTemplate) {
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
  const cannotSubmit =
    isPending || !formTitle.trim() || !formDescription.trim() || !targetDepartment;

  const createPolicy = () => {
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
      decretalKey: isTemplate ? selectedTemplateKey : undefined,
      settings: isTemplate ? sliderSettings : undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPolicy();
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
              {!isTemplate && (
                <CustomPolicyFields
                  title={formTitle}
                  description={formDescription}
                  onTitleChange={setFormTitle}
                  onDescriptionChange={setFormDescription}
                />
              )}

              {isTemplate && currentTemplate && (
                <Card variant="inset" padding="none" className="p-3">
                  <h4 className="text-headline">{currentTemplate.name}</h4>
                  <p className="text-label-secondary text-footnote mt-1 leading-relaxed">
                    {currentTemplate.description}
                  </p>
                </Card>
              )}

              <div className="grid grid-cols-3 gap-2">
                <FieldSelect
                  label="Type"
                  value={formType}
                  onChange={(v) => setFormType(v as typeof formType)}
                  disabled={isTemplate}
                  options={POLICY_TYPES}
                />
                <FieldSelect
                  label="Category"
                  value={formCategory}
                  onChange={setFormCategory}
                  disabled={isTemplate}
                  options={POLICY_CATEGORIES.map((c) => ({
                    value: c,
                    label: c.charAt(0).toUpperCase() + c.slice(1),
                  }))}
                />
                <FieldSelect
                  label="Priority"
                  value={formPriority}
                  onChange={(v) => setFormPriority(v as typeof formPriority)}
                  options={PRIORITY_OPTIONS}
                />
              </div>
            </div>

            <PolicyTemplateSliders
              currentTemplate={currentTemplate}
              sliderSettings={sliderSettings}
              onSliderChange={(key, val) => setSliderSettings((prev) => ({ ...prev, [key]: val }))}
            />

            {isTemplate && calculatedEffects && <ProjectedEffects effects={calculatedEffects} />}

            {!isTemplate && (
              <>
                <div className="bg-surface-secondary rounded-row space-y-2 p-4">
                  <p className="text-eyebrow text-label-secondary">Estimated costs</p>
                  <div className="text-footnote grid grid-cols-2 gap-3">
                    {[
                      ["Setup cost", formImplCost],
                      ["Annual maintenance", formMaintCost],
                    ].map(([label, cost]) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <span className="text-label-secondary">{label}</span>
                        <span className="text-headline text-label">
                          {formatCurrency(parseFloat(cost!) || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <PolicyTargetMetrics metrics={targetMetrics} onChange={setTargetMetrics} />

                <CollapsibleSection title="Advanced options" icon={Settings2} defaultOpen={false}>
                  <Label className="text-footnote">Objectives</Label>
                  <Textarea
                    value={formObjectives}
                    onChange={(e) => setFormObjectives(e.target.value)}
                    placeholder="What the policy should achieve"
                    rows={2}
                    className="text-body"
                  />
                </CollapsibleSection>
              </>
            )}
          </div>

          <SheetFooter className="border-separator flex gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="outline" size="sm" disabled={cannotSubmit}>
              {isPending ? "Creating" : "Save draft"}
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={cannotSubmit}
              onClick={createPolicy}
            >
              {isPending ? "Launching" : "Create and launch"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
