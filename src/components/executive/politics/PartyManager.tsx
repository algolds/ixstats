"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Plus, Trash as Trash2, EditPencil as Pencil } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useScrollToFocus } from "~/hooks/useScrollToFocus";
import { useNotify } from "~/hooks/useNotify";
import { ColorPickerInput } from "~/components/ui/color-picker";
import { Slider } from "~/components/ui/slider";
import { IDEOLOGY_OPTIONS } from "./ideologies";

interface PartyManagerProps {
  countryId: string;
  /** When set, scroll to + highlight this party row. */
  focusId?: string | null;
  /** Omit outer card chrome when nested inside an `EditorSection`. */
  embedded?: boolean;
}

type Party = RouterOutputs["elections"]["getParties"][number];
type Ideology = (typeof IDEOLOGY_OPTIONS)[number]["value"];

const DEFAULT_COLOR: string =
  IDEOLOGY_OPTIONS.find((o) => o.value === "center")?.color ?? IDEOLOGY_OPTIONS[0].color;
const EMPTY_FORM = {
  name: "",
  shortName: "",
  ideology: "center" as string,
  color: DEFAULT_COLOR,
  leaderName: "",
  baseSupport: 25,
};
type PartyForm = typeof EMPTY_FORM;

const ideologyLabel = (ideology: string) =>
  IDEOLOGY_OPTIONS.find((o) => o.value === ideology)?.label ?? ideology;

function PartyRow({
  party,
  onEdit,
  onDelete,
}: {
  party: Party;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div data-focus-id={party.id} className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="border-separator h-3.5 w-3.5 shrink-0 rounded-full border"
          style={{ backgroundColor: party.color }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-label truncate font-medium">{party.name}</span>
            {party.shortName && (
              <span className="text-label-secondary text-footnote">({party.shortName})</span>
            )}
          </div>
          <div className="text-label-secondary text-footnote flex flex-wrap items-center gap-1.5">
            <span>{ideologyLabel(party.ideology)}</span>
            {party.leaderName && <span>· Led by {party.leaderName}</span>}
            {!party.isActive && <span>· Inactive</span>}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right tabular-nums">
          <div className="text-label text-headline">{party.currentSupport.toFixed(1)}%</div>
          <div className="text-label-secondary text-footnote">support</div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${party.name}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${party.name}`}
              className="text-label-secondary hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {party.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                A party that has stood in an election is made inactive instead, so past results keep
                it. Otherwise it is removed and its seats become vacant.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                className={buttonVariants({ variant: "destructive" })}
                onClick={onDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function PartyFormFields({
  form,
  onChange,
}: {
  form: PartyForm;
  onChange: (patch: Partial<PartyForm>) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>Party name</Label>
          <Input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. National Unity Party"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Short name</Label>
          <Input
            value={form.shortName}
            onChange={(e) => onChange({ shortName: e.target.value })}
            placeholder="e.g. NUP"
            maxLength={10}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>Ideology</Label>
          <Select
            value={form.ideology}
            onValueChange={(v) =>
              onChange({
                ideology: v,
                color: IDEOLOGY_OPTIONS.find((o) => o.value === v)?.color ?? DEFAULT_COLOR,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IDEOLOGY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />
                    {o.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Party color</Label>
          <ColorPickerInput value={form.color} onChange={(color) => onChange({ color })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>Party leader</Label>
          <Input
            value={form.leaderName}
            onChange={(e) => onChange({ leaderName: e.target.value })}
            placeholder="e.g. Jane Doe"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Base support ({form.baseSupport}%)</Label>
          <Slider
            aria-label="Base support"
            min={1}
            max={80}
            value={[form.baseSupport]}
            onValueChange={([v]) => v !== undefined && onChange({ baseSupport: v })}
            className="w-full py-2"
          />
        </div>
      </div>
    </>
  );
}

export function PartyManager({ countryId, focusId, embedded = false }: PartyManagerProps) {
  const utils = api.useUtils();
  const notify = useNotify();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<string | null>(null);
  const [formData, setFormData] = useState<PartyForm>(EMPTY_FORM);

  const { data: parties = [], refetch } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  useScrollToFocus(focusId, [parties]);

  const refresh = () => {
    void utils.elections.getParties.invalidate({ countryId });
    void utils.elections.getCurrentParliament.invalidate({ countryId });
    void utils.elections.getElectionStatus.invalidate({ countryId });
    refetch();
  };

  const createParty = api.elections.createParty.useMutation({
    onSuccess: () => {
      refresh();
      setFormData(EMPTY_FORM);
      setDialogOpen(false);
    },
    onError: (error) => notify.error("Could not create the party", error.message),
  });

  const updateParty = api.elections.updateParty.useMutation({
    onSuccess: () => {
      refresh();
      setFormData(EMPTY_FORM);
      setDialogOpen(false);
      setEditingParty(null);
    },
    onError: (error) => notify.error("Could not update the party", error.message),
  });

  const deleteParty = api.elections.deleteParty.useMutation({
    onSuccess: (result) => {
      if (result.deactivated) {
        notify.success("Party made inactive", "It stood in an election, so its results are kept");
      }
      refresh();
    },
    onError: (error) => notify.error("Could not delete the party", error.message),
  });

  function startEdit(party: Party) {
    setEditingParty(party.id);
    setFormData({
      name: party.name,
      shortName: party.shortName ?? "",
      ideology: party.ideology,
      color: party.color,
      leaderName: party.leaderName ?? "",
      baseSupport: party.baseSupport,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    const fields = {
      name: formData.name,
      shortName: formData.shortName || undefined,
      ideology: formData.ideology as Ideology,
      color: formData.color,
      leaderName: formData.leaderName || undefined,
      baseSupport: formData.baseSupport,
    };
    if (editingParty) {
      updateParty.mutate({ id: editingParty, ...fields });
    } else {
      createParty.mutate({ countryId, ...fields });
    }
  }

  const addPartyDialog = (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingParty(null);
          setFormData(EMPTY_FORM);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Add party
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingParty ? "Edit party" : "Create political party"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <PartyFormFields
            form={formData}
            onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
          />
          <Button
            onClick={handleSubmit}
            disabled={!formData.name || createParty.isPending || updateParty.isPending}
            className="w-full"
          >
            {editingParty ? "Update party" : "Create party"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const listBody =
    parties.length === 0 ? (
      <div className="p-4">
        <EmptyState
          compact
          title="No political parties yet"
          message="Use Add party to create one."
        />
      </div>
    ) : (
      <div className="divide-separator/60 divide-y">
        {parties.map((party) => (
          <PartyRow
            key={party.id}
            party={party}
            onEdit={() => startEdit(party)}
            onDelete={() => deleteParty.mutate({ id: party.id })}
          />
        ))}
      </div>
    );

  if (embedded) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-label-secondary text-footnote tabular-nums">
            {parties.length} {parties.length === 1 ? "party" : "parties"}
          </span>
          {addPartyDialog}
        </div>
        <Card variant="well" content="data" padding="none">
          {listBody}
        </Card>
      </div>
    );
  }

  return (
    <Card content="data" padding="none">
      <CardHeader className="border-separator/60 border-b p-4">
        <CardTitle className="flex items-center justify-between">
          <span className="text-headline flex items-center gap-2">Political parties</span>
          {addPartyDialog}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">{listBody}</CardContent>
    </Card>
  );
}
