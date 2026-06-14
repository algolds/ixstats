// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import { useState } from "react";
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
import { FileText, Settings2, ChevronDown, ChevronRight } from "lucide-react";
import { useNotify } from "~/hooks/useNotify";

interface PolicyCreatorSheetProps {
  countryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

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
}: PolicyCreatorSheetProps) {
  const notify = useNotify();
  const { user } = useUser();

  // Form state
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

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormCategory("fiscal");
    setFormPriority("medium");
    setFormType("economic");
    setFormObjectives("");
    setFormImplCost("");
    setFormMaintCost("");
    setFormTargetMetrics("");
  };

  const [isPending, setIsPending] = useState(false);

  const createPolicy = api.policies.createPolicy.useMutation();
  const activatePolicy = api.policies.activatePolicy.useMutation();

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
        targetMetrics: formTargetMetrics || undefined,
        implementationCost: formImplCost ? parseFloat(formImplCost) : undefined,
        maintenanceCost: formMaintCost ? parseFloat(formMaintCost) : undefined,
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
        targetMetrics: formTargetMetrics || undefined,
        implementationCost: formImplCost ? parseFloat(formImplCost) : undefined,
        maintenanceCost: formMaintCost ? parseFloat(formMaintCost) : undefined,
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
            Draft a new policy for your country. It will be saved as a draft until activated.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateDraft} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {/* Basic Info — always visible */}
            <div className="space-y-3">
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

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={formType} onValueChange={setFormType}>
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
                  <Select value={formCategory} onValueChange={setFormCategory}>
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

            {/* Advanced Options — collapsible */}
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

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Implementation Cost</Label>
                    <Input
                      type="number"
                      value={formImplCost}
                      onChange={(e) => setFormImplCost(e.target.value)}
                      placeholder="0"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Maintenance Cost</Label>
                    <Input
                      type="number"
                      value={formMaintCost}
                      onChange={(e) => setFormMaintCost(e.target.value)}
                      placeholder="0"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Target Metrics</Label>
                  <Input
                    value={formTargetMetrics}
                    onChange={(e) => setFormTargetMetrics(e.target.value)}
                    placeholder="e.g., GDP growth, employment rate"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </CollapsibleSection>
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
              disabled={isPending || !formTitle.trim() || !formDescription.trim()}
            >
              {isPending ? "Creating..." : "Save Draft"}
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isPending || !formTitle.trim() || !formDescription.trim()}
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
