"use client";

import { useEffect, useState } from "react";
import { Xmark as X, Check, WarningTriangle as AlertTriangle, Code as FileCode } from "iconoir-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

interface TemplateEditorSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
  onSuccess: () => void;
}

const DOMAINS = [
  "economic",
  "political",
  "social",
  "military",
  "diplomatic",
  "infrastructure",
  "environmental",
] as const;

const CATEGORIES = [
  "economic",
  "diplomatic",
  "social",
  "governance",
  "security",
  "infrastructure",
] as const;

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

const DEFAULT_TRIGGER = `{
  "and": [
    { "field": "publicApproval", "op": "<", "value": 45 },
    { "random": 0.4 }
  ]
}`;

const DEFAULT_RESPONSE = `[
  {
    "id": "option_a",
    "label": "Option A Title {{countryName}}",
    "description": "Describe the consequences of Option A.",
    "consequences": [
      {
        "targetModel": "Country",
        "targetField": "publicApproval",
        "operation": "add",
        "value": 5
      }
    ],
    "previewEffects": {
      "publicApproval": 5
    },
    "outcomeText": "Outcome resolution description."
  }
]`;

export function TemplateEditorSheet({
  isOpen,
  onOpenChange,
  templateId,
  onSuccess,
}: TemplateEditorSheetProps) {
  const isEdit = !!templateId;

  // Form State
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [domain, setDomain] = useState<(typeof DOMAINS)[number]>("economic");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("governance");
  const [baseSeverity, setBaseSeverity] = useState<(typeof SEVERITIES)[number]>("medium");
  const [baseUrgency, setBaseUrgency] = useState(50);
  const [deadlineDaysBase, setDeadlineDaysBase] = useState<number | "">("");
  const [cooldownDays, setCooldownDays] = useState(30);
  const [maxActivePerCountry, setMaxActivePerCountry] = useState(1);
  const [triggerConditions, setTriggerConditions] = useState(DEFAULT_TRIGGER);
  const [responseOptions, setResponseOptions] = useState(DEFAULT_RESPONSE);
  const [isActive, setIsActive] = useState(true);
  const [isGlobal, setIsGlobal] = useState(false);

  // Validation State
  const [triggerValid, setTriggerValid] = useState(true);
  const [responseValid, setResponseValid] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Template (if Edit)
  const { data: template, isLoading: isQueryLoading } = api.nationalIssues.getTemplate.useQuery(
    { id: templateId ?? "" },
    { enabled: isOpen && isEdit }
  );

  // Mutations
  const createMutation = api.nationalIssues.createTemplate.useMutation();
  const updateMutation = api.nationalIssues.updateTemplate.useMutation();

  // Load template fields on fetch
  useEffect(() => {
    if (template && isOpen) {
      setSlug(template.slug);
      setTitle(template.title);
      setDescription(template.description);
      setLongDescription(template.longDescription ?? "");
      setDomain(template.domain as any);
      setCategory(template.category as any);
      setBaseSeverity(template.baseSeverity as any);
      setBaseUrgency(template.baseUrgency);
      setDeadlineDaysBase(template.deadlineDaysBase ?? "");
      setCooldownDays(template.cooldownDays);
      setMaxActivePerCountry(template.maxActivePerCountry);

      // format JSON strings for nice display
      try {
        setTriggerConditions(JSON.stringify(JSON.parse(template.triggerConditions), null, 2));
      } catch {
        setTriggerConditions(template.triggerConditions);
      }
      try {
        setResponseOptions(JSON.stringify(JSON.parse(template.responseOptions), null, 2));
      } catch {
        setResponseOptions(template.responseOptions);
      }
      setIsActive(template.isActive);
      setIsGlobal(template.isGlobal);
    } else if (!isEdit && isOpen) {
      // Clear for new template
      setSlug("");
      setTitle("");
      setDescription("");
      setLongDescription("");
      setDomain("economic");
      setCategory("governance");
      setBaseSeverity("medium");
      setBaseUrgency(50);
      setDeadlineDaysBase("");
      setCooldownDays(30);
      setMaxActivePerCountry(1);
      setTriggerConditions(DEFAULT_TRIGGER);
      setResponseOptions(DEFAULT_RESPONSE);
      setIsActive(true);
      setIsGlobal(false);
    }
    setFormError(null);
  }, [template, isOpen, isEdit]);

  // Live validation on triggers
  useEffect(() => {
    try {
      JSON.parse(triggerConditions);
      setTriggerValid(true);
    } catch {
      setTriggerValid(false);
    }
  }, [triggerConditions]);

  // Live validation on responses
  useEffect(() => {
    try {
      JSON.parse(responseOptions);
      setResponseValid(true);
    } catch {
      setResponseValid(false);
    }
  }, [responseOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!slug) return setFormError("Slug is required.");
    if (!title) return setFormError("Title is required.");
    if (!description) return setFormError("Description is required.");
    if (!triggerValid) return setFormError("Trigger Conditions must be valid JSON.");
    if (!responseValid) return setFormError("Response Options must be valid JSON.");

    // Format fields
    const parsedDeadline = deadlineDaysBase === "" ? null : Number(deadlineDaysBase);

    const payload = {
      slug,
      title,
      description,
      longDescription: longDescription || undefined,
      domain,
      category,
      baseSeverity,
      baseUrgency,
      deadlineDaysBase: parsedDeadline,
      cooldownDays,
      maxActivePerCountry,
      triggerConditions,
      responseOptions,
      isActive,
      isGlobal,
    };

    try {
      if (isEdit && templateId) {
        await updateMutation.mutateAsync({
          id: templateId,
          ...payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save template.");
    }
  };

  const handlePrefillResponse = () => {
    setResponseOptions(JSON.stringify(JSON.parse(DEFAULT_RESPONSE), null, 2));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="z-[100000] w-full max-w-xl overflow-y-auto border-white/10 bg-black/90 text-white backdrop-blur-xl sm:max-w-xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lg font-bold text-white">
            {isEdit ? `Edit Template: ${slug}` : "Create Issue Template"}
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-400">
            {isEdit
              ? "Update this template configuration. Fields persist immediately on submit."
              : "Create a new event/decision template for the engine."}
          </SheetDescription>
        </SheetHeader>

        {isOpen && isEdit && isQueryLoading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading template details...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pb-8">
            {formError && (
              <div className="flex items-center gap-2 rounded border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Slug (Unique identifier)
                </label>
                <Input
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
                  }
                  placeholder="e.g. workers_strike"
                  disabled={isEdit}
                  required
                  className="h-8 border-white/10 bg-white/5 text-xs text-white focus-visible:ring-amber-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Title
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Workers Strike in {{sectorName}}"
                  required
                  className="h-8 border-white/10 bg-white/5 text-xs text-white focus-visible:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Labor unions in {{countryName}} are threatening a general strike..."
                required
                rows={2}
                className="border-white/10 bg-white/5 text-xs text-white focus-visible:ring-amber-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Long Description (Optional)
              </label>
              <Textarea
                value={longDescription}
                onChange={(e) => setLongDescription(e.target.value)}
                placeholder="Union leaders demand a {{percentageMedium}}% wage increase..."
                rows={3}
                className="border-white/10 bg-white/5 text-xs text-white focus-visible:ring-amber-500"
              />
            </div>

            {/* Classification */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Domain
                </label>
                <Select value={domain} onValueChange={(val: any) => setDomain(val)}>
                  <SelectTrigger className="h-8 border-white/10 bg-white/5 text-xs text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-900 text-white">
                    {DOMAINS.map((d) => (
                      <SelectItem
                        key={d}
                        value={d}
                        className="text-xs focus:bg-white/10 focus:text-white"
                      >
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Category
                </label>
                <Select value={category} onValueChange={(val: any) => setCategory(val)}>
                  <SelectTrigger className="h-8 border-white/10 bg-white/5 text-xs text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-900 text-white">
                    {CATEGORIES.map((c) => (
                      <SelectItem
                        key={c}
                        value={c}
                        className="text-xs focus:bg-white/10 focus:text-white"
                      >
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Severity
                </label>
                <Select value={baseSeverity} onValueChange={(val: any) => setBaseSeverity(val)}>
                  <SelectTrigger className="h-8 border-white/10 bg-white/5 text-xs text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-900 text-white">
                    {SEVERITIES.map((s) => (
                      <SelectItem
                        key={s}
                        value={s}
                        className="text-xs focus:bg-white/10 focus:text-white"
                      >
                        {s.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mechanics parameters */}
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Urgency (0-100)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={baseUrgency}
                  onChange={(e) => setBaseUrgency(Number(e.target.value))}
                  className="h-8 border-white/10 bg-white/5 text-xs text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Deadline (Days)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={deadlineDaysBase}
                  onChange={(e) =>
                    setDeadlineDaysBase(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="None"
                  className="h-8 border-white/10 bg-white/5 text-xs text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Cooldown (Days)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={cooldownDays}
                  onChange={(e) => setCooldownDays(Number(e.target.value))}
                  className="h-8 border-white/10 bg-white/5 text-xs text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Max Active
                </label>
                <Input
                  type="number"
                  min={1}
                  value={maxActivePerCountry}
                  onChange={(e) => setMaxActivePerCountry(Number(e.target.value))}
                  className="h-8 border-white/10 bg-white/5 text-xs text-white"
                />
              </div>
            </div>

            {/* Settings Toggles */}
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-white/10 bg-white/5 accent-amber-500"
                />
                <span>Active Template</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={isGlobal}
                  onChange={(e) => setIsGlobal(e.target.checked)}
                  className="h-4 w-4 rounded border-white/10 bg-white/5 accent-amber-500"
                />
                <span>Is Global Event</span>
              </label>
            </div>

            {/* JSON Code Blocks */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  <FileCode className="h-3.5 w-3.5 text-slate-400" />
                  Trigger Conditions (JSON Expression Tree)
                </label>
                <Badge
                  variant="outline"
                  className={`px-1 py-0 text-[10px] ${triggerValid ? "border-green-500/20 bg-green-500/10 text-green-400" : "border-red-500/20 bg-red-500/10 text-red-400"}`}
                >
                  {triggerValid ? <Check className="mr-0.5 inline-block h-3 w-3" /> : null}
                  {triggerValid ? "Valid JSON" : "Invalid JSON"}
                </Badge>
              </div>
              <Textarea
                value={triggerConditions}
                onChange={(e) => setTriggerConditions(e.target.value)}
                rows={5}
                className="border-white/10 bg-white/5 font-mono text-xs text-white focus-visible:ring-amber-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  <FileCode className="h-3.5 w-3.5 text-slate-400" />
                  Response Options (JSON Option Array)
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handlePrefillResponse}
                    className="h-5 p-1 text-[9px] text-amber-400 hover:bg-white/10 hover:text-white"
                  >
                    Prefill Template
                  </Button>
                  <Badge
                    variant="outline"
                    className={`px-1 py-0 text-[10px] ${responseValid ? "border-green-500/20 bg-green-500/10 text-green-400" : "border-red-500/20 bg-red-500/10 text-red-400"}`}
                  >
                    {responseValid ? <Check className="mr-0.5 inline-block h-3 w-3" /> : null}
                    {responseValid ? "Valid JSON" : "Invalid JSON"}
                  </Badge>
                </div>
              </div>
              <Textarea
                value={responseOptions}
                onChange={(e) => setResponseOptions(e.target.value)}
                rows={8}
                className="border-white/10 bg-white/5 font-mono text-xs text-white focus-visible:ring-amber-500"
              />
            </div>

            <SheetFooter className="mt-6 flex gap-2 border-t border-white/10 pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 border-white/10 text-xs text-slate-300 hover:bg-white/5 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !triggerValid || !responseValid}
                className="h-8 bg-amber-500 text-xs font-semibold text-black hover:bg-amber-400"
              >
                {isPending ? "Saving..." : isEdit ? "Update Template" : "Create Template"}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
