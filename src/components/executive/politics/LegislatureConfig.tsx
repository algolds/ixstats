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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { FloppyDisk as Save, CheckCircle } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

type SelectionMethod =
  "elected" | "appointed" | "sortition" | "hereditary" | "ex-officio" | "corporatist";
type ChamberType = "unicameral" | "bicameral" | "tricameral" | "tetracameral";
type ElectoralSystem = "proportional" | "fptp" | "mixed";

const SELECTION_METHOD_LABELS: Record<SelectionMethod, string> = {
  elected: "Elected",
  appointed: "Appointed",
  sortition: "Sortition (by lot)",
  hereditary: "Hereditary",
  "ex-officio": "Ex-officio",
  corporatist: "Corporatist (by sector)",
};

const ELECTORAL_SYSTEMS: [ElectoralSystem, string][] = [
  ["proportional", "Proportional (D'Hondt)"],
  ["fptp", "First past the post"],
  ["mixed", "Mixed (50/50)"],
];

const CHAMBER_TYPES: [ChamberType, string][] = [
  ["unicameral", "Unicameral (one chamber)"],
  ["bicameral", "Bicameral (two chambers)"],
  ["tricameral", "Tricameral (three chambers)"],
  ["tetracameral", "Tetracameral (four chambers)"],
];

const ELECTION_CYCLES = [
  ["fixed", "Fixed term"],
  ["variable", "Variable (snap elections)"],
] as const;

interface ChamberItem {
  name: string;
  seats: number;
  electoralSystem: ElectoralSystem;
  selectionMethod?: SelectionMethod;
}

const MIN_CHAMBER_SEATS = 10;
const clampSeats = (value: number, max = 5000) => Math.max(1, Math.min(max, value || 1));
const sumSeats = (chambers: ChamberItem[]) =>
  chambers.reduce((sum, c) => sum + (Number(c.seats) || 0), 0);

/** Default chambers for a chamber type: names and a seat split of `total`. */
function presetChambers(
  type: ChamberType,
  total: number,
  system: ElectoralSystem,
  unicameralName: string,
  selectionMethod?: SelectionMethod
): ChamberItem[] {
  const share = (fraction: number) => Math.max(MIN_CHAMBER_SEATS, Math.floor(total * fraction));
  const rows: [string, number][] = {
    unicameral: [[unicameralName, total]] as [string, number][],
    bicameral: [
      ["House of Representatives", Math.max(MIN_CHAMBER_SEATS, total - share(0.4))],
      ["Senate", share(0.4)],
    ] as [string, number][],
    tricameral: [
      ["House of Commons", Math.max(MIN_CHAMBER_SEATS, total - share(0.2) * 2)],
      ["Senate", share(0.2)],
      ["House of Nobles", share(0.2)],
    ] as [string, number][],
    tetracameral: [
      ["Congress of the Commons", total - share(0.25) * 3],
      ["Senate", share(0.25)],
      ["Chamber of Regions", share(0.25)],
      ["Council of State", share(0.25)],
    ] as [string, number][],
  }[type];
  return rows.map(([name, seats]) => ({ name, seats, electoralSystem: system, selectionMethod }));
}

function parseChambersClient(
  chamberType: string,
  legislatureName: string,
  totalSeats: number,
  globalElectoralSystem: string
): ChamberItem[] {
  const system = (globalElectoralSystem || "proportional") as ElectoralSystem;
  const serialized = chamberType.split("|")[1];
  if (serialized) {
    return serialized
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const [name, seatsStr, chamberSystem, selection] = part.split(":");
        return {
          name: name || "Chamber",
          seats: Number(seatsStr) || 100,
          electoralSystem: (chamberSystem || system) as ElectoralSystem,
          selectionMethod: (selection as SelectionMethod) || "elected",
        };
      });
  }

  const type = chamberType === "bicameral" ? "bicameral" : "unicameral";
  return presetChambers(
    type,
    totalSeats,
    system,
    legislatureName || "National Assembly",
    "elected"
  );
}

function SaveLabel({ saved, exists }: { saved: boolean; exists: boolean }) {
  const Icon = saved ? CheckCircle : Save;
  return (
    <>
      <Icon className="h-4 w-4" />
      {saved ? "Saved" : exists ? "Update legislature" : "Create legislature"}
    </>
  );
}

/** Reconfiguring a seated legislature dissolves it, so the save asks first. */
function DissolveConfirm({
  disabled,
  saved,
  onConfirm,
}: {
  disabled: boolean;
  saved: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled} size="sm" className="w-full gap-2">
          <SaveLabel saved={saved} exists />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dissolve the legislature?</AlertDialogTitle>
          <AlertDialogDescription>
            Every seat becomes vacant and a snap election is called. Bills cannot go to a vote until
            the election seats the parties again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={onConfirm}
          >
            Dissolve and update
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const CHAMBER_SELECT_TRIGGER =
  "bg-surface-secondary text-footnote h-8 w-full min-w-0 overflow-hidden";

function ChamberRow({
  index,
  chamber,
  onChange,
  onSeatsBlur,
}: {
  index: number;
  chamber: ChamberItem;
  onChange: (field: keyof ChamberItem, value: string) => void;
  onSeatsBlur: (value: string) => void;
}) {
  const labelClass = "text-footnote text-label-secondary";
  return (
    <div className="rounded-control border-separator bg-fill-2 grid grid-cols-1 gap-3 border p-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
        <Label className={labelClass}>Chamber {index + 1} name</Label>
        <Input
          value={chamber.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder={`Chamber ${index + 1}`}
          className="bg-surface-secondary text-footnote h-8"
        />
      </div>
      <div className="space-y-1">
        <Label className={labelClass}>Seats (10 to 5,000)</Label>
        <Input
          type="number"
          min={10}
          max={5000}
          value={chamber.seats}
          onChange={(e) => onChange("seats", e.target.value)}
          onBlur={(e) => onSeatsBlur(e.target.value)}
          className="bg-surface-secondary text-footnote h-8"
        />
      </div>
      <div className="min-w-0 space-y-1">
        <Label className={labelClass}>Electoral system</Label>
        <Select
          value={chamber.electoralSystem}
          onValueChange={(v) => onChange("electoralSystem", v)}
        >
          <SelectTrigger className={CHAMBER_SELECT_TRIGGER}>
            <SelectValue className="truncate" />
          </SelectTrigger>
          <SelectContent>
            {ELECTORAL_SYSTEMS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 space-y-1">
        <Label className={labelClass}>Selection method</Label>
        <Select
          value={chamber.selectionMethod || "elected"}
          onValueChange={(v) => onChange("selectionMethod", v)}
        >
          <SelectTrigger className={CHAMBER_SELECT_TRIGGER}>
            <SelectValue className="truncate" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SELECTION_METHOD_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ChamberLayout({
  chambers,
  onChange,
  onSeatsBlur,
}: {
  chambers: ChamberItem[];
  onChange: (index: number, field: keyof ChamberItem, value: string) => void;
  onSeatsBlur: (index: number, value: string) => void;
}) {
  return (
    <div className="rounded-control border-separator bg-fill-2 space-y-3 border p-3">
      <h4 className="text-eyebrow text-label-tertiary">Chamber layout and settings</h4>
      <div className="space-y-3">
        {chambers.map((chamber, index) => (
          <ChamberRow
            key={index}
            index={index}
            chamber={chamber}
            onChange={(field, value) => onChange(index, field, value)}
            onSeatsBlur={(value) => onSeatsBlur(index, value)}
          />
        ))}
      </div>
    </div>
  );
}

const defaultChambers = (): ChamberItem[] => [
  { name: "National Assembly", seats: 100, electoralSystem: "proportional" },
];

interface LegislatureConfigProps {
  countryId: string;
}

export function LegislatureConfig({ countryId }: LegislatureConfigProps) {
  const [formData, setFormData] = useState({
    name: "National Assembly",
    chamberType: "unicameral" as ChamberType,
    totalSeats: 100,
    electoralSystem: "proportional" as ElectoralSystem,
    termLength: 4,
    electionCycle: "fixed" as "fixed" | "variable",
  });
  const [chambers, setChambers] = useState<ChamberItem[]>(defaultChambers);
  const [saved, setSaved] = useState(false);

  const { data: legislature, refetch } = api.elections.getLegislature.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // A loaded (or refetched) legislature fills the form, during render; none keeps one default chamber.
  const [seededFrom, setSeededFrom] = useState<typeof legislature>(undefined);
  if (legislature !== seededFrom) {
    setSeededFrom(legislature);
    if (legislature) {
      setFormData({
        name: legislature.name,
        chamberType: legislature.chamberType.split("|")[0] as ChamberType,
        totalSeats: legislature.totalSeats,
        electoralSystem: legislature.electoralSystem as ElectoralSystem,
        termLength: legislature.termLength,
        electionCycle: (legislature.electionCycle as "fixed" | "variable") ?? "fixed",
      });
      setChambers(
        parseChambersClient(
          legislature.chamberType,
          legislature.name,
          legislature.totalSeats,
          legislature.electoralSystem
        )
      );
    } else {
      setChambers(defaultChambers());
    }
  }

  const utils = api.useUtils();
  const notify = useNotify();
  const configureLegislature = api.elections.configureLegislature.useMutation({
    onSuccess: () => {
      refetch();
      void utils.elections.getElectionStatus.invalidate({ countryId });
      void utils.elections.getElections.invalidate({ countryId });
      void utils.elections.getCurrentParliament.invalidate({ countryId });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (error) => notify.error("Could not save the legislature", error.message),
  });

  /**
   * Edits to the main inputs. In unicameral mode the single chamber mirrors them here, in the
   * handler: a sync effect used to run on remount with the initial "unicameral" form and replace
   * a saved multi-chamber layout with one default chamber.
   */
  const patchForm = (patch: Partial<typeof formData>) => {
    const next = { ...formData, ...patch };
    setFormData(next);
    if (next.chamberType === "unicameral") {
      setChambers((prev) => [
        {
          ...prev[0],
          name: next.name,
          seats: Number(next.totalSeats) || 100,
          electoralSystem: next.electoralSystem,
        },
      ]);
    }
  };

  function handleChamberTypeChange(type: string) {
    const newChambers = presetChambers(
      type as ChamberType,
      Number(formData.totalSeats) || 100,
      formData.electoralSystem,
      formData.name || "Parliament"
    );
    setFormData({
      ...formData,
      chamberType: type as ChamberType,
      totalSeats: sumSeats(newChambers),
    });
    setChambers(newChambers);
  }

  /** Stores per-chamber edits and totals them. */
  function commitChambers(updated: ChamberItem[]) {
    setChambers(updated);
    setFormData((prev) => ({ ...prev, totalSeats: sumSeats(updated) }));
  }

  function updateChamber(index: number, field: keyof ChamberItem, value: string) {
    commitChambers(
      chambers.map((c, idx) =>
        idx === index ? { ...c, [field]: field === "seats" ? Number(value) || 0 : value } : c
      )
    );
  }

  function handleBlurChamber(index: number, value: string) {
    commitChambers(
      chambers.map((c, idx) => (idx === index ? { ...c, seats: clampSeats(Number(value)) } : c))
    );
  }

  function handleSave() {
    const clampedChambers = chambers.map((c) => ({ ...c, seats: clampSeats(Number(c.seats)) }));
    setChambers(clampedChambers);

    const clampedTotal = clampSeats(sumSeats(clampedChambers), 10000);
    const serializedChambers = clampedChambers
      .map((c) => `${c.name}:${c.seats}:${c.electoralSystem}:${c.selectionMethod || "elected"}`)
      .join(";");
    const clampedTerm = clampSeats(Number(formData.termLength) || 4, 10);

    setFormData({ ...formData, totalSeats: clampedTotal, termLength: clampedTerm });
    configureLegislature.mutate({
      countryId,
      name: formData.name,
      chamberType: `${formData.chamberType}|${serializedChambers}`,
      totalSeats: clampedTotal,
      electoralSystem: formData.electoralSystem,
      termLength: clampedTerm,
      electionCycle: formData.electionCycle,
    });
  }

  const isMultiChamber = formData.chamberType !== "unicameral";

  return (
    <Card className="flex flex-col gap-6 py-6">
      <CardHeader>
        <CardTitle>Legislature configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Legislature name</Label>
              <Input
                value={formData.name}
                onChange={(e) => patchForm({ name: e.target.value })}
                placeholder="e.g. National Assembly"
              />
            </div>
            <div>
              <Label>Chamber type</Label>
              <Select value={formData.chamberType} onValueChange={handleChamberTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAMBER_TYPES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Total seats</Label>
              <Input
                type="number"
                min={1}
                max={isMultiChamber ? 10000 : 5000}
                value={formData.totalSeats}
                disabled={isMultiChamber}
                onChange={(e) => patchForm({ totalSeats: Number(e.target.value) || 0 })}
                onBlur={(e) => patchForm({ totalSeats: clampSeats(Number(e.target.value)) })}
              />
              <p className="text-label-secondary text-footnote mt-1">
                {isMultiChamber ? "Sum of all chambers, up to 10,000" : "1 to 5,000 seats"}
              </p>
            </div>
            <div>
              <Label>Electoral system</Label>
              <Select
                value={formData.electoralSystem}
                disabled={isMultiChamber}
                onValueChange={(v) => patchForm({ electoralSystem: v as ElectoralSystem })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ELECTORAL_SYSTEMS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isMultiChamber && (
                <p className="text-label-secondary text-footnote mt-1">Set per chamber below</p>
              )}
            </div>
            <div>
              <Label>Term length (years)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={formData.termLength}
                onChange={(e) => patchForm({ termLength: Number(e.target.value) || 1 })}
              />
            </div>
            <div>
              <Label>Election cycle</Label>
              <Select
                value={formData.electionCycle}
                onValueChange={(v) => patchForm({ electionCycle: v as "fixed" | "variable" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ELECTION_CYCLES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-label-secondary text-footnote mt-1">
                Fixed follows a strict schedule. Variable lets parliament dissolve early.
              </p>
            </div>
          </div>

          {isMultiChamber && chambers.length > 0 && (
            <ChamberLayout
              chambers={chambers}
              onChange={updateChamber}
              onSeatsBlur={handleBlurChamber}
            />
          )}

          {legislature ? (
            <>
              <p className="text-label-secondary text-footnote">
                Updating the legislature dissolves it: every seat becomes vacant and a snap election
                is called.
              </p>
              <DissolveConfirm
                disabled={!formData.name || configureLegislature.isPending}
                saved={saved}
                onConfirm={handleSave}
              />
            </>
          ) : (
            <Button
              onClick={handleSave}
              disabled={!formData.name || configureLegislature.isPending}
              size="sm"
              className="w-full gap-2"
            >
              <SaveLabel saved={saved} exists={false} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
