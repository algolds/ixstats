"use client";

import { useState } from "react";
import { useNotify } from "~/hooks/useNotify";
import { useLocalActions } from "~/hooks/useLocalActions";
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
import { Shield, DollarSign, Landmark, MapPin, Users, Loader2 } from "lucide-react";
import { ColorPickerInput } from "~/components/kibo-ui/color-picker";

interface AllianceCreatorSheetProps {
  countryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
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

export function AllianceCreatorSheet({
  countryId,
  open,
  onOpenChange,
  onCreated,
}: AllianceCreatorSheetProps) {
  const notify = useNotify();
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [type, setType] = useState<"military" | "economic" | "political" | "regional">("military");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [visibility, setVisibility] = useState<"public" | "private" | "secret">("public");
  const [joinPolicy, setJoinPolicy] = useState<"open" | "invite" | "application">("invite");
  const { saveAction } = useLocalActions(countryId);

  const resetForm = () => {
    setName("");
    setShortName("");
    setType("military");
    setDescription("");
    setColor("#6366f1");
    setVisibility("public");
    setJoinPolicy("invite");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0 sm:max-w-lg">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 shrink-0 text-cyan-500" />
            Create New Alliance
          </SheetTitle>
          <p className="text-muted-foreground text-sm">
            Found a new alliance and invite other nations to join.
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {/* Name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-medium">Alliance Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Northern Defense Pact"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium">Short Name</Label>
              <Input
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="e.g. NDP"
                maxLength={10}
              />
            </div>
          </div>

          <Separator />

          {/* Type */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium">Alliance Type</Label>
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
                      <span className="text-muted-foreground text-xs">— {t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the alliance's purpose and goals..."
              rows={3}
            />
          </div>

          <Separator />

          {/* Settings row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-medium">Color</Label>
              <ColorPickerInput value={color} onChange={(val) => setColor(val)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium">Visibility</Label>
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
              <Label className="mb-1.5 block text-xs font-medium">Join Policy</Label>
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
        </div>

        <SheetFooter className="border-border/50 border-t px-6 py-4">
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
            className="gap-1.5"
            onClick={() => {
              saveAction("alliance_created", {
                name,
                shortName: shortName || undefined,
                type,
                description: description || undefined,
                color,
                visibility,
                joinPolicy,
              });
              notify.success("Alliance created locally!");
              onOpenChange(false);
              resetForm();
              onCreated?.();
            }}
            disabled={!name.trim()}
          >
            <Users className="h-3 w-3" />
            Found Alliance
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
