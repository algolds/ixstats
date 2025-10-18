import { Button } from '~/components/ui/button';
import { Filter } from 'lucide-react';
import { areaConfig } from '../_config/intelligence-config';

type AreaType = 'all' | 'economic' | 'population' | 'diplomatic' | 'governance';

interface AreaFilterProps {
  filterArea: AreaType;
  onFilterChange: (area: AreaType) => void;
}

export function AreaFilter({ filterArea, onFilterChange }: AreaFilterProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Button
        variant={filterArea === 'all' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onFilterChange('all')}
      >
        All Areas
      </Button>
      {Object.entries(areaConfig).map(([key, config]) => {
        const Icon = config.icon;
        return (
          <Button
            key={key}
            variant={filterArea === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange(key as AreaType)}
          >
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Button>
        );
      })}
    </div>
  );
}
