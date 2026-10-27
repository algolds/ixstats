"use client";

import type { ReactNode } from "react";
import { Check } from "iconoir-react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { useVexelEditor } from "../VexelEditorProvider";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import {
  TINCTURE_HEX,
  DIVISIONS,
  ORDINARIES,
  LINE_STYLES,
  SHIELD_SHAPES,
  ATTITUDES,
  HELM_TYPES,
  DIVISION_SECTIONS_COUNT,
} from "~/lib/heraldry";
import type {
  Tincture,
  Division,
  OrdinaryType,
  LineStyle,
  ShieldShape,
  Attitude,
  HelmType,
} from "~/lib/heraldry";
import { Card } from "~/components/ui/card";

const parseIndex = (path: string) => {
  const match = path.match(/\[(\d+)\]/);
  return match ? parseInt(match[1]!, 10) : null;
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function TincturePicker({ value, onChange }: { value: Tincture; onChange: (t: Tincture) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Tincture"
      className="bg-surface-secondary rounded-control mt-1 grid grid-cols-4 gap-2 p-2"
    >
      {(Object.keys(TINCTURE_HEX) as Tincture[]).map((key) => {
        const isSelected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={capitalize(key)}
            title={capitalize(key)}
            onClick={() => onChange(key)}
            className={`rounded-control-sm focus-visible:outline-tint relative h-7 w-full border transition-[border-color,box-shadow,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 ${
              isSelected
                ? "border-tint ring-tint ring-2"
                : "border-separator opacity-70 hover:opacity-100"
            }`}
            style={{ backgroundColor: TINCTURE_HEX[key] }}
          >
            {isSelected && (
              <span className="bg-fill-3 text-label rounded-control-sm absolute inset-0 flex items-center justify-center">
                <Check className="h-3.5 w-3.5" aria-hidden />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PanelShell({
  title,
  bodyClassName = "",
  titleClassName = "",
  children,
}: {
  title: ReactNode;
  bodyClassName?: string;
  titleClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className={`text-footnote flex flex-col gap-4 p-4 ${bodyClassName}`}>
        <Eyebrow className={`border-separator block border-b pb-2 ${titleClassName}`}>
          {title}
        </Eyebrow>
        {children}
      </div>
    </Card>
  );
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="space-y-1">
    <label className="text-label-secondary font-medium">{label}</label>
    {children}
  </div>
);

/** A field below a divider rule (tincture pickers, toggles). */
const Section = ({
  children,
  className = "space-y-1",
}: {
  children: ReactNode;
  className?: string;
}) => <div className={`border-separator border-t pt-2 ${className}`}>{children}</div>;

function ShieldPanel() {
  const { composition, updateComposition } = useVexelEditor();
  return (
    <PanelShell title="Shield properties">
      <Field label="Shape">
        <OptionSelect
          aria-label="Shape"
          value={composition.shield.shape}
          onValueChange={(v) =>
            updateComposition({
              ...composition,
              shield: { ...composition.shield, shape: v as ShieldShape },
            })
          }
          options={SHIELD_SHAPES}
        />
      </Field>
    </PanelShell>
  );
}

function FieldPanel() {
  const { composition, updateField } = useVexelEditor();
  const field = composition.shield.field;
  const expectedCount = DIVISION_SECTIONS_COUNT[field.division] ?? 1;

  // Pad with argent or slice the tinctures to fit the new division's section count.
  const handleDivisionChange = (division: Division) => {
    const nextCount = DIVISION_SECTIONS_COUNT[division] ?? 1;
    const tinctures = Array.from(
      { length: nextCount },
      (_, i) => field.tinctures[i] ?? ("argent" as Tincture)
    );
    updateField({ ...field, division, tinctures });
  };

  const handleTinctureChange = (index: number, tincture: Tincture) => {
    const tinctures = [...field.tinctures];
    tinctures[index] = tincture;
    updateField({ ...field, tinctures });
  };

  return (
    <PanelShell title="Field properties" bodyClassName="max-h-[400px] overflow-y-auto">
      <Field label="Division">
        <OptionSelect
          aria-label="Division"
          value={field.division}
          onValueChange={(v) => handleDivisionChange(v as Division)}
          options={DIVISIONS}
        />
      </Field>

      <Field label="Line style">
        <OptionSelect
          aria-label="Line style"
          value={field.lineStyle}
          onValueChange={(v) => updateField({ ...field, lineStyle: v as LineStyle })}
          options={LINE_STYLES}
        />
      </Field>

      <Section className="space-y-3">
        <span className="text-label-secondary block font-semibold">
          Tinctures ({expectedCount})
        </span>
        {Array.from({ length: expectedCount }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Eyebrow>Section {i + 1}</Eyebrow>
            <TincturePicker
              value={field.tinctures[i] ?? "argent"}
              onChange={(tinc) => handleTinctureChange(i, tinc)}
            />
          </div>
        ))}
      </Section>
    </PanelShell>
  );
}

function OrdinaryPanel({ index }: { index: number }) {
  const { composition, updateOrdinary } = useVexelEditor();
  const ord = composition.shield.ordinaries?.[index];
  if (!ord) return null;

  return (
    <PanelShell title={`Ordinary properties (${index + 1})`}>
      <Field label="Type">
        <OptionSelect
          aria-label="Type"
          value={ord.type}
          onValueChange={(v) => updateOrdinary(index, { type: v as OrdinaryType })}
          options={ORDINARIES}
        />
      </Field>

      <Field label="Line style">
        <OptionSelect
          aria-label="Line style"
          value={ord.lineStyle}
          onValueChange={(v) => updateOrdinary(index, { lineStyle: v as LineStyle })}
          options={LINE_STYLES}
        />
      </Field>

      <Section>
        <label className="text-label-secondary block font-medium">Tincture</label>
        <TincturePicker
          value={ord.tincture}
          onChange={(tinc) => updateOrdinary(index, { tincture: tinc })}
        />
      </Section>
    </PanelShell>
  );
}

function ChargePanel({ index }: { index: number }) {
  const { composition, updateCharge } = useVexelEditor();
  const charge = composition.shield.charges?.[index];
  if (!charge) return null;

  return (
    <PanelShell title={`Charge properties: ${charge.chargeId}`} titleClassName="truncate">
      <div className="space-y-1">
        <label id="vexel-charge-count" className="text-label-secondary font-medium">
          Count ({charge.count})
        </label>
        <Slider
          aria-labelledby="vexel-charge-count"
          min={1}
          max={12}
          step={1}
          value={[charge.count]}
          onValueChange={([v]) => updateCharge(index, { count: v ?? charge.count })}
          className="py-2"
        />
      </div>

      <div className="space-y-1">
        <label id="vexel-charge-size" className="text-label-secondary font-medium">
          Size ({charge.size.toFixed(2)}x)
        </label>
        <Slider
          aria-labelledby="vexel-charge-size"
          min={0.1}
          max={2.5}
          step={0.05}
          value={[charge.size]}
          onValueChange={([v]) => updateCharge(index, { size: v ?? charge.size })}
          className="py-2"
        />
      </div>

      <Field label="Attitude">
        <OptionSelect
          aria-label="Attitude"
          value={charge.attitude || ""}
          onValueChange={(v) => updateCharge(index, { attitude: (v || undefined) as Attitude })}
          options={[{ value: "", label: "Default (None)" }, ...ATTITUDES]}
        />
      </Field>

      <Section className="flex items-center justify-between">
        <label htmlFor="vexel-charge-mirrored" className="text-label-secondary font-medium">
          Mirrored
        </label>
        <Switch
          id="vexel-charge-mirrored"
          checked={!!charge.mirrored}
          onCheckedChange={(checked) => updateCharge(index, { mirrored: checked })}
        />
      </Section>

      <Section>
        <label className="text-label-secondary block font-medium">Tincture</label>
        <TincturePicker
          value={charge.tincture}
          onChange={(tinc) => updateCharge(index, { tincture: tinc })}
        />
      </Section>
    </PanelShell>
  );
}

const MOTTO_POSITIONS = [
  { value: "below", label: "Scroll below shield" },
  { value: "above", label: "Scroll above shield" },
];

function ExternalsPanel() {
  const { composition, updateExternals } = useVexelEditor();
  const ext = composition.externals || {};

  return (
    <PanelShell title="Ornament properties" bodyClassName="max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <label htmlFor="vexel-include-helm" className="text-label-secondary font-medium">
          Include helm
        </label>
        <Switch
          id="vexel-include-helm"
          checked={!!ext.helm}
          onCheckedChange={(enabled) =>
            updateExternals({
              ...ext,
              helm: enabled ? { type: "great-helm", facing: "affronte" } : undefined,
            })
          }
        />
      </div>

      {ext.helm && (
        <div className="border-separator space-y-1 border-l pl-3">
          <label className="text-label-secondary font-medium">Helm type</label>
          <OptionSelect
            aria-label="Helm type"
            value={ext.helm.type}
            onValueChange={(v) =>
              updateExternals({ ...ext, helm: { ...ext.helm!, type: v as HelmType } })
            }
            options={HELM_TYPES}
          />
        </div>
      )}

      <Section className="space-y-2">
        <label className="text-label-secondary block font-semibold">Motto scroll</label>
        <div className="space-y-1">
          <label htmlFor="vexel-motto-text" className="text-label-secondary">
            Motto text
          </label>
          <Input
            id="vexel-motto-text"
            type="text"
            placeholder="e.g. In Hoc Signo Vinces"
            value={ext.motto?.text || ""}
            onChange={(e) =>
              updateExternals({
                ...ext,
                motto: e.target.value
                  ? { text: e.target.value, position: ext.motto?.position || "below" }
                  : undefined,
              })
            }
          />
        </div>

        {ext.motto && (
          <div className="border-separator space-y-1 border-l pl-3">
            <label className="text-label-secondary">Position</label>
            <OptionSelect
              aria-label="Motto position"
              value={ext.motto.position}
              onValueChange={(v) =>
                updateExternals({
                  ...ext,
                  motto: { ...ext.motto!, position: v as "above" | "below" },
                })
              }
              options={MOTTO_POSITIONS}
            />
          </div>
        )}
      </Section>
    </PanelShell>
  );
}

export default function PropertiesPanel() {
  const { selectedLayerPath: path } = useVexelEditor();

  if (!path) {
    return (
      <Card className="h-full overflow-hidden">
        <div className="text-label-secondary text-footnote flex h-full items-center justify-center p-6 text-center italic">
          Select a layer from the tree to edit properties
        </div>
      </Card>
    );
  }

  if (path === "shield") return <ShieldPanel />;
  if (path === "shield.field") return <FieldPanel />;
  if (path === "externals") return <ExternalsPanel />;

  const index = parseIndex(path);
  if (index === null) return null;
  if (path.startsWith("shield.ordinaries")) return <OrdinaryPanel index={index} />;
  if (path.startsWith("shield.charges")) return <ChargePanel index={index} />;
  return null;
}
