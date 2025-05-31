// src/components/charts/chart-type-selector.tsx
import { Button } from "~/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "~/components/ui/dropdown-menu";
import { ChevronDown, BarChart3, LineChart, PieChart } from "lucide-react";
import { useChartContext, type ChartType } from "~/context/chart-context";

interface ChartTypeSelectorProps {
  onTypeChange?: (type: ChartType) => void;
}

export function ChartTypeSelector({ onTypeChange }: ChartTypeSelectorProps) {
  const { chartType, setChartType } = useChartContext();
  
  const handleTypeChange = (type: ChartType) => {
    setChartType(type);
    onTypeChange?.(type);
  };
  
  const getChartTypeLabel = (type: ChartType): string => {
    switch (type) {
      case 'overview': return 'Overview';
      case 'population': return 'Population';
      case 'gdp': return 'GDP';
      case 'gdpPerCapita': return 'GDP per Capita';
      case 'density': return 'Population Density';
      default: return 'Select Chart';
    }
  };
  
  const getChartTypeIcon = (type: ChartType) => {
    switch (type) {
      case 'overview': return <PieChart className="h-4 w-4" />;
      case 'population': return <BarChart3 className="h-4 w-4" />;
      case 'gdp': return <LineChart className="h-4 w-4" />;
      case 'gdpPerCapita': return <LineChart className="h-4 w-4" />;
      case 'density': return <BarChart3 className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          {getChartTypeIcon(chartType)}
          {getChartTypeLabel(chartType)}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleTypeChange('overview')}>
          <PieChart className="h-4 w-4 mr-2" />
          Overview
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleTypeChange('population')}>
          <BarChart3 className="h-4 w-4 mr-2" />
          Population
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleTypeChange('gdp')}>
          <LineChart className="h-4 w-4 mr-2" />
          GDP
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleTypeChange('gdpPerCapita')}>
          <LineChart className="h-4 w-4 mr-2" />
          GDP per Capita
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleTypeChange('density')}>
          <BarChart3 className="h-4 w-4 mr-2" />
          Population Density
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
