"use client";

import { Xmark } from "iconoir-react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React from "react";
import { useVexelEditor } from "../VexelEditorProvider";
import { DIVISIONS, ORDINARIES } from "~/lib/heraldry";

import { FacetCard } from "~/components/ui/facet-container";

export default function LayerPanel() {
  const { composition, selectedLayerPath, selectLayer, addOrdinary, removeOrdinary, removeCharge } =
    useVexelEditor();

  const handleSelect = (path: string) => {
    selectLayer(selectedLayerPath === path ? null : path);
  };

  const activeDivision = DIVISIONS.find((d) => d.value === composition.shield.field.division);

  return (
    <FacetCard className="h-full overflow-hidden">
      <div className="flex h-full flex-col p-4">
        <h2 className="border-separator text-label text-headline mb-4 border-b pb-2">Layer Tree</h2>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {/* Shield Root */}
          <div className="space-y-2">
            <div
              onClick={() => handleSelect("shield")}
              className={`rounded-control text-headline flex cursor-pointer items-center justify-between px-3 py-2 transition-colors ${
                selectedLayerPath === "shield"
                  ? "border-tint/30 bg-tint/20 text-tint-ink border"
                  : "bg-fill-3 text-label-secondary hover:bg-fill-3 border border-transparent"
              }`}
            >
              <span className="flex items-center gap-2">Shield ({composition.shield.shape})</span>
            </div>

            <div className="space-y-1 pl-4">
              {/* Field */}
              <div
                onClick={() => handleSelect("shield.field")}
                className={`rounded-control text-footnote flex cursor-pointer items-center justify-between px-3 py-2 transition-colors ${
                  selectedLayerPath === "shield.field"
                    ? "border-tint/20 bg-tint/20 text-tint-ink border"
                    : "bg-fill-3 text-label-secondary hover:bg-fill-3 border border-transparent"
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
                    <div className="text-label-secondary text-footnote px-3 py-2 italic">
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
                          className={`rounded-control text-footnote flex cursor-pointer items-center justify-between px-3 py-2 transition-colors ${
                            selectedLayerPath === path
                              ? "border-tint/20 bg-tint/20 text-tint-ink border"
                              : "bg-fill-3 text-label-secondary hover:bg-fill-3 border border-transparent"
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
                    <div className="text-label-secondary text-footnote px-3 py-2 italic">
                      No charges. Select from library to add.
                    </div>
                  ) : (
                    (composition.shield.charges ?? []).map((charge, idx) => {
                      const path = `shield.charges[${idx}]`;

                      return (
                        <div
                          key={idx}
                          onClick={() => handleSelect(path)}
                          className={`rounded-control text-footnote flex cursor-pointer items-center justify-between px-3 py-2 transition-colors ${
                            selectedLayerPath === path
                              ? "border-tint/20 bg-tint/20 text-tint-ink border"
                              : "bg-fill-3 text-label-secondary hover:bg-fill-3 border border-transparent"
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
          <div className="border-separator space-y-2 border-t pt-2">
            <div
              onClick={() => handleSelect("externals")}
              className={`rounded-control text-headline flex cursor-pointer items-center justify-between px-3 py-2 transition-colors ${
                selectedLayerPath === "externals"
                  ? "border-tint/30 bg-tint/20 text-tint-ink border"
                  : "bg-fill-3 text-label-secondary hover:bg-fill-3 border border-transparent"
              }`}
            >
              <span>External ornaments</span>
            </div>
          </div>
        </div>
      </div>
    </FacetCard>
  );
}
