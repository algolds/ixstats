"use client";

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
      className="h-full overflow-hidden rounded-xl border border-white/10"
    >
      <div className="flex h-full flex-col p-4">
        <h2 className="mb-4 border-b border-white/5 pb-2 text-xs font-bold tracking-widest text-zinc-400 uppercase">
          Layer Tree
        </h2>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {/* Shield Root */}
          <div className="space-y-1.5">
            <div
              onClick={() => handleSelect("shield")}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                selectedLayerPath === "shield"
                  ? "border border-amber-500/30 bg-amber-500/20 text-amber-400"
                  : "border border-transparent bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800/80"
              }`}
            >
              <span className="flex items-center gap-2">
                🛡️ Shield ({composition.shield.shape})
              </span>
            </div>

            <div className="space-y-1 pl-4">
              {/* Field */}
              <div
                onClick={() => handleSelect("shield.field")}
                className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  selectedLayerPath === "shield.field"
                    ? "border border-amber-500/20 bg-amber-500/20 text-amber-400"
                    : "border border-transparent bg-zinc-800/20 text-zinc-400 hover:bg-zinc-800/60"
                }`}
              >
                <span>✨ Field ({activeDivision?.label || composition.shield.field.division})</span>
              </div>

              {/* Ordinaries Header */}
              <div className="pt-2">
                <div className="flex items-center justify-between px-3 py-1 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                  <span>Ordinaries</span>
                  <button
                    onClick={() =>
                      addOrdinary({ type: "chief", tincture: "or", lineStyle: "straight" })
                    }
                    className="rounded px-1.5 py-0.5 text-amber-500 transition-all hover:bg-white/5 hover:text-amber-400"
                  >
                    + Add
                  </button>
                </div>

                {/* Ordinaries List */}
                <div className="mt-1 space-y-1">
                  {(composition.shield.ordinaries ?? []).length === 0 ? (
                    <div className="px-3 py-2 text-[10px] text-zinc-600 italic">No ordinaries.</div>
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
                              ? "border border-amber-500/20 bg-amber-500/20 text-amber-400"
                              : "border border-transparent bg-zinc-800/10 text-zinc-400 hover:bg-zinc-800/50"
                          }`}
                        >
                          <span className="truncate">🔸 {label}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeOrdinary(idx);
                            }}
                            className="rounded p-1 text-zinc-600 opacity-0 group-hover:opacity-100 hover:bg-white/5 hover:text-red-400 focus:opacity-100"
                            style={{ opacity: 1 }} // force visibility for ease of use
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Charges Header */}
              <div className="pt-2">
                <div className="flex items-center justify-between px-3 py-1 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                  <span>Charges</span>
                </div>

                {/* Charges List */}
                <div className="mt-1 space-y-1">
                  {(composition.shield.charges ?? []).length === 0 ? (
                    <div className="px-3 py-2 text-[10px] text-zinc-600 italic">
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
                              ? "border border-amber-500/20 bg-amber-500/20 text-amber-400"
                              : "border border-transparent bg-zinc-800/10 text-zinc-400 hover:bg-zinc-800/50"
                          }`}
                        >
                          <span className="truncate">
                            🐾 {charge.count}x {charge.chargeId}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCharge(idx);
                            }}
                            className="rounded p-1 text-zinc-600 hover:bg-white/5 hover:text-red-400"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Externals Root */}
          <div className="space-y-1.5 border-t border-white/5 pt-2">
            <div
              onClick={() => handleSelect("externals")}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                selectedLayerPath === "externals"
                  ? "border border-amber-500/30 bg-amber-500/20 text-amber-400"
                  : "border border-transparent bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800/80"
              }`}
            >
              <span>👑 External Ornaments</span>
            </div>
          </div>
        </div>
      </div>
    </FacetMaterial>
  );
}
