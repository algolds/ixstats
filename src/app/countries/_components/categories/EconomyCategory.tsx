// src/app/countries/_components/categories/EconomyCategory.tsx
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface EconomyData {
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  adjustedGdpGrowth: number;
  economicTier: string;
}

interface EconomyCategoryProps {
  data: EconomyData;
  onClick?: () => void;
  className?: string;
}

function calculateEconomyRating(data: EconomyData): number {
  const tierRatings: Record<string, number> = {
    'Undeveloped': -1500,
    'Developing': -500,
    'Emerging': 500,
    'Advanced': 1500,
    'Highly Advanced': 2200,
  };
  
  let baseRating = tierRatings[data.economicTier] || 0;
  
  // Adjust for growth rate (clamp to prevent infinity)
  const growthRate = isFinite(data.adjustedGdpGrowth) ? data.adjustedGdpGrowth : 0;
  const growthBonus = Math.min(500, Math.max(-500, growthRate * 5000));
  
  return Math.round(baseRating + growthBonus);
}

export function EconomyCategory({ data, onClick, className }: EconomyCategoryProps) {
  const rating = calculateEconomyRating(data);
  const isPositiveGrowth = isFinite(data.adjustedGdpGrowth) && data.adjustedGdpGrowth > 0;
  
  const formatGdpPc = (gdp: number): string => {
    if (!isFinite(gdp) || isNaN(gdp)) return "$0";
    if (gdp >= 1e6) return `$${(gdp / 1e6).toFixed(1)}M`;
    if (gdp >= 1e3) return `$${(gdp / 1e3).toFixed(0)}K`;
    return `$${Math.round(gdp).toLocaleString()}`;
  };

  const getRatingColor = (rating: number): string => {
    if (rating >= 2000) return "text-green-600 dark:text-green-400";
    if (rating >= 1000) return "text-blue-600 dark:text-blue-400";
    if (rating >= 0) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-500";
  };

  const getBadgeVariant = (rating: number): "default" | "secondary" | "destructive" | "outline" => {
    if (rating >= 2000) return "default";
    if (rating >= 1000) return "secondary";
    if (rating >= 0) return "outline";
    return "destructive";
  };

  return (
    <Card 
      className={cn("cursor-pointer hover:shadow-md transition-shadow", className)}
      onClick={onClick}
    >
      <CardContent className="p-4 text-center">
        <DollarSign className={cn("h-8 w-8 mb-2 mx-auto", getRatingColor(rating))} />
        <h3 className="text-sm font-medium mb-1">Economy</h3>
        <Badge variant={getBadgeVariant(rating)} className="font-mono mb-2">
          {rating.toLocaleString()}
        </Badge>
        <div className="text-xs text-muted-foreground mb-1">{data.economicTier}</div>
        <div className="text-sm font-semibold">{formatGdpPc(data.currentGdpPerCapita)}</div>
        <div className={cn("text-xs flex items-center justify-center mt-1", 
          isPositiveGrowth ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
        )}>
          {isPositiveGrowth ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
          {isFinite(data.adjustedGdpGrowth) ? (data.adjustedGdpGrowth * 100).toFixed(1) : "0.0"}%
        </div>
      </CardContent>
    </Card>
  );
}