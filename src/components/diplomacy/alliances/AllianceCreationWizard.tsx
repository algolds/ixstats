"use client";

import { useState } from "react";
import { Loader2, Shield, DollarSign, Landmark, MapPin } from "lucide-react";
import { ColorPickerInput } from "~/components/kibo-ui/color-picker";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";

interface AllianceCreationWizardProps {
  onSuccess?: () => void;
}

const ALLIANCE_TYPES = [
  {
    value: "military",
    label: "Military Alliance",
    icon: Shield,
    description: "Mutual defense pact",
  },
  { value: "economic", label: "Economic Bloc", icon: DollarSign, description: "Trade cooperation" },
  {
    value: "political",
    label: "Political Union",
    icon: Landmark,
    description: "Governance alignment",
  },
  {
    value: "regional",
    label: "Regional Bloc",
    icon: MapPin,
    description: "Geographic cooperation",
  },
] as const;

export function AllianceCreationWizard({ onSuccess }: AllianceCreationWizardProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [type, setType] = useState<"military" | "economic" | "political" | "regional">("military");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [visibility, setVisibility] = useState<"public" | "private" | "secret">("public");
  const [joinPolicy, setJoinPolicy] = useState<"open" | "invite" | "application">("invite");

  const createMutation = api.diplomaticPolicies.createAlliance.useMutation({
    onSuccess: () => {
      setOpen(false);
      setName("");
      setShortName("");
      setDescription("");
      onSuccess?.();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
          Create Alliance
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Alliance</DialogTitle>
          <DialogDescription>
            Found a new alliance and invite other nations to join.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Alliance Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Northern Defense Pact"
              />
            </div>
            <div>
              <Label>Short Name</Label>
              <Input
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="e.g. NDP"
                maxLength={10}
              />
            </div>
          </div>

          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALLIANCE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <t.icon className="h-4 w-4" />
                      <span>{t.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the alliance's purpose and goals..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Color</Label>
              <ColorPickerInput value={color} onChange={(val) => setColor(val)} />
            </div>
            <div>
              <Label>Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as typeof visibility)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="secret">Secret</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Join Policy</Label>
              <Select
                value={joinPolicy}
                onValueChange={(v) => setJoinPolicy(v as typeof joinPolicy)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="invite">Invite Only</SelectItem>
                  <SelectItem value="application">Application</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {createMutation.error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
              {createMutation.error.message}
            </div>
          )}

          <Button
            onClick={() =>
              createMutation.mutate({
                name,
                shortName: shortName || undefined,
                type,
                description: description || undefined,
                color,
                visibility,
                joinPolicy,
              })
            }
            disabled={!name || createMutation.isPending}
            className="w-full"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Found Alliance"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
