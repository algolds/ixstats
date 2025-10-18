import { Button } from '~/components/ui/button';
import { Activity, FileText, Target, BarChart3 } from 'lucide-react';

type ViewType = 'overview' | 'briefings' | 'focus' | 'analytics';

interface ViewSelectorProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  briefingsCount: number;
}

export function ViewSelector({ activeView, onViewChange, briefingsCount }: ViewSelectorProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b">
      <Button
        variant={activeView === 'overview' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('overview')}
      >
        <Activity className="h-4 w-4 mr-2" />
        Overview
      </Button>
      <Button
        variant={activeView === 'briefings' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('briefings')}
      >
        <FileText className="h-4 w-4 mr-2" />
        Briefings ({briefingsCount})
      </Button>
      <Button
        variant={activeView === 'focus' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('focus')}
      >
        <Target className="h-4 w-4 mr-2" />
        Focus Areas
      </Button>
      <Button
        variant={activeView === 'analytics' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('analytics')}
      >
        <BarChart3 className="h-4 w-4 mr-2" />
        Analytics
      </Button>
    </div>
  );
}
