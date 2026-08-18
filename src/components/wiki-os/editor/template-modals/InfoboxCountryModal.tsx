"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Flag } from "lucide-react";
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
        className="fixed inset-0 z-[100080] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <div
          className="glass-surface glass-refraction-none relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1524]/90 text-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <Flag className="h-5 w-5 text-blue-400" />
              Insert Infobox Country
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Country Name
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Moscakee"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Native Name
                </label>
                <input
                  type="text"
                  value={formData.nativeName}
                  onChange={(e) => setFormData({ ...formData, nativeName: e.target.value })}
                  placeholder="e.g. Mosckea"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Capital City
                </label>
                <input
                  type="text"
                  value={formData.capital}
                  onChange={(e) => setFormData({ ...formData, capital: e.target.value })}
                  placeholder="e.g. Ostrava"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Motto</label>
                <input
                  type="text"
                  value={formData.motto}
                  onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                  placeholder="e.g. Freedom and Unity"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Currency Name
                </label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="e.g. Crown"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Currency Symbol
                </label>
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  placeholder="e.g. 👑"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Government Type
                </label>
                <input
                  type="text"
                  value={formData.government}
                  onChange={(e) => setFormData({ ...formData, government: e.target.value })}
                  placeholder="e.g. Constitutional Monarchy"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Leader / Ruler
                </label>
                <input
                  type="text"
                  value={formData.leader}
                  onChange={(e) => setFormData({ ...formData, leader: e.target.value })}
                  placeholder="e.g. King Michael"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Flag Image filename
                </label>
                <input
                  type="text"
                  value={formData.flagImage}
                  onChange={(e) => setFormData({ ...formData, flagImage: e.target.value })}
                  placeholder="e.g. Flag_of_Moscakee.png"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Map Image filename
                </label>
                <input
                  type="text"
                  value={formData.mapImage}
                  onChange={(e) => setFormData({ ...formData, mapImage: e.target.value })}
                  placeholder="e.g. Map_of_Moscakee.png"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
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
