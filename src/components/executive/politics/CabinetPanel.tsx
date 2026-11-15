"use client";

import { useState } from "react";
import { format } from "date-fns";
import { SystemRestart as Loader2, Plus, Group as Users, Xmark as X } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
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
import { Textarea } from "~/components/ui/textarea";
import { CreateGovernmentStructureButton } from "~/components/mycountry/domains/government/CreateGovernmentStructureButton";

interface CabinetPanelProps {
  countryId: string;
  /** Omit outer card chrome when nested inside an `EditorSection`. */
  embedded?: boolean;
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
type Official = NonNullable<RouterOutputs["government"]["getOfficials"]>[number];

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
    <div className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-label text-body truncate font-medium">{dept.name}</span>
            {isVacant ? (
              <Badge variant="outline" className="text-footnote">
                Vacant
              </Badge>
            ) : (
              <span className="text-label-secondary text-footnote">
                {plural(officials.length, "official")}
              </span>
            )}
          </div>
          {dept.ministerTitle ? (
            <p className="text-label-secondary text-footnote mt-0.5">{dept.ministerTitle}</p>
          ) : null}
        </div>

        {isVacant ? (
          <Button size="sm" variant="outline" className="gap-1" onClick={onAppoint}>
            <Plus className="h-3.5 w-3.5" />
            Appoint
          </Button>
        ) : null}
      </div>

      {!isVacant && (
        <ul className="border-separator/50 divide-separator/50 mt-2.5 divide-y border-t pt-2">
          {officials.map((official) => (
            <li
              key={official.id}
              className="text-body flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-label truncate font-medium">{official.name}</p>
                <p className="text-label-secondary text-footnote truncate">
                  {official.title}
                  {official.role ? ` · ${official.role}` : ""}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-label-secondary hover:text-destructive shrink-0"
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
  countryId,
  loading,
  departments,
  render,
}: {
  countryId: string;
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
      <div className="p-4">
        <EmptyState
          compact
          icon={<Users />}
          title="No government departments yet"
          message="Create your government's departments, then appoint officials here."
          action={<CreateGovernmentStructureButton countryId={countryId} />}
        />
      </div>
    );
  }
  return <div className="divide-separator/60 divide-y">{departments.map(render)}</div>;
}

export function CabinetPanel({ countryId, embedded = false }: CabinetPanelProps) {
  const utils = api.useUtils();
  const notify = useNotify();
  const [dialogDepartmentId, setDialogDepartmentId] = useState<string | null>(null);
  const [form, setForm] = useState<AppointFormState>(initialForm);
  const setField = (key: keyof AppointFormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const { data: structure, isLoading: structureLoading } = api.government.getByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const structureId = structure?.id;
  const { data: officials, isLoading: officialsLoading } = api.government.getOfficials.useQuery(
    { governmentStructureId: structureId, active: true },
    { enabled: !!structureId }
  );

  const appoint = api.government.appointOfficial.useMutation({
    onSuccess: () => {
      void utils.government.getOfficials.invalidate();
      setDialogDepartmentId(null);
      setForm(initialForm());
    },
    onError: (error) => notify.error("Could not appoint the official", error.message),
  });

  const remove = api.government.removeOfficial.useMutation({
    onSuccess: () => {
      void utils.government.getOfficials.invalidate();
    },
    onError: (error) => notify.error("Could not remove the official", error.message),
  });

  const departments = structure?.departments ?? [];
  const selectedDepartment = departments.find((d) => d.id === dialogDepartmentId);

  const openAppointDialog = (departmentId: string) => {
    const dept = departments.find((d) => d.id === departmentId);
    setForm((prev) => ({
      ...prev,
      title: dept?.ministerTitle || "Minister",
      role: "Cabinet member",
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

  const body = (
    <CabinetBody
      countryId={countryId}
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
  );

  return (
    <>
      {embedded ? (
        <div className="flex flex-col gap-3">
          {departments.length > 0 && (
            <p className="text-label-secondary text-footnote tabular-nums">
              {plural(departments.length, "department")}
            </p>
          )}
          <Card variant="well" content="data" padding="none">
            {body}
          </Card>
        </div>
      ) : (
        <Card content="data" padding="none">
          <CardHeader className="border-separator/60 border-b p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-headline">Cabinet</CardTitle>
                <CardDescription className="text-footnote mt-0.5">
                  Appoint officials to lead each department.
                </CardDescription>
              </div>
              {departments.length > 0 && (
                <span className="text-label-secondary text-footnote shrink-0 tabular-nums">
                  {plural(departments.length, "department")}
                </span>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">{body}</CardContent>
        </Card>
      )}

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

          <form id="appoint-official-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            {FORM_FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-2">
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

            <div className="flex flex-col gap-2">
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
