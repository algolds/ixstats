"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
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
import { ColorPickerInput } from "~/components/ui/color-picker";
import { Slider } from "~/components/ui/slider";

const IDEOLOGY_OPTIONS = [
  { value: "far_left", label: "Far left", color: "#dc2626" },
  { value: "left", label: "Left", color: "#f97316" },
  { value: "center_left", label: "Center-left", color: "#eab308" },
  { value: "center", label: "Center", color: "#a855f7" },
  { value: "center_right", label: "Center-right", color: "#3b82f6" },
  { value: "right", label: "Right", color: "#1d4ed8" },
  { value: "far_right", label: "Far right", color: "#1e3a5f" },
] as const;

interface PartyManagerProps {
  countryId: string;
  /** When set, scroll to + highlight this party row. */
  focusId?: string | null;
}

type Party = RouterOutputs["elections"]["getParties"][number];
type Ideology = (typeof IDEOLOGY_OPTIONS)[number]["value"];

const DEFAULT_COLOR = "#6366f1";
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
    <div
      data-focus-id={party.id}
      className="hover:bg-fill-4 rounded-control flex items-center justify-between border p-3 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div
          className="h-4 w-4 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: party.color }}
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{party.name}</span>
            {party.shortName && (
              <span className="text-label-secondary text-footnote">({party.shortName})</span>
            )}
          </div>
          <div className="text-label-secondary text-footnote flex items-center gap-2">
            <Badge variant="outline" className="text-footnote">
              {ideologyLabel(party.ideology)}
            </Badge>
            {party.leaderName && <span>Led by {party.leaderName}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-headline">{party.currentSupport.toFixed(1)}%</div>
          <div className="text-label-secondary text-footnote">support</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          aria-label={`Edit ${party.name}`}
          className="h-7 w-7 p-0"
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label={`Delete ${party.name}`}
          className="text-red hover:text-red h-7 w-7 p-0"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
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
        <div>
          <Label>Party name</Label>
          <Input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. National Unity Party"
          />
        </div>
        <div>
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
        <div>
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
        <div>
          <Label>Party color</Label>
          <ColorPickerInput value={form.color} onChange={(color) => onChange({ color })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Party leader</Label>
          <Input
            value={form.leaderName}
            onChange={(e) => onChange({ leaderName: e.target.value })}
            placeholder="e.g. Jane Doe"
          />
        </div>
        <div>
          <Label>Base support ({form.baseSupport}%)</Label>
          <Slider
            aria-label="Base support"
            min={1}
            max={80}
            value={[form.baseSupport]}
            onValueChange={([v]) => v !== undefined && onChange({ baseSupport: v })}
            className="mt-2 w-full py-2"
          />
        </div>
      </div>
    </>
  );
}

export function PartyManager({ countryId, focusId }: PartyManagerProps) {
  const utils = api.useUtils();
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
  });

  const updateParty = api.elections.updateParty.useMutation({
    onSuccess: () => {
      refresh();
      setFormData(EMPTY_FORM);
      setDialogOpen(false);
      setEditingParty(null);
    },
  });

  const deleteParty = api.elections.deleteParty.useMutation({ onSuccess: refresh });

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
      updateParty.mutate({ id: editingParty, ...fields, currentSupport: formData.baseSupport });
    } else {
      createParty.mutate({ countryId, ...fields });
    }
  }

  return (
    <Card className="flex flex-col gap-6 py-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">Political parties</span>
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
              <Button size="sm" className="gap-1">
                <Plus className="h-3 w-3" /> Add party
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingParty ? "Edit party" : "Create political party"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
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
        </CardTitle>
      </CardHeader>
      <CardContent>
        {parties.length === 0 ? (
          <div className="text-label-secondary py-6 text-center">
            <p className="text-body">No political parties yet. Use Add party to create one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {parties.map((party) => (
              <PartyRow
                key={party.id}
                party={party}
                onEdit={() => startEdit(party)}
                onDelete={() => deleteParty.mutate({ id: party.id })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
