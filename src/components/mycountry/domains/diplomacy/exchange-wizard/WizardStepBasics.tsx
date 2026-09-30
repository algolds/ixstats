"use client";

import React from "react";
import { NavArrowDown, NavArrowUp } from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { ExchangeTypeGrid } from "./ExchangeTypeGrid";
import type { WizardExchangeType } from "./exchange-wizard-config";

interface WizardStepBasicsProps {
  title: string;
  onTitleChange: (value: string) => void;
  type: WizardExchangeType;
  onTypeChange: (type: WizardExchangeType) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  showMoreTypes: boolean;
  onShowMoreTypesChange: (value: boolean) => void;
}

/** Step 1 — exchange type and basic information. */
export const WizardStepBasics = React.memo(function WizardStepBasics({
  title,
  onTitleChange,
  type,
  onTypeChange,
  description,
  onDescriptionChange,
  showMoreTypes,
  onShowMoreTypesChange,
}: WizardStepBasicsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-foreground mb-2 text-lg font-bold">Exchange Type & Information</h3>
        <p className="text-muted-foreground text-sm">
          Define the type and basic details of your cultural exchange.
        </p>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title" className="text-foreground">
          Exchange Title *
        </Label>
        <Input
          id="title"
          placeholder="e.g., Annual Cultural Festival 2025"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </div>

      {/* Type Dropdown */}
      <div className="space-y-2">
        <Label className="text-foreground">Exchange Type *</Label>

        {/* Primary Types */}
        <ExchangeTypeGrid
          primary
          selected={type}
          onSelect={onTypeChange}
          className="grid grid-cols-2 gap-2 md:grid-cols-4"
        />

        {/* More Types (Expandable) */}
        <div>
          <button
            type="button"
            onClick={() => onShowMoreTypesChange(!showMoreTypes)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 py-1 text-xs transition-colors"
          >
            {showMoreTypes ? (
              <NavArrowUp className="h-4 w-4" />
            ) : (
              <NavArrowDown className="h-4 w-4" />
            )}
            {showMoreTypes ? "Show Less" : "Show More Types"}
          </button>

          <AnimatePresence>
            {showMoreTypes && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-visible"
              >
                <ExchangeTypeGrid
                  primary={false}
                  selected={type}
                  onSelect={onTypeChange}
                  className="grid grid-cols-2 gap-2 pt-2 md:grid-cols-4"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-foreground">
          Description *
        </Label>
        <Textarea
          id="description"
          placeholder="Provide a brief overview of this cultural exchange..."
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="min-h-24"
        />
      </div>
    </div>
  );
});
