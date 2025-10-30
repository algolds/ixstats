/**
 * Component Search
 *
 * Search input with real-time filtering.
 * Optimized with React.memo for performance.
 *
 * @module ComponentSearch
 */

import React from 'react';
import { Input } from '~/components/ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '~/components/ui/button';

export interface ComponentSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Search input for filtering components by name or description
 */
export const ComponentSearch = React.memo<ComponentSearchProps>(
  ({ value, onChange, placeholder = 'Search components...' }) => {
    return (
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-9"
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange('')}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }
);

ComponentSearch.displayName = 'ComponentSearch';
