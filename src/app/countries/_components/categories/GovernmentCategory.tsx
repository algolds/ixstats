// src/app/countries/_components/categories/GovernmentCategory.tsx
import { Landmark, Users2 } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface GovernmentData {
  governmentType?: string | null;
  leader?: string | null;
  populationTier: string; // Used for stability calculation
}

interface GovernmentCategoryProps {
  data: GovernmentData;
  onClick?: () => void;
  className?: string;
}

function calculateGovernmentRating(data: GovernmentData): number {
  // Base rating on government type
  const govTypeRatings: Record<string, number> = {
    'Democracy': 1500,
    'Federal Republic': 1400,
    'Parliamentary': 1300,
    'Constitutional Monarchy': 1200,
    'Republic': 1000,
    'Federation': 900,
    'Monarchy': 500,
    'Authoritarian': 200,
    'Dictatorship': -500,
    'Failed State': -1500,
  };
  
  const govType = data.governmentType || 'Unknown';
  const baseRating = govTypeRatings[govType] || 800; // Default middle rating
  
  // Adjust based on population tier (larger populations = more complex governance challenges)
  const popAdjustment: Record<string, number> = {
    'Microscopic': 200,
    'Tiny': 150,
    'Small': 100,
    'Medium': 0,
    'Large': -100,
    'Massive': -200,
    'Enormous': -300,
    'Colossal': -400,
  };
  
  const adjustment = popAdjustment[data.populationTier] || 0;
  
  return Math.round(baseRating + adjustment);
}

export function GovernmentCategory({ data, onClick, className }: GovernmentCategoryProps) {
  const rating = calculateGovernmentRating(data);
  const tier = rating >= 1200 ? 'Highly Stable' : 
               rating >= 800 ? 'Stable' : 
               rating >= 400 ? 'Developing' : 
               rating >= 0 ? 'Unstable' : 'Critical';

  const getRatingColor = (rating: number): string => {
    if (rating >= 1200) return "text-green-600 dark:text-green-400";
    if (rating >= 800) return "text-blue-600 dark:text-blue-400";
    if (rating >= 400) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-500";
  };

  const getBadgeVariant = (rating: number): "default" | "secondary" | "destructive" | "outline" => {
    if (rating >= 1200) return "default";
    if (rating >= 800) return "secondary";
    if (rating >= 400) return "outline";
    return "destructive";
  };

  return (
    <Card 
      className={cn("cursor-pointer hover:shadow-md transition-shadow", className)}
      onClick={onClick}
    >
      <CardContent className="p-4 text-center">
        <Landmark className={cn("h-8 w-8 mb-2 mx-auto", getRatingColor(rating))} />
        <h3 className="text-sm font-medium mb-1">Government</h3>
        <Badge variant={getBadgeVariant(rating)} className="font-mono mb-2">
          {rating.toLocaleString()}
        </Badge>
        <div className="text-xs text-muted-foreground mb-1">{tier}</div>
        <div className="text-sm font-semibold">{data.governmentType || 'Unknown'}</div>
        {data.leader && (
          <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center">
            <Users2 className="h-3 w-3 mr-1" />
            {data.leader}
          </div>
        )}
      </CardContent>
    </Card>
  );
}