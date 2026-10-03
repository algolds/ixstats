"use client";

import { useState } from "react";
import { format } from "date-fns";
import { SystemRestart as Loader2, Plus, Group as Users, Xmark as X } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
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

const initialForm = (): AppointFormState => ({
  name: "",
  title: "",
  role: "Cabinet Member",
  appointedDate: format(new Date(), "yyyy-MM-dd"),
  bio: "",
});

const FORM_FIELDS: {
  key: keyof AppointFormState;
  label: string;
  placeholder: string;
  type?: string;
  required?: boolean;
}[] = [
  { key: "name", label: "Name", placeholder: "e.g. Elena Vance", required: true },
  { key: "title", label: "Title", placeholder: "e.g. Minister of Foreign Affairs", required: true },
  { key: "role", label: "Role", placeholder: "e.g. Cabinet member", required: true },
  { key: "appointedDate", label: "Appointed date", placeholder: "", type: "date", required: true },
];

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? "s" : ""}`;

type Structure = NonNullable<RouterOutputs["government"]["getByCountryId"]>;
type Department = NonNullable<Structure["departments"]>[number];
type Official = NonNullable<RouterOutputs["meetings"]["getOfficials"]>[number];

function DepartmentRow({
  dept,
  officials,
  onAppoint,
  onRemove,
  removing,
}: {
  dept: Department;
  officials: Official[];
  onAppoint: () => void;
  onRemove: (id: string) => void;
  /** Id of the official currently being removed, if any. */
  removing: { pending: boolean; id?: string };
}) {
  const isVacant = officials.length === 0;
  return (
    <div
      className={cn(
        "group rounded-control border p-3 transition-colors",
        isVacant
          ? "border-separator bg-fill-2 border-dashed"
          : "border-separator bg-surface-secondary"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-body truncate font-medium">{dept.name}</span>
            {isVacant ? (
              <Badge variant="outline" className="text-footnote">
                Vacant
              </Badge>
            ) : (
              <Badge variant="secondary">{plural(officials.length, "official")}</Badge>
            )}
          </div>
          {dept.ministerTitle ? (
            <p className="text-label-secondary text-footnote mt-0.5">{dept.ministerTitle}</p>
          ) : null}
        </div>

        {isVacant ? (
          <Button
            size="sm"
            variant="outline"
            className="text-footnote h-7 gap-1"
            onClick={onAppoint}
          >
            <Plus className="h-3.5 w-3.5" />
            Appoint
          </Button>
        ) : null}
      </div>

      {!isVacant && (
        <ul className="mt-2 space-y-2">
          {officials.map((official) => (
            <li
              key={official.id}
              className="rounded-control-sm bg-surface text-body flex items-center justify-between gap-2 px-2 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{official.name}</p>
                <p className="text-label-secondary text-footnote truncate">
                  {official.title}
                  {official.role ? ` · ${official.role}` : ""}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-label-secondary hover:text-destructive h-7 w-7 shrink-0"
                onClick={() => onRemove(official.id)}
                disabled={removing.pending}
                aria-label={`Remove ${official.name}`}
              >
                {removing.pending && removing.id === official.id ? (
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
}

function CabinetBody({
  loading,
  departments,
  render,
}: {
  loading: boolean;
  departments: Department[];
  render: (dept: Department) => React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-label-secondary h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (departments.length === 0) {
    return (
      <div className="text-label-secondary text-body flex flex-col items-center justify-center py-8 text-center">
        <Users className="mb-2 h-8 w-8 opacity-40" />
        <p>No government departments yet.</p>
        <p className="text-footnote mt-1">
          Create a government structure, then appoint officials here.
        </p>
      </div>
    );
  }
  return (
    <ScrollArea className="h-[440px] pr-2">
      <div className="space-y-2">{departments.map(render)}</div>
    </ScrollArea>
  );
}

export function CabinetPanel({ countryId }: CabinetPanelProps) {
  const utils = api.useUtils();
  const [dialogDepartmentId, setDialogDepartmentId] = useState<string | null>(null);
  const [form, setForm] = useState<AppointFormState>(initialForm);
  const setField = (key: keyof AppointFormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

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
      setForm(initialForm());
    },
  });

  const remove = api.meetings.removeOfficial.useMutation({
    onSuccess: () => {
      void utils.meetings.getOfficials.invalidate();
    },
  });

  const departments = structure?.departments ?? [];
  const selectedDepartment = departments.find((d) => d.id === dialogDepartmentId);

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

  return (
    <>
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-body">Cabinet</CardTitle>
              <CardDescription className="text-body">
                Appoint officials to lead each department.
              </CardDescription>
            </div>
            {departments.length > 0 && (
              <Badge variant="default" className="shrink-0">
                {plural(departments.length, "department")}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <CabinetBody
            loading={structureLoading || officialsLoading}
            departments={departments}
            render={(dept) => (
              <DepartmentRow
                key={dept.id}
                dept={dept}
                officials={officials?.filter((o) => o.departmentId === dept.id) ?? []}
                onAppoint={() => openAppointDialog(dept.id)}
                onRemove={(id) => remove.mutate({ id, reason: "Resigned" })}
                removing={{ pending: remove.isPending, id: remove.variables?.id }}
              />
            )}
          />
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
                : "Appoint a cabinet official"}
            </DialogDescription>
          </DialogHeader>

          <form id="appoint-official-form" onSubmit={handleSubmit} className="space-y-4">
            {FORM_FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={`official-${f.key}`}>{f.label}</Label>
                <Input
                  id={`official-${f.key}`}
                  type={f.type}
                  value={form[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  required={f.required}
                />
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="official-bio">Bio</Label>
              <Textarea
                id="official-bio"
                value={form.bio}
                onChange={(e) => setField("bio", e.target.value)}
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
            >
              {appoint.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Appoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
