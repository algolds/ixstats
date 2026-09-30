"use client";

import { useMemo, useState } from "react";
import {
  Suitcase as Briefcase,
  SystemRestart as Loader2,
  Plus,
  Group as Users,
  Xmark as X,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

interface CabinetPanelProps {
  countryId: string;
}

interface AppointFormState {
  name: string;
  title: string;
  role: string;
  appointedDate: string;
  bio: string;
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CabinetPanel({ countryId }: CabinetPanelProps) {
  const utils = api.useUtils();
  const [dialogDepartmentId, setDialogDepartmentId] = useState<string | null>(null);
  const [form, setForm] = useState<AppointFormState>({
    name: "",
    title: "",
    role: "Cabinet Member",
    appointedDate: formatDateInput(new Date()),
    bio: "",
  });

  const { data: structure, isLoading: structureLoading } = api.government.getByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const structureId = structure?.id;
  const { data: officials, isLoading: officialsLoading } = api.meetings.getOfficials.useQuery(
    { governmentStructureId: structureId, active: true },
    { enabled: !!structureId }
  );

  const appoint = api.meetings.appointOfficial.useMutation({
    onSuccess: () => {
      void utils.meetings.getOfficials.invalidate();
      setDialogDepartmentId(null);
      setForm({
        name: "",
        title: "",
        role: "Cabinet Member",
        appointedDate: formatDateInput(new Date()),
        bio: "",
      });
    },
  });

  const remove = api.meetings.removeOfficial.useMutation({
    onSuccess: () => {
      void utils.meetings.getOfficials.invalidate();
    },
  });

  const departments = useMemo(() => structure?.departments ?? [], [structure?.departments]);

  const officialsByDepartment = useMemo(() => {
    const map = new Map<string, typeof officials>();
    for (const dept of departments) {
      map.set(dept.id, officials?.filter((o) => o.departmentId === dept.id) ?? []);
    }
    return map;
  }, [departments, officials]);

  const selectedDepartment = useMemo(
    () => departments.find((d) => d.id === dialogDepartmentId),
    [departments, dialogDepartmentId]
  );

  const openAppointDialog = (departmentId: string) => {
    const dept = departments.find((d) => d.id === departmentId);
    setForm((prev) => ({
      ...prev,
      title: dept?.ministerTitle || "Minister",
      role: "Cabinet Member",
    }));
    setDialogDepartmentId(departmentId);
  };

  const canSubmit = form.name.trim() && form.title.trim() && form.role.trim() && form.appointedDate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !dialogDepartmentId || !structureId) return;

    appoint.mutate({
      governmentStructureId: structureId,
      departmentId: dialogDepartmentId,
      name: form.name.trim(),
      title: form.title.trim(),
      role: form.role.trim(),
      appointedDate: new Date(form.appointedDate),
      bio: form.bio.trim() || undefined,
    });
  };

  const isLoading = structureLoading || officialsLoading;

  return (
    <>
      <Card className="border-indigo-200/60 dark:border-indigo-900/40">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/40">
                <Briefcase className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-base">Cabinet</CardTitle>
                <CardDescription className="text-sm">
                  Appoint officials to lead government departments
                </CardDescription>
              </div>
            </div>
            {departments.length > 0 && (
              <Badge variant="secondary" className="shrink-0">
                {departments.length} department{departments.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : departments.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center py-8 text-center text-sm">
              <Users className="mb-2 h-8 w-8 opacity-40" />
              <p>No government departments configured yet.</p>
              <p className="mt-1 text-xs">
                Create a government structure to start staffing your cabinet.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[440px] pr-2">
              <div className="space-y-2">
                {departments.map((dept) => {
                  const deptOfficials = officialsByDepartment.get(dept.id) ?? [];
                  const isVacant = deptOfficials.length === 0;

                  return (
                    <div
                      key={dept.id}
                      className={cn(
                        "group rounded-lg border p-3 transition-colors",
                        isVacant
                          ? "border-dashed border-neutral-200 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-900/30"
                          : "border-indigo-100 bg-indigo-50/30 dark:border-indigo-900/30 dark:bg-indigo-950/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{dept.name}</span>
                            {isVacant ? (
                              <Badge variant="outline" className="text-xs">
                                Vacant
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                              >
                                {deptOfficials.length} official
                                {deptOfficials.length !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                          {dept.ministerTitle ? (
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {dept.ministerTitle}
                            </p>
                          ) : null}
                        </div>

                        {isVacant ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 border-indigo-200 text-xs text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                            onClick={() => openAppointDialog(dept.id)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Appoint
                          </Button>
                        ) : null}
                      </div>

                      {!isVacant && (
                        <ul className="mt-2 space-y-1.5">
                          {deptOfficials.map((official) => (
                            <li
                              key={official.id}
                              className="flex items-center justify-between gap-2 rounded-md bg-white/60 px-2 py-1.5 text-sm dark:bg-black/20"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{official.name}</p>
                                <p className="text-muted-foreground truncate text-xs">
                                  {official.title}
                                  {official.role ? ` · ${official.role}` : ""}
                                </p>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive h-7 w-7 shrink-0"
                                onClick={() =>
                                  remove.mutate({ id: official.id, reason: "Resigned" })
                                }
                                disabled={remove.isPending}
                                aria-label={`Remove ${official.name}`}
                              >
                                {remove.isPending && remove.variables?.id === official.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!dialogDepartmentId}
        onOpenChange={(open) => !open && setDialogDepartmentId(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Appoint official</DialogTitle>
            <DialogDescription>
              {selectedDepartment
                ? `Appoint a ${selectedDepartment.ministerTitle || "Minister"} to ${selectedDepartment.name}`
                : "Appoint a new cabinet official"}
            </DialogDescription>
          </DialogHeader>

          <form id="appoint-official-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="official-name">Name</Label>
              <Input
                id="official-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Elena Vance"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="official-title">Title</Label>
              <Input
                id="official-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Minister of Foreign Affairs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="official-role">Role</Label>
              <Input
                id="official-role"
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                placeholder="e.g. Cabinet Member"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="official-date">Appointed date</Label>
              <Input
                id="official-date"
                type="date"
                value={form.appointedDate}
                onChange={(e) => setForm((prev) => ({ ...prev, appointedDate: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="official-bio">Bio</Label>
              <Textarea
                id="official-bio"
                value={form.bio}
                onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
                placeholder="Short background (optional)"
                rows={3}
              />
            </div>
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogDepartmentId(null)}
              disabled={appoint.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="appoint-official-form"
              disabled={!canSubmit || appoint.isPending}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {appoint.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-4 w-4" />
              )}
              Appoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
