/**
 * Component Search
 *
 * Search input with real-time filtering and an optional embedded TemplateSelector.
 * Optimized with React.memo for performance.
 *
 * @module ComponentSearch
 */

import React from "react";
import { Search, Xmark as X } from "iconoir-react";
import { TemplateSelector } from "./TemplateSelector";
import type { GovernmentTemplate } from "./TemplateSelector";
import { Button } from "~/components/ui/button";

export interface ComponentSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  templates?: Record<string, GovernmentTemplate>;
  onTemplateSelect?: (templateId: string) => void;
  disabled?: boolean;
}

/**
 * Search bar with optional embedded template selector
 */
export const ComponentSearch = React.memo<ComponentSearchProps>(
  ({
    value,
    onChange,
    placeholder = "Search components...",
    templates,
    onTemplateSelect,
    disabled = false,
  }) => {
    return (
      <div className="border-input bg-background focus-within:ring-ring flex h-11 w-full items-center gap-3 overflow-hidden rounded-lg border px-3 focus-within:ring-2">
        {templates && onTemplateSelect && (
          <>
            <div className="shrink-0 select-none">
              <TemplateSelector
                templates={templates}
                onSelect={onTemplateSelect}
                disabled={disabled}
              />
            </div>
            <div aria-hidden="true" className="bg-border h-6 w-px" />
          </>
        )}

        <Search aria-hidden="true" className="text-muted-foreground h-4 w-4 shrink-0" />

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="facet-refraction-none text-foreground placeholder:text-muted-foreground flex-1 border-0 bg-transparent text-sm outline-none"
        />

        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => onChange("")}
            aria-label="Clear search"
          >
            <X className="text-muted-foreground h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }
);

ComponentSearch.displayName = "ComponentSearch";
