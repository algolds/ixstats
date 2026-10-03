"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Shield,
  Dollar as DollarSign,
  Bank as Landmark,
  MapPin,
  Group as Users,
} from "iconoir-react";
import { ColorPickerInput } from "~/components/ui/color-picker";

interface AllianceCreatorSheetProps {
  countryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const ALLIANCE_TYPES = [
  {
    value: "military",
    label: "Military alliance",
    icon: Shield,
    description: "Mutual defense pact",
  },
  { value: "economic", label: "Economic bloc", icon: DollarSign, description: "Trade cooperation" },
  {
    value: "political",
    label: "Political union",
    icon: Landmark,
    description: "Governance alignment",
  },
  {
    value: "regional",
    label: "Regional bloc",
    icon: MapPin,
    description: "Geographic cooperation",
  },
] as const;

export function AllianceCreatorSheet({ open, onOpenChange, onCreated }: AllianceCreatorSheetProps) {
  const notify = useNotify();
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [type, setType] = useState<"military" | "economic" | "political" | "regional">("military");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [visibility, setVisibility] = useState<"public" | "private" | "secret">("public");
  const [joinPolicy, setJoinPolicy] = useState<"open" | "invite" | "application">("invite");

  const resetForm = () => {
    setName("");
    setShortName("");
    setType("military");
    setDescription("");
    setColor("#6366f1");
    setVisibility("public");
    setJoinPolicy("invite");
  };

  const createAlliance = api.diplomaticPolicies.createAlliance.useMutation({
    onSuccess: () => {
      notify.success("Alliance founded", `${name} is now active. Invite nations to join.`);
      onOpenChange(false);
      resetForm();
      onCreated?.();
    },
    onError: (error) => {
      let msg = error.message;
      try {
        const parsed = JSON.parse(error.message);
        if (Array.isArray(parsed) && parsed[0]?.message) {
          msg = parsed[0].message;
        }
      } catch {
        // use raw message
      }
      notify.error("Failed to create alliance", msg);
    },
  });

  const handleSubmit = () => {
    if (name.trim().length < 2) {
      notify.error("Invalid alliance name", "Alliance name must be at least 2 characters long.");
      return;
    }
    createAlliance.mutate({
      name: name.trim(),
      shortName: shortName.trim() || undefined,
      type,
      description: description.trim() || undefined,
      color,
      visibility,
      joinPolicy,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle className="flex items-center gap-2">
            <Users className="text-label-secondary h-5 w-5 shrink-0" />
            Create new alliance
          </SheetTitle>
          <p className="text-label-secondary text-body">
            Found a new alliance and invite other nations to join.
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-caption mb-2 block">Alliance name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Northern Defense Pact"
              />
            </div>
            <div>
              <Label className="text-caption mb-2 block">Short name</Label>
              <Input
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="e.g. NDP"
                maxLength={10}
              />
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-caption mb-2 block">Alliance type</Label>
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
                      <span className="text-label-secondary text-footnote">— {t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-caption mb-2 block">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the alliance's purpose and goals..."
              rows={3}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-caption mb-2 block">Color</Label>
              <ColorPickerInput value={color} onChange={(val: string) => setColor(val)} />
            </div>
            <div>
              <Label className="text-caption mb-2 block">Visibility</Label>
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
              <Label className="text-caption mb-2 block">Join policy</Label>
              <Select
                value={joinPolicy}
                onValueChange={(v) => setJoinPolicy(v as typeof joinPolicy)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="invite">Invite only</SelectItem>
                  <SelectItem value="application">Application</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <SheetFooter className="border-separator border-t px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleSubmit}
            disabled={!name.trim() || createAlliance.isPending}
          >
            <Users className="h-3 w-3" />
            {createAlliance.isPending ? "Founding..." : "Found Alliance"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
