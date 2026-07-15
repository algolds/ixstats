"use client";

import type { ReactNode } from "react";
import React, { createContext, useContext, useState, useEffect } from "react";
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
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [blazon, setBlazon] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [achievementId, setAchievementId] = useState<string | null>(null);

  // Auto-run validation & blazon generation on composition changes
  useEffect(() => {
    const warnings = validateComposition(composition);
    const textBlazon = generateBlazon(composition);
    setValidationWarnings(warnings);
    setBlazon(textBlazon);
  }, [composition]);

  const setInitialState = (comp: HeraldryComposition, id: string | null) => {
    setComposition(comp);
    setAchievementId(id);
    setIsDirty(false);
    setSelectedLayerPath(null);
  };

  const markSaved = () => {
    setIsDirty(false);
  };

  const updateComposition = (comp: HeraldryComposition) => {
    setComposition(comp);
    setIsDirty(true);
  };

  const selectLayer = (path: string | null) => {
    setSelectedLayerPath(path);
  };

  const addCharge = (charge: ChargeRef) => {
    updateComposition({
      ...composition,
      shield: {
        ...composition.shield,
        charges: [...(composition.shield.charges ?? []), charge],
      },
    });
  };

  const removeCharge = (index: number) => {
    const nextCharges = (composition.shield.charges ?? []).filter((_, idx) => idx !== index);
    updateComposition({
      ...composition,
      shield: {
        ...composition.shield,
        charges: nextCharges,
      },
    });
    if (selectedLayerPath === `shield.charges[${index}]`) {
      setSelectedLayerPath(null);
    }
  };

  const updateCharge = (index: number, updates: Partial<ChargeRef>) => {
    const nextCharges = (composition.shield.charges ?? []).map((c, idx) =>
      idx === index ? { ...c, ...updates } : c
    );
    updateComposition({
      ...composition,
      shield: {
        ...composition.shield,
        charges: nextCharges,
      },
    });
  };

  const addOrdinary = (ord: OrdinaryConfig) => {
    updateComposition({
      ...composition,
      shield: {
        ...composition.shield,
        ordinaries: [...(composition.shield.ordinaries ?? []), ord],
      },
    });
  };

  const removeOrdinary = (index: number) => {
    const nextOrdinaries = (composition.shield.ordinaries ?? []).filter((_, idx) => idx !== index);
    updateComposition({
      ...composition,
      shield: {
        ...composition.shield,
        ordinaries: nextOrdinaries,
      },
    });
    if (selectedLayerPath === `shield.ordinaries[${index}]`) {
      setSelectedLayerPath(null);
    }
  };

  const updateOrdinary = (index: number, updates: Partial<OrdinaryConfig>) => {
    const nextOrdinaries = (composition.shield.ordinaries ?? []).map((o, idx) =>
      idx === index ? { ...o, ...updates } : o
    );
    updateComposition({
      ...composition,
      shield: {
        ...composition.shield,
        ordinaries: nextOrdinaries,
      },
    });
  };

  const updateField = (field: FieldConfig) => {
    updateComposition({
      ...composition,
      shield: {
        ...composition.shield,
        field,
      },
    });
  };

  const updateExternals = (ext: ExternalOrnaments) => {
    updateComposition({
      ...composition,
      externals: ext,
    });
  };

  return (
    <VexelEditorContext.Provider
      value={{
        composition,
        selectedLayerPath,
        validationWarnings,
        blazon,
        isDirty,
        achievementId,
        updateComposition,
        selectLayer,
        addCharge,
        removeCharge,
        updateCharge,
        addOrdinary,
        removeOrdinary,
        updateOrdinary,
        updateField,
        updateExternals,
        setInitialState,
        markSaved,
      }}
    >
      {children}
    </VexelEditorContext.Provider>
  );
}

export function useVexelEditor() {
  const context = useContext(VexelEditorContext);
  if (context === undefined) {
    throw new Error("useVexelEditor must be used within a VexelEditorProvider");
  }
  return context;
}
