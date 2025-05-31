// src/app/countries/_components/charts/CountryDashboard.tsx
import { Users, DollarSign, Landmark, Shield, Award } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ChartType } from "../detail";
import { cn } from "~/lib/utils";

interface CountryData {
  economicTier: string;
  populationTier: string;
  // Other properties...
}

interface CountryDashboardProps {
  country: CountryData;
  onNavigate: (view: ChartType) => void;
}

// Calculate rating based on tier
function calculateRating(tier: string): number {
  const tierRatings: Record<string, number> = {
    'Undeveloped': -1500,
    'Developing': -500,
    'Emerging': 500,
    'Advanced': 1500,
    'Highly Advanced': 2200,
  };
  
  return tierRatings[tier] || 0;
}

export function CountryDashboard({ country, onNavigate }: CountryDashboardProps) {
  const dashboardItems = [
    {
      key: 'population' as ChartType,
      label: 'Population',
      icon: Users,
      rating: calculateRating(country.populationTier),
      tier: country.populationTier
    },
    {
      key: 'gdp' as ChartType,
      label: 'Economy',
      icon: DollarSign,
      rating: calculateRating(country.economicTier),
      tier: country.economicTier
    },
    {
      key: 'government',
      label: 'Government',
      icon: Landmark,
      rating: 800,
      tier: 'Developing'
    },
    {
      key: 'society',
      label: 'Society',
      icon: Shield,
      rating: 1200,
      tier: 'Emerging'
    },
    {
      key: 'ranking',
      label: 'Global Rank',
      icon: Award,
      rating: 2000,
      tier: 'Advanced'
    },
  ];

  function getRatingColor(rating: number): string {
    if (rating >= 2000) return "text-green-600 dark:text-green-400";
    if (rating >= 1000) return "text-blue-600 dark:text-blue-400";
    if (rating >= 0) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-500";
  }
  
  function getBadgeVariant(rating: number): "default" | "secondary" | "destructive" | "outline" {
    if (rating >= 2000) return "default";
    if (rating >= 1000) return "secondary";
    if (rating >= 0) return "outline";
    return "destructive";
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      {dashboardItems.map(({ key, label, icon: Icon, rating, tier }) => (
        <Button
          key={key}
          variant="outline"
          className="flex flex-col items-center p-4 h-auto"
          onClick={() => onNavigate(key as ChartType)}
        >
          <Icon className={cn("h-8 w-8 mb-2", getRatingColor(rating))} />
          <span className="text-sm font-medium mb-1">{label}</span>
          <Badge variant={getBadgeVariant(rating)} className="font-mono">
            {rating.toLocaleString()}
          </Badge>
          <span className="text-xs text-muted-foreground mt-1">{tier}</span>
        </Button>
      ))}
    </div>
  );
}
