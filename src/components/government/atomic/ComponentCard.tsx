/**
 * Component Card
 *
 * Individual component card displaying government component details.
 * Optimized with React.memo for performance.
 *
 * @module ComponentCard
 */

import React from 'react';
import { Card, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Plus, Minus } from 'lucide-react';
import type { AtomicGovernmentComponent } from '~/lib/atomic-government-data';

export interface ComponentCardProps {
  component: AtomicGovernmentComponent;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  isReadOnly?: boolean;
  canSelectMore?: boolean;
}

/**
 * Component card displaying government component with selection controls
 */
export const ComponentCard = React.memo<ComponentCardProps>(
  ({ component, isSelected, onSelect, onDeselect, isReadOnly = false, canSelectMore = true }) => {
    const Icon = component.icon;

    const handleClick = () => {
      if (isReadOnly) return;
      if (isSelected) {
        onDeselect();
      } else if (canSelectMore) {
        onSelect();
      }
    };

    return (
      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${
          isSelected
            ? 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-gray-200 dark:border-gray-700'
        } ${!canSelectMore && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={handleClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className={`p-2 rounded-lg bg-${component.color}-100 dark:bg-${component.color}-900/20`}>
                <Icon className={`h-5 w-5 text-${component.color}-600 dark:text-${component.color}-400`} />
              </div>

              <div className="flex-1 space-y-2">
                <div>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                    {component.name}
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {component.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-xs">
                    {component.effectiveness}% effective
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      component.metadata.complexity === 'High'
                        ? 'border-red-500 text-red-700 dark:text-red-400'
                        : component.metadata.complexity === 'Medium'
                        ? 'border-amber-500 text-amber-700 dark:text-amber-400'
                        : 'border-green-500 text-green-700 dark:text-green-400'
                    }`}
                  >
                    {component.metadata.complexity}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {component.category}
                  </Badge>
                </div>
              </div>
            </div>

            {!isReadOnly && (
              <Button
                size="sm"
                variant={isSelected ? 'destructive' : 'default'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSelected) {
                    onDeselect();
                  } else if (canSelectMore) {
                    onSelect();
                  }
                }}
                disabled={!isSelected && !canSelectMore}
              >
                {isSelected ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

ComponentCard.displayName = 'ComponentCard';
