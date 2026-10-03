"use client";

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";
import type {
  HeraldryComposition,
  ValidationWarning,
  ChargeRef,
  OrdinaryConfig,
  FieldConfig,
  ExternalOrnaments,
} from "~/lib/heraldry";
import { validateComposition, generateBlazon } from "~/lib/heraldry";

interface VexelEditorContextType {
  composition: HeraldryComposition;
  selectedLayerPath: string | null;
  validationWarnings: ValidationWarning[];
  blazon: string;
  isDirty: boolean;
  achievementId: string | null;
  updateComposition: (comp: HeraldryComposition) => void;
  selectLayer: (path: string | null) => void;
  addCharge: (charge: ChargeRef) => void;
  removeCharge: (index: number) => void;
  updateCharge: (index: number, updates: Partial<ChargeRef>) => void;
  addOrdinary: (ord: OrdinaryConfig) => void;
  removeOrdinary: (index: number) => void;
  updateOrdinary: (index: number, updates: Partial<OrdinaryConfig>) => void;
  updateField: (field: FieldConfig) => void;
  updateExternals: (ext: ExternalOrnaments) => void;
  setInitialState: (comp: HeraldryComposition, id: string | null) => void;
  markSaved: () => void;
}

const DEFAULT_COMPOSITION: HeraldryComposition = {
  shield: {
    shape: "heater",
    field: {
      division: "plain",
      tinctures: ["argent"],
      lineStyle: "straight",
    },
    ordinaries: [],
    charges: [],
  },
};

const VexelEditorContext = createContext<VexelEditorContextType | undefined>(undefined);

export function VexelEditorProvider({ children }: { children: ReactNode }) {
  const [composition, setComposition] = useState<HeraldryComposition>(DEFAULT_COMPOSITION);
  const [selectedLayerPath, setSelectedLayerPath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [achievementId, setAchievementId] = useState<string | null>(null);

  const validationWarnings = useMemo(() => validateComposition(composition), [composition]);
  const blazon = useMemo(() => generateBlazon(composition), [composition]);

  // Load draft from sessionStorage on mount
  useEffect(() => {
    const draft = sessionStorage.getItem("vexel-draft");
    if (!draft) return;
    try {
      // oxlint-disable-next-line
      setComposition(JSON.parse(draft) as HeraldryComposition);
      setIsDirty(true);
      sessionStorage.removeItem("vexel-draft");
    } catch (e) {
      console.error("Failed to parse vexel-draft", e);
    }
  }, []);

  const setInitialState = (comp: HeraldryComposition, id: string | null) => {
    setComposition(comp);
    setAchievementId(id);
    setIsDirty(false);
    setSelectedLayerPath(null);
  };

  const updateComposition = (comp: HeraldryComposition) => {
    setComposition(comp);
    setIsDirty(true);
  };

  const updateShield = (patch: Partial<HeraldryComposition["shield"]>) =>
    updateComposition({ ...composition, shield: { ...composition.shield, ...patch } });

  /** Deselect the layer if it was the removed item. */
  const deselectIfRemoved = (collection: "charges" | "ordinaries", index: number) => {
    if (selectedLayerPath === `shield.${collection}[${index}]`) setSelectedLayerPath(null);
  };

  const charges = composition.shield.charges ?? [];
  const ordinaries = composition.shield.ordinaries ?? [];

  const value: VexelEditorContextType = {
    composition,
    selectedLayerPath,
    validationWarnings,
    blazon,
    isDirty,
    achievementId,
    updateComposition,
    selectLayer: setSelectedLayerPath,
    addCharge: (charge) => updateShield({ charges: [...charges, charge] }),
    removeCharge: (index) => {
      updateShield({ charges: charges.filter((_, idx) => idx !== index) });
      deselectIfRemoved("charges", index);
    },
    updateCharge: (index, updates) =>
      updateShield({
        charges: charges.map((c, idx) => (idx === index ? { ...c, ...updates } : c)),
      }),
    addOrdinary: (ord) => updateShield({ ordinaries: [...ordinaries, ord] }),
    removeOrdinary: (index) => {
      updateShield({ ordinaries: ordinaries.filter((_, idx) => idx !== index) });
      deselectIfRemoved("ordinaries", index);
    },
    updateOrdinary: (index, updates) =>
      updateShield({
        ordinaries: ordinaries.map((o, idx) => (idx === index ? { ...o, ...updates } : o)),
      }),
    updateField: (field) => updateShield({ field }),
    updateExternals: (externals) => updateComposition({ ...composition, externals }),
    setInitialState,
    markSaved: () => setIsDirty(false),
  };

  return <VexelEditorContext.Provider value={value}>{children}</VexelEditorContext.Provider>;
}

export function useVexelEditor() {
  const context = useContext(VexelEditorContext);
  if (context === undefined) {
    throw new Error("useVexelEditor must be used within a VexelEditorProvider");
  }
  return context;
}
