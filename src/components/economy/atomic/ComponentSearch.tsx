/**
 * Component Search
 *
 * Search input for filtering economic components by name or description.
 * Optimized with React.memo for performance.
 */

"use client";

import React from "react";
import { Input } from "~/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "~/components/ui/button";

export interface ComponentSearchProps {
  query: string;
  setQuery: (query: string) => void;
  placeholder?: string;
}

/**
 * Component Search Component
 */
function ComponentSearchComponent({
  query,
  setQuery,
  placeholder = "Search components...",
}: ComponentSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pr-10 pl-10"
      />
      {query && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setQuery("")}
          className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 transform p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export const ComponentSearch = React.memo(ComponentSearchComponent);
