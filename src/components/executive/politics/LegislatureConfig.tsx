// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Landmark, Save, CheckCircle } from "lucide-react";
import { api } from "~/trpc/react";

interface ChamberItem {
  name: string;
  seats: number;
  electoralSystem: "proportional" | "fptp" | "mixed";
}

function parseChambersClient(
  chamberType: string,
  legislatureName: string,
  totalSeats: number,
  globalElectoralSystem: string
): ChamberItem[] {
  if (chamberType && chamberType.includes("|")) {
    const [, serialized] = chamberType.split("|");
    if (serialized) {
      const parts = serialized.split(";").filter(Boolean);
      return parts.map((part) => {
        const [name, seatsStr, system] = part.split(":");
        return {
          name: name || "Chamber",
          seats: Number(seatsStr) || 100,
          electoralSystem: (system || globalElectoralSystem || "proportional") as any,
        };
      });
    }
  }

  const system = (globalElectoralSystem || "proportional") as any;
  if (chamberType === "bicameral") {
    const senateSeats = Math.max(10, Math.floor(totalSeats * 0.4));
    const houseSeats = Math.max(10, totalSeats - senateSeats);
    return [
      { name: "House of Representatives", seats: houseSeats, electoralSystem: system },
      { name: "Senate", seats: senateSeats, electoralSystem: system },
    ];
  }

  return [
    { name: legislatureName || "National Assembly", seats: totalSeats, electoralSystem: system },
  ];
}

interface LegislatureConfigProps {
  countryId: string;
}

export function LegislatureConfig({ countryId }: LegislatureConfigProps) {
  const [formData, setFormData] = useState({
    name: "National Assembly",
    chamberType: "unicameral" as "unicameral" | "bicameral" | "tricameral" | "tetracameral",
    totalSeats: 100,
    electoralSystem: "proportional" as "proportional" | "fptp" | "mixed",
    termLength: 4,
    electionCycle: "fixed" as "fixed" | "variable",
  });
  const [chambers, setChambers] = useState<ChamberItem[]>([]);
  const [saved, setSaved] = useState(false);
  // Track whether per-chamber edits are in progress to prevent the
  // unicameral sync effect from overwriting manual seat edits
  const chamberEditInProgress = useRef(false);

  const { data: legislature, refetch } = api.elections.getLegislature.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  useEffect(() => {
    if (legislature) {
      const parsed = parseChambersClient(
        legislature.chamberType,
        legislature.name,
        legislature.totalSeats,
        legislature.electoralSystem
      );

      let baseChamberType = legislature.chamberType;
      if (legislature.chamberType.includes("|")) {
        baseChamberType = legislature.chamberType.split("|")[0]!;
      }

      setFormData({
        name: legislature.name,
        chamberType: baseChamberType as any,
        totalSeats: legislature.totalSeats,
        electoralSystem: legislature.electoralSystem as "proportional" | "fptp" | "mixed",
        termLength: legislature.termLength,
        electionCycle: (legislature.electionCycle as "fixed" | "variable") ?? "fixed",
      });
      setChambers(parsed);
    } else {
      setChambers([{ name: "National Assembly", seats: 100, electoralSystem: "proportional" }]);
    }
  }, [legislature]);

  // Sync single chamber config with main inputs if in unicameral mode.
  // Skip when the totalSeats change originated from a per-chamber edit
  // (the updateChamber handler sets chamberEditInProgress.current = true).
  useEffect(() => {
    if (chamberEditInProgress.current) {
      chamberEditInProgress.current = false;
      return;
    }
    if (formData.chamberType === "unicameral") {
      setChambers([
        {
          name: formData.name,
          seats: Number(formData.totalSeats) || 100,
          electoralSystem: formData.electoralSystem,
        },
      ]);
    }
  }, [formData.chamberType, formData.name, formData.totalSeats, formData.electoralSystem]);

  const configureLegislature = api.elections.configureLegislature.useMutation({
    onSuccess: () => {
      refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function handleChamberTypeChange(type: string) {
    let newChambers: ChamberItem[] = [];
    const currentName = formData.name || "Parliament";
    const currentSys = formData.electoralSystem;
    const currentSeats = Number(formData.totalSeats) || 100;

    if (type === "unicameral") {
      newChambers = [{ name: currentName, seats: currentSeats, electoralSystem: currentSys }];
    } else if (type === "bicameral") {
      const senateSeats = Math.max(10, Math.floor(currentSeats * 0.4));
      const houseSeats = Math.max(10, currentSeats - senateSeats);
      newChambers = [
        { name: "House of Representatives", seats: houseSeats, electoralSystem: currentSys },
        { name: "Senate", seats: senateSeats, electoralSystem: currentSys },
      ];
    } else if (type === "tricameral") {
      const senateSeats = Math.max(10, Math.floor(currentSeats * 0.2));
      const chamber3Seats = Math.max(10, Math.floor(currentSeats * 0.2));
      const houseSeats = Math.max(10, currentSeats - senateSeats - chamber3Seats);
      newChambers = [
        { name: "House of Commons", seats: houseSeats, electoralSystem: currentSys },
        { name: "Senate", seats: senateSeats, electoralSystem: currentSys },
        { name: "House of Nobles", seats: chamber3Seats, electoralSystem: currentSys },
      ];
    } else if (type === "tetracameral") {
      const seatPart = Math.max(10, Math.floor(currentSeats / 4));
      newChambers = [
        {
          name: "Congress of the Commons",
          seats: currentSeats - seatPart * 3,
          electoralSystem: currentSys,
        },
        { name: "Senate", seats: seatPart, electoralSystem: currentSys },
        { name: "Chamber of Regions", seats: seatPart, electoralSystem: currentSys },
        { name: "Council of State", seats: seatPart, electoralSystem: currentSys },
      ];
    }

    const newTotal = newChambers.reduce((acc, c) => acc + c.seats, 0);
    setFormData({ ...formData, chamberType: type as any, totalSeats: newTotal });
    setChambers(newChambers);
  }

  function updateChamber(index: number, field: keyof ChamberItem, value: any) {
    const updated = chambers.map((c, idx) => {
      if (idx === index) {
        if (field === "seats") {
          const num = Math.max(10, Math.min(5000, Number(value) || 10));
          return { ...c, [field]: num };
        }
        return { ...c, [field]: value };
      }
      return c;
    });
    setChambers(updated);

    const newTotal = updated.reduce((acc, c) => acc + c.seats, 0);
    // Flag that this totalSeats change is from a per-chamber edit,
    // so the unicameral sync effect (which depends on totalSeats) won't
    // overwrite the user's manual edits.
    chamberEditInProgress.current = true;
    setFormData((prev) => ({ ...prev, totalSeats: newTotal }));
  }

  function handleSave() {
    const computedTotal = chambers.reduce((acc, c) => acc + c.seats, 0);
    const clampedTotal = Math.max(10, Math.min(10000, computedTotal));

    const serializedChambers = chambers
      .map((c) => `${c.name}:${c.seats}:${c.electoralSystem}`)
      .join(";");
    const fullChamberType = `${formData.chamberType}|${serializedChambers}`;

    const clampedTerm = Math.max(1, Math.min(10, Number(formData.termLength) || 4));

    setFormData({ ...formData, totalSeats: clampedTotal, termLength: clampedTerm });
    configureLegislature.mutate({
      countryId,
      name: formData.name,
      chamberType: fullChamberType,
      totalSeats: clampedTotal,
      electoralSystem: formData.electoralSystem,
      termLength: clampedTerm,
      electionCycle: formData.electionCycle,
    });
  }

  const isMultiChamber = formData.chamberType !== "unicameral";

  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-amber-600" />
          Legislature Configuration
        </CardTitle>
        <CardDescription>
          {legislature
            ? "Modify your parliament structure"
            : "Set up your nation's legislative body"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Legislature Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. National Assembly"
              />
            </div>
            <div>
              <Label>Chamber Type</Label>
              <Select value={formData.chamberType} onValueChange={handleChamberTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unicameral">Unicameral (Single chamber)</SelectItem>
                  <SelectItem value="bicameral">Bicameral (Two chambers)</SelectItem>
                  <SelectItem value="tricameral">Tricameral (Three chambers)</SelectItem>
                  <SelectItem value="tetracameral">Tetracameral (Four chambers)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Total Seats</Label>
              <Input
                type="number"
                min={10}
                max={isMultiChamber ? 10000 : 5000}
                value={formData.totalSeats}
                disabled={isMultiChamber}
                onChange={(e) =>
                  setFormData({ ...formData, totalSeats: Number(e.target.value) || 10 })
                }
              />
              <p className="text-muted-foreground mt-1 text-[10px]">
                {isMultiChamber
                  ? "Calculated as sum of all chambers (up to 10,000)"
                  : "10-5,000 seats"}
              </p>
            </div>
            <div>
              <Label>Electoral System</Label>
              <Select
                value={formData.electoralSystem}
                disabled={isMultiChamber}
                onValueChange={(v) => setFormData({ ...formData, electoralSystem: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proportional">Proportional (D&apos;Hondt)</SelectItem>
                  <SelectItem value="fptp">First Past the Post</SelectItem>
                  <SelectItem value="mixed">Mixed (50/50)</SelectItem>
                </SelectContent>
              </Select>
              {isMultiChamber && (
                <p className="text-muted-foreground mt-1 text-[10px]">
                  Configured individually per chamber below
                </p>
              )}
            </div>
            <div>
              <Label>Term Length (years)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={formData.termLength}
                onChange={(e) => setFormData({ ...formData, termLength: e.target.value })}
              />
            </div>
            <div>
              <Label>Election Cycle</Label>
              <Select
                value={formData.electionCycle}
                onValueChange={(v) => setFormData({ ...formData, electionCycle: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Term</SelectItem>
                  <SelectItem value="variable">Variable (snap elections)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground mt-1 text-[10px]">
                Fixed = strict schedule; Variable = parliament may dissolve early
              </p>
            </div>
          </div>

          {/* Chamber Layout & Customizations */}
          {isMultiChamber && chambers.length > 0 && (
            <div className="space-y-3 rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
              <h4 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
                Chamber Layout & Settings
              </h4>
              <div className="space-y-3">
                {chambers.map((chamber, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 sm:grid-cols-3"
                  >
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-400">Chamber {index + 1} Name</Label>
                      <Input
                        value={chamber.name}
                        onChange={(e) => updateChamber(index, "name", e.target.value)}
                        placeholder={`Chamber ${index + 1}`}
                        className="h-8 bg-slate-900 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-400">Seats (10 - 5,000)</Label>
                      <Input
                        type="number"
                        min={10}
                        max={5000}
                        value={chamber.seats}
                        onChange={(e) => updateChamber(index, "seats", e.target.value)}
                        className="h-8 bg-slate-900 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-400">Electoral System</Label>
                      <Select
                        value={chamber.electoralSystem}
                        onValueChange={(v) => updateChamber(index, "electoralSystem", v)}
                      >
                        <SelectTrigger className="h-8 bg-slate-900 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proportional">Proportional (D&apos;Hondt)</SelectItem>
                          <SelectItem value="fptp">First Past the Post</SelectItem>
                          <SelectItem value="mixed">Mixed (50/50)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={!formData.name || configureLegislature.isPending}
            size="sm"
            className="w-full gap-2"
          >
            {saved ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {legislature ? "Update Legislature" : "Create Legislature"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
