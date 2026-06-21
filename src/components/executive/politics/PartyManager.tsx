"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
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
import { Plus, Users, Trash2, Pencil } from "lucide-react";
import { api } from "~/trpc/react";
import { useScrollToFocus } from "~/hooks/useScrollToFocus";
import { ColorPickerInput } from "~/components/kibo-ui/color-picker";

const IDEOLOGY_OPTIONS = [
  { value: "far_left", label: "Far Left", color: "#dc2626" },
  { value: "left", label: "Left", color: "#f97316" },
  { value: "center_left", label: "Center-Left", color: "#eab308" },
  { value: "center", label: "Center", color: "#a855f7" },
  { value: "center_right", label: "Center-Right", color: "#3b82f6" },
  { value: "right", label: "Right", color: "#1d4ed8" },
  { value: "far_right", label: "Far Right", color: "#1e3a5f" },
] as const;

interface PartyManagerProps {
  countryId: string;
  /** When set, scroll to + highlight this party row. */
  focusId?: string | null;
}

export function PartyManager({ countryId, focusId }: PartyManagerProps) {
  const utils = api.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    shortName: "",
    ideology: "center" as string,
    color: "#6366f1",
    leaderName: "",
    baseSupport: 25,
  });

  const { data: parties = [], refetch } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  useScrollToFocus(focusId, [parties]);

  const createParty = api.elections.createParty.useMutation({
    onSuccess: () => {
      void utils.elections.getParties.invalidate({ countryId });
      void utils.elections.getCurrentParliament.invalidate({ countryId });
      refetch();
      resetForm();
      setDialogOpen(false);
    },
  });

  const updateParty = api.elections.updateParty.useMutation({
    onSuccess: () => {
      void utils.elections.getParties.invalidate({ countryId });
      void utils.elections.getCurrentParliament.invalidate({ countryId });
      refetch();
      resetForm();
      setDialogOpen(false);
      setEditingParty(null);
    },
  });

  const deleteParty = api.elections.deleteParty.useMutation({
    onSuccess: () => {
      void utils.elections.getParties.invalidate({ countryId });
      void utils.elections.getCurrentParliament.invalidate({ countryId });
      refetch();
    },
  });

  function resetForm() {
    setFormData({
      name: "",
      shortName: "",
      ideology: "center",
      color: "#6366f1",
      leaderName: "",
      baseSupport: 25,
    });
  }

  function startEdit(party: any) {
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
    if (editingParty) {
      updateParty.mutate({
        id: editingParty,
        name: formData.name,
        shortName: formData.shortName || undefined,
        ideology: formData.ideology as any,
        color: formData.color,
        leaderName: formData.leaderName || undefined,
        baseSupport: formData.baseSupport,
        currentSupport: formData.baseSupport,
      });
    } else {
      createParty.mutate({
        countryId,
        name: formData.name,
        shortName: formData.shortName || undefined,
        ideology: formData.ideology as any,
        color: formData.color,
        leaderName: formData.leaderName || undefined,
        baseSupport: formData.baseSupport,
      });
    }
  }

  const ideologyLabel = (ideology: string) =>
    IDEOLOGY_OPTIONS.find((o) => o.value === ideology)?.label ?? ideology;

  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-600" />
            Political Parties
          </span>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingParty(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-3 w-3" /> Add Party
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingParty ? "Edit Party" : "Create Political Party"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Party Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. National Unity Party"
                    />
                  </div>
                  <div>
                    <Label>Short Name</Label>
                    <Input
                      value={formData.shortName}
                      onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                      placeholder="e.g. NUP"
                      maxLength={10}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Ideology</Label>
                    <Select
                      value={formData.ideology}
                      onValueChange={(v) => {
                        const ideologyColor =
                          IDEOLOGY_OPTIONS.find((o) => o.value === v)?.color ?? "#6366f1";
                        setFormData({ ...formData, ideology: v, color: ideologyColor });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IDEOLOGY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: o.color }}
                              />
                              {o.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Party Color</Label>
                    <ColorPickerInput
                      value={formData.color}
                      onChange={(val) => setFormData({ ...formData, color: val })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Party Leader</Label>
                    <Input
                      value={formData.leaderName}
                      onChange={(e) => setFormData({ ...formData, leaderName: e.target.value })}
                      placeholder="e.g. Jane Doe"
                    />
                  </div>
                  <div>
                    <Label>Base Support ({formData.baseSupport}%)</Label>
                    <input
                      type="range"
                      min={1}
                      max={80}
                      value={formData.baseSupport}
                      onChange={(e) =>
                        setFormData({ ...formData, baseSupport: Number(e.target.value) })
                      }
                      className="mt-2 w-full"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={!formData.name || createParty.isPending || updateParty.isPending}
                  className="w-full"
                >
                  {editingParty ? "Update Party" : "Create Party"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
        <CardDescription>Manage your nation&apos;s political parties</CardDescription>
      </CardHeader>
      <CardContent>
        {parties.length === 0 ? (
          <div className="text-muted-foreground py-6 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 opacity-50" />
            <p className="text-sm">
              No political parties yet. Create your first party to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {parties.map((party: any) => (
              <div
                key={party.id}
                data-focus-id={party.id}
                className="hover:bg-muted/30 flex items-center justify-between rounded-lg border p-3 transition-colors"
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
                        <span className="text-muted-foreground text-xs">({party.shortName})</span>
                      )}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">
                        {ideologyLabel(party.ideology)}
                      </Badge>
                      {party.leaderName && <span>Led by {party.leaderName}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-sm font-semibold">{party.currentSupport.toFixed(1)}%</div>
                    <div className="text-muted-foreground text-[10px]">support</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(party)}
                    className="h-7 w-7 p-0"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteParty.mutate({ id: party.id })}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
