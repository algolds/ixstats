"use client";

import React from "react";
import { motion } from "framer-motion";
import { CountryPreview } from "./CountryPreview";
import type { RealCountryData } from "../lib/economy-data-service";

interface CountrySelectionCardProps {
  country: RealCountryData;
  newCountryName: string;
  onCountryNameChange: (name: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CountrySelectionCard({
  country,
  newCountryName,
  onCountryNameChange,
  onConfirm,
  onCancel,
}: CountrySelectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="space-y-4"
    >
      <CountryPreview country={country} size="large" />

      {/* Name Input and Buttons */}
      <div className="space-y-4">
        <label
          htmlFor="countryName"
          className="block text-sm font-medium text-[var(--color-text-secondary)]"
        >
          Choose a name for your country:
        </label>
        <input
          id="countryName"
          type="text"
          placeholder="e.g., Absurrania"
          value={newCountryName}
          onChange={(e) => onCountryNameChange(e.target.value)}
          className="w-full rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/50 px-4 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] transition-all focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/50 focus:outline-none"
        />
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-[var(--color-brand-primary)]/80 px-4 py-3 font-semibold text-white transition-all hover:bg-[var(--color-brand-primary)]"
          >
            Continue
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCancel}
            className="flex-1 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/50 px-4 py-3 text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-bg-secondary)]/70 hover:text-[var(--color-text-primary)]"
          >
            Cancel
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
