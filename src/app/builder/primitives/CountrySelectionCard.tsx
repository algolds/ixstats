"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { CountryPreview } from './CountryPreview';
import type { RealCountryData } from '../lib/economy-data-service';

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
  onCancel
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
        <label htmlFor="countryName" className="block text-sm font-medium text-[var(--color-text-secondary)]">
          Choose a name for your nation:
        </label>
        <input
          id="countryName"
          type="text"
          placeholder="e.g., Absurrania"
          value={newCountryName}
          onChange={(e) => onCountryNameChange(e.target.value)}
          className="w-full px-4 py-2 bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all"
        />
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-[var(--color-brand-primary)]/80 hover:bg-[var(--color-brand-primary)] rounded-lg text-white font-semibold transition-all"
          >
            Continue
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]/70 transition-all"
          >
            Cancel
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}