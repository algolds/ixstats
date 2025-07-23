// Unified Country Flag Component - Uses the new unified flag system
// This will replace the existing CountryFlag component

"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { Skeleton } from "~/components/ui/skeleton";
import { Flag } from "lucide-react";

interface UnifiedCountryFlagProps {
  countryName: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  showPlaceholder?: boolean;
  showTooltip?: boolean;
  loading?: boolean;
  // For bulk loading scenarios where flag URL is already known
  flagUrl?: string | null;
  isLoading?: boolean;
  // Styling options
  rounded?: boolean;
  shadow?: boolean;
  border?: boolean;
}

const sizeClasses = {
  xs: "h-3 w-auto min-w-[16px]",
  sm: "h-4 w-auto min-w-[20px]",
  md: "h-6 w-auto min-w-[24px]", 
  lg: "h-8 w-auto min-w-[32px]",
  xl: "h-10 w-auto min-w-[40px]"
};

const placeholderTextSize = {
  xs: "text-[8px]",
  sm: "text-[9px]", 
  md: "text-xs",
  lg: "text-sm",
  xl: "text-base"
};

export function UnifiedCountryFlag({ 
  countryName, 
  size = "md", 
  className = "",
  showPlaceholder = true,
  showTooltip = true,
  loading: externalLoading,
  flagUrl: externalFlagUrl,
  isLoading: externalIsLoading,
  rounded = true,
  shadow = false,
  border = false,
}: UnifiedCountryFlagProps) {
  
  // Use external props if provided (for bulk loading scenarios)
  // Otherwise use individual flag hook
  const hookResult = useFlag(
    (externalFlagUrl === undefined && externalIsLoading === undefined) ? countryName : undefined
  );

  // Determine which values to use
  const flagUrl = externalFlagUrl !== undefined ? externalFlagUrl : hookResult.flagUrl;
  const isLoading = externalLoading || (externalIsLoading !== undefined ? externalIsLoading : hookResult.isLoading);
  const error = !isLoading && !flagUrl;
  const isLocal = flagUrl ? hookResult.isLocal : false;
  const isPlaceholder = flagUrl ? hookResult.isPlaceholder : false;

  // Build CSS classes
  const flagClasses = cn(
    sizeClasses[size],
    "object-contain transition-all duration-200",
    rounded && "rounded",
    shadow && "shadow-sm",
    border && "border border-gray-200",
    "hover:scale-105",
    className
  );

  const placeholderClasses = cn(
    sizeClasses[size],
    placeholderTextSize[size],
    "bg-gradient-to-br from-gray-100 to-gray-200",
    "flex items-center justify-center",
    "text-gray-500 font-medium",
    "transition-all duration-200",
    rounded && "rounded",
    shadow && "shadow-sm", 
    border && "border border-gray-200",
    className
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="relative">
        <Skeleton className={cn(sizeClasses[size], rounded && "rounded", className)} />
        {showTooltip && (
          <span className="sr-only">Loading flag for {countryName}</span>
        )}
      </div>
    );
  }

  // Error state or no flag found
  if (error || !flagUrl) {
    if (!showPlaceholder) {
      return null;
    }
    
    const countryCode = countryName.length >= 2 ? 
      countryName.substring(0, 2).toUpperCase() : 
      countryName.substring(0, 1).toUpperCase();
    
    return (
      <div 
        className={placeholderClasses}
        title={showTooltip ? `Flag not available for ${countryName}` : undefined}
        role="img"
        aria-label={`Flag placeholder for ${countryName}`}
      >
        {size === 'xs' || size === 'sm' ? (
          <Flag className="h-2 w-2 opacity-40" />
        ) : (
          countryCode
        )}
      </div>
    );
  }

  // Success state - show the flag
  const FlagImage = () => (
    <img
      src={flagUrl}
      alt={`Flag of ${countryName}`}
      className={flagClasses}
      onError={() => {
        // Handle image load errors by showing placeholder
        console.warn(`[UnifiedCountryFlag] Failed to load flag image: ${flagUrl}`);
      }}
      loading="lazy" // Enable lazy loading for better performance
    />
  );

  // Wrap with tooltip if enabled
  if (showTooltip) {
    const tooltipText = isPlaceholder ? 
      `Placeholder flag for ${countryName}` :
      isLocal ?
        `${countryName} (cached locally)` :
        `Flag of ${countryName}`;

    return (
      <div 
        title={tooltipText}
        role="img"
        aria-label={`Flag of ${countryName}`}
        className="relative"
      >
        <FlagImage />
        {/* Visual indicator for local files */}
        {isLocal && size !== 'xs' && (
          <div className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full opacity-75" 
               title="Cached locally" />
        )}
      </div>
    );
  }

  return <FlagImage />;
}

// Convenience components for common use cases
export function SmallFlag(props: Omit<UnifiedCountryFlagProps, 'size'>) {
  return <UnifiedCountryFlag {...props} size="sm" />;
}

export function LargeFlag(props: Omit<UnifiedCountryFlagProps, 'size'>) {
  return <UnifiedCountryFlag {...props} size="lg" />;
}

export function IconFlag(props: Omit<UnifiedCountryFlagProps, 'size' | 'showTooltip'>) {
  return <UnifiedCountryFlag {...props} size="xs" showTooltip={false} />;
}

// Grid component for displaying multiple flags
interface FlagGridProps {
  countries: Array<{ name: string; displayName?: string }>;
  flagSize?: UnifiedCountryFlagProps['size'];
  columns?: number;
  className?: string;
}

export function FlagGrid({ countries, flagSize = "md", columns = 4, className }: FlagGridProps) {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-3", 
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6"
  }[columns] || "grid-cols-4";

  return (
    <div className={cn("grid gap-4", gridCols, className)}>
      {countries.map((country) => (
        <div key={country.name} className="flex flex-col items-center gap-2">
          <UnifiedCountryFlag 
            countryName={country.name} 
            size={flagSize}
            shadow
            border
          />
          <span className="text-sm text-center text-gray-600">
            {country.displayName || country.name.replace(/_/g, ' ')}
          </span>
        </div>
      ))}
    </div>
  );
}

// Example usage component for testing
export function UnifiedCountryFlagExample() {
  const testCountries = [
    { name: "United_States", displayName: "United States" },
    { name: "Germany", displayName: "Germany" }, 
    { name: "Japan", displayName: "Japan" },
    { name: "France", displayName: "France" },
    { name: "United_Kingdom", displayName: "United Kingdom" },
    { name: "NonExistentCountry", displayName: "Non-Existent" }
  ];

  const sizes: UnifiedCountryFlagProps['size'][] = ['xs', 'sm', 'md', 'lg', 'xl'];

  return (
    <div className="space-y-8 p-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Flag Sizes</h3>
        <div className="flex items-end gap-4">
          {sizes.map(size => (
            <div key={size} className="flex flex-col items-center gap-2">
              <UnifiedCountryFlag countryName="United_States" size={size} />
              <span className="text-xs text-gray-500">{size}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Flag Grid Example</h3>
        <FlagGrid countries={testCountries} flagSize="md" columns={3} />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Individual Flags</h3>
        <div className="flex flex-wrap gap-4">
          {testCountries.map(country => (
            <div key={country.name} className="flex items-center gap-2">
              <UnifiedCountryFlag countryName={country.name} size="md" />
              <span className="text-sm">{country.displayName}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default UnifiedCountryFlag;