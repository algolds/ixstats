"use client";

import { Xmark } from "iconoir-react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React from "react";
import { useVexelEditor } from "../VexelEditorProvider";
import { DIVISIONS, ORDINARIES } from "~/lib/heraldry";

import { FacetMaterial } from "~/components/ui/facet";

export default function LayerPanel() {
  const { composition, selectedLayerPath, selectLayer, addOrdinary, removeOrdinary, removeCharge } =
    useVexelEditor();

  const handleSelect = (path: string) => {
    selectLayer(selectedLayerPath === path ? null : path);
  };

  const activeDivision = DIVISIONS.find((d) => d.value === composition.shield.field.division);

  return (
    <FacetMaterial
      material="satin"
      className="border-border h-full overflow-hidden rounded-xl border"
    >
      <div className="flex h-full flex-col p-4">
        <h2 className="border-border text-foreground mb-4 border-b pb-2 text-sm font-semibold">
          Layer Tree
        </h2>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {/* Shield Root */}
          <div className="space-y-1.5">
            <div
              onClick={() => handleSelect("shield")}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                selectedLayerPath === "shield"
                  ? "border border-amber-500/30 bg-amber-500/20 text-amber-500"
                  : "bg-muted text-muted-foreground hover:bg-accent border border-transparent"
              }`}
            >
              <span className="flex items-center gap-2">Shield ({composition.shield.shape})</span>
            </div>

            <div className="space-y-1 pl-4">
              {/* Field */}
              <div
                onClick={() => handleSelect("shield.field")}
                className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  selectedLayerPath === "shield.field"
                    ? "border border-amber-500/20 bg-amber-500/20 text-amber-500"
                    : "bg-muted text-muted-foreground hover:bg-accent border border-transparent"
                }`}
              >
                <span>Field ({activeDivision?.label || composition.shield.field.division})</span>
              </div>

              {/* Ordinaries Header */}
              <div className="pt-2">
                <div className="flex items-center justify-between px-3 py-1">
                  <Eyebrow>Ordinaries</Eyebrow>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() =>
                      addOrdinary({ type: "chief", tincture: "or", lineStyle: "straight" })
                    }
                  >
                    + Add
                  </Button>
                </div>

                {/* Ordinaries List */}
                <div className="mt-1 space-y-1">
                  {(composition.shield.ordinaries ?? []).length === 0 ? (
                    <div className="text-muted-foreground px-3 py-2 text-xs italic">
                      No ordinaries.
                    </div>
                  ) : (
                    (composition.shield.ordinaries ?? []).map((ord, idx) => {
                      const label = ORDINARIES.find((o) => o.value === ord.type)?.label || ord.type;
                      const path = `shield.ordinaries[${idx}]`;

                      return (
                        <div
                          key={idx}
                          onClick={() => handleSelect(path)}
                          className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors ${
                            selectedLayerPath === path
                              ? "border border-amber-500/20 bg-amber-500/20 text-amber-500"
                              : "bg-muted text-muted-foreground hover:bg-accent border border-transparent"
                          }`}
                        >
                          <span className="truncate">{label}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeOrdinary(idx);
                            }}
                            style={{ opacity: 1 }} // force visibility for ease of use
                          >
                            <Xmark aria-hidden />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Charges Header */}
              <div className="pt-2">
                <div className="flex items-center justify-between px-3 py-1">
                  <Eyebrow>Charges</Eyebrow>
                </div>

                {/* Charges List */}
                <div className="mt-1 space-y-1">
                  {(composition.shield.charges ?? []).length === 0 ? (
                    <div className="text-muted-foreground px-3 py-2 text-xs italic">
                      No charges. Select from library to add.
                    </div>
                  ) : (
                    (composition.shield.charges ?? []).map((charge, idx) => {
                      const path = `shield.charges[${idx}]`;

                      return (
                        <div
                          key={idx}
                          onClick={() => handleSelect(path)}
                          className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors ${
                            selectedLayerPath === path
                              ? "border border-amber-500/20 bg-amber-500/20 text-amber-500"
                              : "bg-muted text-muted-foreground hover:bg-accent border border-transparent"
                          }`}
                        >
                          <span className="truncate">
                            {charge.count}x {charge.chargeId}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCharge(idx);
                            }}
                          >
                            <Xmark aria-hidden />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Externals Root */}
          <div className="border-border space-y-1.5 border-t pt-2">
            <div
              onClick={() => handleSelect("externals")}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                selectedLayerPath === "externals"
                  ? "border border-amber-500/30 bg-amber-500/20 text-amber-500"
                  : "bg-muted text-muted-foreground hover:bg-accent border border-transparent"
              }`}
            >
              <span>External ornaments</span>
            </div>
          </div>
        </div>
      </div>
    </FacetMaterial>
  );
}
