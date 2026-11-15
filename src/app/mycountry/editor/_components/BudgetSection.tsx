"use client";

import { useMemo, useState } from "react";
import { Plus, Trash, Wallet } from "iconoir-react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { FACET_CHART_COLORS } from "~/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import { Slider } from "~/components/ui/slider";
import { Stat } from "~/components/ui/stat";
import { CreateGovernmentStructureButton } from "~/components/mycountry/domains/government/CreateGovernmentStructureButton";
import { RateInput } from "~/components/mycountry/shell/RateInput";
import { useNationClock } from "~/hooks/useNationClock";
import { useNotify } from "~/hooks/useNotify";
import { useRealmClock } from "~/hooks/useRealmClock";
import { nationalRevenue } from "~/lib/economy/national-revenue";
import { allocationAmount, ALLOCATION_PERCENT_MAX } from "~/lib/government/budget-math";
import { currentBudgetYear, latestBudgetYearUpTo } from "~/lib/government/budget-year";
import { formatBudgetYear } from "~/lib/realms/realm-year";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import { api } from "~/trpc/react";
import {
  DepartmentCategorySchema,
  type BudgetAllocation,
  type DepartmentCategory,
  type GovernmentDepartment,
} from "~/types/government";
import { EditorSection, SaveButton } from "./EditorSection";
import { useEditor, useReportDirty, type EditorState } from "./editor-context";

const CATEGORIES = DepartmentCategorySchema.options;

function AddDepartmentDialog({
  onAdd,
  pending,
}: {
  onAdd: (input: { name: string; category: DepartmentCategory }) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DepartmentCategory>("Other");
  const trimmed = name.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1">
          <Plus className="size-3.5" aria-hidden="true" />
          Add department
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add department</DialogTitle>
          <DialogDescription>
            Create a ministry or agency to allocate a share of the national budget and appoint
            officials.
          </DialogDescription>
        </DialogHeader>
        <form
          id="editor-add-department-form"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!trimmed) return;
            onAdd({ name: trimmed, category });
            setName("");
            setOpen(false);
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="editor-new-dept-name">Department name</Label>
            <Input
              id="editor-new-dept-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ministry of Fisheries"
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="editor-new-dept-category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as DepartmentCategory)}>
              <SelectTrigger id="editor-new-dept-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="editor-add-department-form" disabled={!trimmed || pending}>
            Add department
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BudgetSection({ state }: { state: EditorState }) {
  const { countryId } = useEditor();
  const notify = useNotify();
  const utils = api.useUtils();
  const sharedClock = useNationClock();
  const realmClock = useRealmClock(sharedClock ? undefined : state.realmId);
  const clock = sharedClock ?? realmClock;

  const govQuery = api.government.getFullByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const [draft, setDraft] = useState<Record<string, number>>({});

  const refreshGov = async () => {
    await Promise.all([
      utils.government.getFullByCountryId.invalidate({ countryId }),
      utils.government.getByCountryId.invalidate({ countryId }),
      utils.mycountry.getFirstSteps?.invalidate?.(),
      utils.mycountry.getCountryDashboard.invalidate(),
    ]);
  };

  const setAllocations = api.government.setAllocations.useMutation({
    onSuccess: async () => {
      setDraft({});
      await refreshGov();
      notify.success("Saved budget allocations");
    },
    onError: (err) => notify.error("Could not save budget allocations", err.message),
  });

  const addDepartment = api.government.addDepartment.useMutation({
    onSuccess: async () => {
      await refreshGov();
      notify.success("Added department");
    },
    onError: (err) => notify.error("Could not add department", err.message),
  });

  const removeDepartment = api.government.removeDepartment.useMutation({
    onSuccess: async (_res, vars) => {
      setDraft((prev) => {
        const next = { ...prev };
        delete next[vars.departmentId];
        return next;
      });
      await refreshGov();
    },
    onError: (err) => notify.error("Could not remove department", err.message),
  });

  const startBudgetYear = api.government.startBudgetYear.useMutation({
    onSuccess: async (result) => {
      setDraft({});
      await refreshGov();
      if (clock) {
        notify.success(`Started FY ${formatBudgetYear(result.toYear, clock)} budget`);
      }
    },
    onError: (err) => notify.error(err.message),
  });

  const gov = govQuery.data;
  const departments = useMemo(
    () => (gov?.departments as GovernmentDepartment[] | undefined) ?? [],
    [gov?.departments]
  );
  const budgetAllocations = useMemo(
    () => (gov?.budgetAllocations as BudgetAllocation[] | undefined) ?? [],
    [gov?.budgetAllocations]
  );

  const currentYear = clock ? currentBudgetYear(clock.now()) : new Date().getUTCFullYear();
  const effectiveYear =
    latestBudgetYearUpTo(
      budgetAllocations.map((a) => a.budgetYear),
      currentYear
    ) ?? currentYear;

  const savedByDept = useMemo(() => {
    const map: Record<string, number> = {};
    for (const dept of departments) {
      const match = budgetAllocations.find(
        (a) => a.budgetYear === effectiveYear && a.departmentId === dept.id
      );
      map[dept.id] = match?.allocatedPercent ?? 0;
    }
    return map;
  }, [departments, budgetAllocations, effectiveYear]);

  const percentOf = (deptId: string) => draft[deptId] ?? savedByDept[deptId] ?? 0;
  const changedDepts = departments.filter(
    (d) => draft[d.id] !== undefined && Math.abs(draft[d.id]! - (savedByDept[d.id] ?? 0)) > 1e-6
  );
  const dirty = changedDepts.length > 0;
  useReportDirty("budget", "Budget allocations", dirty);

  if (govQuery.isLoading || !clock) {
    return (
      <EditorSection
        id="budget"
        title="Departments and budget"
        description="Manage ministries and allocate shares of your national fiscal budget."
        icon={<Wallet />}
      >
        <Skeleton className="rounded-row h-48 w-full" aria-label="Loading budget" />
      </EditorSection>
    );
  }

  const totalBudget = gov?.totalBudget ?? 0;
  const budgetless = totalBudget <= 0 && budgetAllocations.length === 0;
  const needsNewYear =
    effectiveYear < currentYear && departments.length > 0 && budgetAllocations.length > 0;
  const yearLabel = (year: number) => formatBudgetYear(year, clock);
  const totalPercent = departments.reduce((sum, d) => sum + percentOf(d.id), 0);
  const overCap = totalPercent > ALLOCATION_PERCENT_MAX + 1e-6;
  const revenue = nationalRevenue(state);

  return (
    <EditorSection
      id="budget"
      title="Departments and budget"
      description="Manage ministries and allocate shares of your national fiscal budget."
      icon={<Wallet />}
    >
      {(departments.length === 0 || budgetless) && (
        <Signal
          tone="info"
          title={
            departments.length > 0
              ? "Departments have no budget yet"
              : "No government departments yet"
          }
        >
          <p>
            {departments.length > 0
              ? "Create an initial budget envelope to start allocating shares across your ministries."
              : "Create your government structure first to establish ministries, set a budget and appoint cabinet officials."}
          </p>
          <div className="mt-3">
            <CreateGovernmentStructureButton
              countryId={countryId}
              label={departments.length > 0 ? "Create budget" : undefined}
            />
          </div>
        </Signal>
      )}

      {needsNewYear && (
        <Signal tone="warning" title={`Fiscal year ${yearLabel(currentYear)} has begun`}>
          <p>
            Your FY {yearLabel(effectiveYear)} budget remains in effect until you carry it forward
            to FY {yearLabel(currentYear)}.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={startBudgetYear.isPending}
            onClick={() => startBudgetYear.mutate({ countryId })}
          >
            {startBudgetYear.isPending
              ? "Starting…"
              : `Start FY ${yearLabel(currentYear)} budget from FY ${yearLabel(effectiveYear)}`}
          </Button>
        </Signal>
      )}

      {departments.length > 0 && !budgetless && (
        <>
          <Card variant="well" content="data" padding="md">
            <div className="sm:divide-separator/60 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-0 sm:divide-x">
              <Stat
                size="sm"
                label="Fiscal year"
                value={`FY ${yearLabel(effectiveYear)}`}
                hint={gov?.governmentName ?? "Active budget"}
                className="sm:pr-4"
              />
              <Stat
                size="sm"
                label="Annual tax revenue"
                value={revenue.total != null ? formatCompactCurrency(revenue.total) : "Not set"}
                hint="From national tax rates"
                className="sm:px-4"
              />
              <Stat
                size="sm"
                label="Budget envelope"
                value={totalBudget > 0 ? formatCompactCurrency(totalBudget) : "Not set"}
                hint="Total available to allocate"
                className="sm:px-4"
              />
              <Stat
                size="sm"
                label="Allocated share"
                value={`${totalPercent.toFixed(1)}%`}
                hint={
                  overCap
                    ? "Exceeds 100% cap"
                    : `${Math.max(0, 100 - totalPercent).toFixed(1)}% unallocated`
                }
                className="sm:pl-4"
              />
            </div>
            <Progress
              value={Math.min(totalPercent, 100)}
              aria-hidden
              className="bg-fill-3 mt-4 h-2"
            />
            {overCap && (
              <p role="alert" className="text-destructive text-footnote mt-2">
                Total department allocations are {totalPercent.toFixed(1)}%, which exceeds 100% of
                the budget. Lower one or more shares before saving.
              </p>
            )}
          </Card>

          <div className="flex flex-col gap-3">
            {departments.map((dept, idx) => {
              const pct = percentOf(dept.id);
              const amount = allocationAmount(totalBudget, pct);
              return (
                <Card key={dept.id} variant="well" padding="md" className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: FACET_CHART_COLORS[idx % FACET_CHART_COLORS.length],
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-label text-subhead truncate font-medium">{dept.name}</p>
                        <p className="text-label-secondary text-footnote truncate">
                          {dept.category} · {dept.ministerTitle || "Minister"}:{" "}
                          {dept.minister || "Vacant"}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right tabular-nums">
                        <p className="text-label text-subhead font-semibold">
                          {formatCompactCurrency(amount)}
                        </p>
                        <p className="text-label-secondary text-footnote">{pct.toFixed(1)}%</p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${dept.name}`}
                            disabled={removeDepartment.isPending}
                            className="text-label-secondary hover:text-destructive"
                          >
                            <Trash className="size-3.5" aria-hidden="true" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {dept.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Its allocations for every year and its appointed officials are removed
                              too.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogClose asChild>
                              <Button variant="outline">Cancel</Button>
                            </AlertDialogClose>
                            <AlertDialogClose asChild>
                              <Button
                                variant="destructive"
                                onClick={() =>
                                  removeDepartment.mutate({ countryId, departmentId: dept.id })
                                }
                              >
                                Remove
                              </Button>
                            </AlertDialogClose>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Slider
                      min={0}
                      max={ALLOCATION_PERCENT_MAX}
                      step={0.5}
                      value={[pct]}
                      onValueChange={([v]) =>
                        v !== undefined && setDraft((prev) => ({ ...prev, [dept.id]: v }))
                      }
                      aria-label={`${dept.name} budget share`}
                      className="w-full"
                    />
                    <RateInput
                      value={pct}
                      min={0}
                      max={ALLOCATION_PERCENT_MAX}
                      step={0.1}
                      onCommit={(v) => setDraft((prev) => ({ ...prev, [dept.id]: v }))}
                      aria-label={`${dept.name} share of the budget, in percent`}
                    />
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SaveButton
              section="budget"
              label="Save budget allocations"
              dirty={dirty}
              invalid={overCap}
              blocked={overCap}
              pending={setAllocations.isPending}
              onSave={() =>
                setAllocations.mutate({
                  countryId,
                  allocations: changedDepts.map((d) => ({
                    departmentId: d.id,
                    allocatedPercent: percentOf(d.id),
                  })),
                })
              }
              onReset={() => setDraft({})}
            />
            <AddDepartmentDialog
              onAdd={(input) => addDepartment.mutate({ countryId, ...input })}
              pending={addDepartment.isPending}
            />
          </div>
        </>
      )}
    </EditorSection>
  );
}
