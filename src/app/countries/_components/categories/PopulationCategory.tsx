// src/app/countries/_components/categories/PopulationCategory.tsx
import { Users, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface PopulationData {
  currentPopulation: number;
  populationGrowthRate: number;
  populationTier: string;
  populationDensity?: number | null;
  landArea?: number | null;
}

interface PopulationCategoryProps {
  data: PopulationData;
  onClick?: () => void;
  className?: string;
}

function calculatePopulationRating(data: PopulationData): number {
  const tierRatings: Record<string, number> = {
    'Microscopic': -2000,
    'Tiny': -1500,
    'Small': -1000,
    'Medium': -500,
    'Large': 500,
    'Massive': 1000,
    'Enormous': 1500,
    'Colossal': 2000,
  };
  
  let baseRating = tierRatings[data.populationTier] || 0;
  
  // Adjust for growth rate
  const growthBonus = Math.min(500, Math.max(-500, data.populationGrowthRate * 10000));
  
  return Math.round(baseRating + growthBonus);
}

export function PopulationCategory({ data, onClick, className }: PopulationCategoryProps) {
  const rating = calculatePopulationRating(data);
  const isPositiveGrowth = data.populationGrowthRate > 0;
  
  const formatPopulation = (pop: number): string => {
    if (pop >= 1e9) return `${(pop / 1e9).toFixed(1)}B`;
    if (pop >= 1e6) return `${(pop / 1e6).toFixed(1)}M`;
    if (pop >= 1e3) return `${(pop / 1e3).toFixed(0)}K`;
    return pop.toString();
  };

  const getRatingColor = (rating: number): string => {
    if (rating >= 1500) return "text-green-600 dark:text-green-400";
    if (rating >= 500) return "text-blue-600 dark:text-blue-400";
    if (rating >= 0) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-500";
  };

  const getBadgeVariant = (rating: number): "default" | "secondary" | "destructive" | "outline" => {
    if (rating >= 1500) return "default";
    if (rating >= 500) return "secondary";
    if (rating >= 0) return "outline";
    return "destructive";
  };

  return (
    <Card 
      className={cn("cursor-pointer hover:shadow-md transition-shadow", className)}
      onClick={onClick}
    >
      <CardContent className="p-4 text-center">
        <Users className={cn("h-8 w-8 mb-2 mx-auto", getRatingColor(rating))} />
        <h3 className="text-sm font-medium mb-1">Population</h3>
        <Badge variant={getBadgeVariant(rating)} className="font-mono mb-2">
          {rating.toLocaleString()}
        </Badge>
        <div className="text-xs text-muted-foreground mb-1">{data.populationTier}</div>
        <div className="text-sm font-semibold">{formatPopulation(data.currentPopulation)}</div>
        <div className={cn("text-xs flex items-center justify-center mt-1", 
          isPositiveGrowth ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
        )}>
          {isPositiveGrowth ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
          {(data.populationGrowthRate * 100).toFixed(2)}%
        </div>
      </CardContent>
    </Card>
  );
}