"use client";

import React, { useState, useEffect, useRef } from "react";
import { Xmark as X, TriangleFlag as Flag } from "iconoir-react";
import { Portal, type BaseModalProps } from "./types";

export function InfoboxCountryModal({ isOpen, onClose, onInsert }: BaseModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    nativeName: "",
    capital: "",
    motto: "",
    currency: "",
    currencySymbol: "",
    government: "",
    leader: "",
    flagImage: "",
    mapImage: "",
  });
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // oxlint-disable-next-line
      setFormData({
        name: "",
        nativeName: "",
        capital: "",
        motto: "",
        currency: "",
        currencySymbol: "",
        government: "",
        leader: "",
        flagImage: "",
        mapImage: "",
      });
      // Focus first input on open
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Close on Escape keypress
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const infoboxText = `{{Infobox Country
|name = ${formData.name || "{{PAGENAME}}"}
|native_name = ${formData.nativeName}
|capital = ${formData.capital}
|motto = ${formData.motto}
|currency = ${formData.currency}
|currency_symbol = ${formData.currencySymbol}
|government = ${formData.government}
|leader = ${formData.leader}
|flag_image = ${formData.flagImage}
|map_image = ${formData.mapImage}
}}`;
    onInsert(infoboxText);
    onClose();
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100080] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <div
          className="border-border bg-card/95 text-foreground dark:bg-card/95 relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-2xl dark:border-white/15"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-border bg-muted/30 flex items-center justify-between border-b px-6 py-4 dark:border-white/10 dark:bg-white/5">
            <h3 className="text-foreground flex items-center gap-2 text-lg font-bold">
              <Flag className="h-5 w-5 text-blue-400" />
              Insert Infobox Country
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1 transition-colors active:scale-95 dark:hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                  Country Name
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Moscakee"
                  className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                  Native Name
                </label>
                <input
                  type="text"
                  value={formData.nativeName}
                  onChange={(e) => setFormData({ ...formData, nativeName: e.target.value })}
                  placeholder="e.g. Mosckea"
                  className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                  Capital City
                </label>
                <input
                  type="text"
                  value={formData.capital}
                  onChange={(e) => setFormData({ ...formData, capital: e.target.value })}
                  placeholder="e.g. Ostrava"
                  className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                  Motto
                </label>
                <input
                  type="text"
                  value={formData.motto}
                  onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                  placeholder="e.g. Freedom and Unity"
                  className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                  Currency Name
                </label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="e.g. Crown"
                  className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                  Currency Symbol
                </label>
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  placeholder="e.g. 👑"
                  className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                  Government Type
                </label>
                <input
                  type="text"
                  value={formData.government}
                  onChange={(e) => setFormData({ ...formData, government: e.target.value })}
                  placeholder="e.g. Constitutional Monarchy"
                  className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                  Leader / Ruler
                </label>
                <input
                  type="text"
                  value={formData.leader}
                  onChange={(e) => setFormData({ ...formData, leader: e.target.value })}
                  placeholder="e.g. King Michael"
                  className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none"
                />
              </div>
            </div>

            <div className="border-border grid grid-cols-2 gap-4 border-t pt-4">
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                  Flag Image filename
                </label>
                <input
                  type="text"
                  value={formData.flagImage}
                  onChange={(e) => setFormData({ ...formData, flagImage: e.target.value })}
                  placeholder="e.g. Flag_of_Moscakee.png"
                  className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                  Map Image filename
                </label>
                <input
                  type="text"
                  value={formData.mapImage}
                  onChange={(e) => setFormData({ ...formData, mapImage: e.target.value })}
                  placeholder="e.g. Map_of_Moscakee.png"
                  className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-border flex items-center justify-end gap-3 border-t pt-6">
              <button
                type="button"
                onClick={onClose}
                className="text-foreground hover:bg-muted rounded-lg px-4 py-2 text-sm font-semibold transition-all active:scale-[0.97]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-500 active:scale-[0.97]"
              >
                Insert Template
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
