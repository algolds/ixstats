// src/app/countries/_components/categories/GlobalRankCategory.tsx
import { Award, TrendingUp, Trophy } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface GlobalRankData {
  economicTier: string;
  populationTier: string;
  currentTotalGdp: number;
  currentPopulation: number;
}

interface GlobalRankCategoryProps {
  data: GlobalRankData;
  onClick?: () => void;
  className?: string;
}

function calculateGlobalRank(data: GlobalRankData): number {
  // Composite score based on multiple factors
  const economicWeight: Record<string, number> = {
    'Undeveloped': 100,
    'Developing': 300,
    'Emerging': 600,
    'Advanced': 1000,
    'Highly Advanced': 1500,
  };
  
  const populationWeight: Record<string, number> = {
    'Microscopic': 50,
    'Tiny': 100,
    'Small': 200,
    'Medium': 400,
    'Large': 700,
    'Massive': 1000,
    'Enormous': 1300,
    'Colossal': 1600,
  };
  
  const economicScore = economicWeight[data.economicTier] || 500;
  const populationScore = populationWeight[data.populationTier] || 400;
  
  // Add total GDP bonus (clamped to prevent infinity)
  const totalGdp = isFinite(data.currentTotalGdp) ? data.currentTotalGdp : 0;
  const gdpBonus = Math.min(500, Math.max(0, Math.log10(totalGdp / 1e9) * 100));
  
  return Math.round(economicScore + populationScore + gdpBonus);
}

export function GlobalRankCategory({ data, onClick, className }: GlobalRankCategoryProps) {
  const rating = calculateGlobalRank(data);
  const tier = rating >= 2500 ? 'Superpower' : 
               rating >= 2000 ? 'Major Power' : 
               rating >= 1500 ? 'Regional Power' : 
               rating >= 1000 ? 'Emerging Power' : 'Developing';

  const getRatingColor = (rating: number): string => {
    if (rating >= 2500) return "text-yellow-600 dark:text-yellow-400";
    if (rating >= 2000) return "text-green-600 dark:text-green-400";
    if (rating >= 1500) return "text-blue-600 dark:text-blue-400";
    if (rating >= 1000) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-500";
  };

  const getBadgeVariant = (rating: number): "default" | "secondary" | "destructive" | "outline" => {
    if (rating >= 2500) return "default";
    if (rating >= 2000) return "default";
    if (rating >= 1500) return "secondary";
    if (rating >= 1000) return "outline";
    return "destructive";
  };

  return (
    <Card 
      className={cn("cursor-pointer hover:shadow-md transition-shadow", className)}
      onClick={onClick}
    >
      <CardContent className="p-4 text-center">
        <Award className={cn("h-8 w-8 mb-2 mx-auto", getRatingColor(rating))} />
        <h3 className="text-sm font-medium mb-1">Global Rank</h3>
        <Badge variant={getBadgeVariant(rating)} className="font-mono mb-2">
          {rating.toLocaleString()}
        </Badge>
        <div className="text-xs text-muted-foreground mb-1">{tier}</div>
        <div className="text-sm font-semibold">Composite Score</div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center">
          <Trophy className="h-3 w-3 mr-1" />
          World Ranking
        </div>
      </CardContent>
    </Card>
  );
}