// src/app/countries/_components/categories/SocietyCategory.tsx
import { Shield, Heart, GraduationCap } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface SocietyData {
  religion?: string | null;
  economicTier: string;
  populationTier: string;
  currentGdpPerCapita: number;
}

interface SocietyCategoryProps {
  data: SocietyData;
  onClick?: () => void;
  className?: string;
}

function calculateSocietyRating(data: SocietyData): number {
  // Base rating on economic development (proxy for HDI)
  const economicBase: Record<string, number> = {
    'Undeveloped': 400,
    'Developing': 800,
    'Emerging': 1200,
    'Advanced': 1600,
    'Highly Advanced': 2000,
  };
  
  let baseRating = economicBase[data.economicTier] || 1000;
  
  // Adjust for GDP per capita
  const gdpPc = isFinite(data.currentGdpPerCapita) ? data.currentGdpPerCapita : 0;
  if (gdpPc > 50000) baseRating += 200;
  else if (gdpPc > 25000) baseRating += 100;
  else if (gdpPc < 5000) baseRating -= 200;
  else if (gdpPc < 15000) baseRating -= 100;
  
  return Math.round(baseRating);
}

export function SocietyCategory({ data, onClick, className }: SocietyCategoryProps) {
  const rating = calculateSocietyRating(data);
  const tier = rating >= 1800 ? 'Highly Developed' : 
               rating >= 1400 ? 'Developed' : 
               rating >= 1000 ? 'Emerging' : 
               rating >= 600 ? 'Developing' : 'Underdeveloped';

  const getRatingColor = (rating: number): string => {
    if (rating >= 1800) return "text-green-600 dark:text-green-400";
    if (rating >= 1400) return "text-blue-600 dark:text-blue-400";
    if (rating >= 1000) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-500";
  };

  const getBadgeVariant = (rating: number): "default" | "secondary" | "destructive" | "outline" => {
    if (rating >= 1800) return "default";
    if (rating >= 1400) return "secondary";
    if (rating >= 1000) return "outline";
    return "destructive";
  };

  return (
    <Card 
      className={cn("cursor-pointer hover:shadow-md transition-shadow", className)}
      onClick={onClick}
    >
      <CardContent className="p-4 text-center">
        <Shield className={cn("h-8 w-8 mb-2 mx-auto", getRatingColor(rating))} />
        <h3 className="text-sm font-medium mb-1">Society</h3>
        <Badge variant={getBadgeVariant(rating)} className="font-mono mb-2">
          {rating.toLocaleString()}
        </Badge>
        <div className="text-xs text-muted-foreground mb-1">{tier}</div>
        <div className="text-sm font-semibold">HDI Index</div>
        {data.religion && (
          <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center">
            <Heart className="h-3 w-3 mr-1" />
            {data.religion}
          </div>
        )}
      </CardContent>
    </Card>
  );
}