"use client";

import React, { useState, useEffect, useRef } from "react";
import { TriangleFlag as Flag } from "iconoir-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import type { BaseModalProps } from "./types";
import { TemplateModalShell } from "./TemplateModalShell";

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
    <TemplateModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={<Flag className="text-tint size-5 shrink-0" aria-hidden="true" />}
      title="Insert Infobox Country"
      className="max-h-[85vh] max-w-2xl"
      bodyClassName="flex flex-col overflow-hidden"
    >
      <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-subhead text-label-secondary mb-1 block">Country Name</label>
            <Input
              ref={firstInputRef}
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Moscakee"
            />
          </div>
          <div>
            <label className="text-subhead text-label-secondary mb-1 block">Native Name</label>
            <Input
              type="text"
              value={formData.nativeName}
              onChange={(e) => setFormData({ ...formData, nativeName: e.target.value })}
              placeholder="e.g. Mosckea"
            />
          </div>
          <div>
            <label className="text-subhead text-label-secondary mb-1 block">Capital City</label>
            <Input
              type="text"
              value={formData.capital}
              onChange={(e) => setFormData({ ...formData, capital: e.target.value })}
              placeholder="e.g. Ostrava"
            />
          </div>
          <div>
            <label className="text-subhead text-label-secondary mb-1 block">Motto</label>
            <Input
              type="text"
              value={formData.motto}
              onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
              placeholder="e.g. Freedom and Unity"
            />
          </div>
          <div>
            <label className="text-subhead text-label-secondary mb-1 block">Currency Name</label>
            <Input
              type="text"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              placeholder="e.g. Crown"
            />
          </div>
          <div>
            <label className="text-subhead text-label-secondary mb-1 block">Currency Symbol</label>
            <Input
              type="text"
              value={formData.currencySymbol}
              onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
              placeholder="e.g. 👑"
            />
          </div>
          <div>
            <label className="text-subhead text-label-secondary mb-1 block">Government Type</label>
            <Input
              type="text"
              value={formData.government}
              onChange={(e) => setFormData({ ...formData, government: e.target.value })}
              placeholder="e.g. Constitutional Monarchy"
            />
          </div>
          <div>
            <label className="text-subhead text-label-secondary mb-1 block">Leader / Ruler</label>
            <Input
              type="text"
              value={formData.leader}
              onChange={(e) => setFormData({ ...formData, leader: e.target.value })}
              placeholder="e.g. King Michael"
            />
          </div>
        </div>

        <div className="border-separator grid grid-cols-2 gap-4 border-t pt-4">
          <div>
            <label className="text-subhead text-label-secondary mb-1 block">
              Flag Image filename
            </label>
            <Input
              type="text"
              value={formData.flagImage}
              onChange={(e) => setFormData({ ...formData, flagImage: e.target.value })}
              placeholder="e.g. Flag_of_Moscakee.png"
            />
          </div>
          <div>
            <label className="text-subhead text-label-secondary mb-1 block">
              Map Image filename
            </label>
            <Input
              type="text"
              value={formData.mapImage}
              onChange={(e) => setFormData({ ...formData, mapImage: e.target.value })}
              placeholder="e.g. Map_of_Moscakee.png"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-separator flex items-center justify-end gap-3 border-t pt-6">
          <Button variant="gray" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Insert Template</Button>
        </div>
      </form>
    </TemplateModalShell>
  );
}
