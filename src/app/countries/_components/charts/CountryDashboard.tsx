// src/app/countries/_components/charts/CountryDashboard.tsx
// src/app/countries/_components/charts/CountryDashboard.tsx
import type { ChartType } from "../detail";
import { 
  PopulationCategory, 
  EconomyCategory, 
  GovernmentCategory, 
  SocietyCategory, 
  GlobalRankCategory 
} from "../categories";

interface CountryData {
  // Population data
  currentPopulation: number;
  populationGrowthRate: number;
  populationTier: string;
  populationDensity?: number | null;
  landArea?: number | null;
  
  // Economy data
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  adjustedGdpGrowth: number;
  economicTier: string;
  
  // Government data
  governmentType?: string | null;
  leader?: string | null;
  religion?: string | null;
}

interface CountryDashboardProps {
  country: CountryData;
  onNavigate: (view: ChartType) => void;
}

export function CountryDashboard({ country, onNavigate }: CountryDashboardProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <PopulationCategory 
        data={{
          currentPopulation: country.currentPopulation,
          populationGrowthRate: country.populationGrowthRate,
          populationTier: country.populationTier,
          populationDensity: country.populationDensity,
          landArea: country.landArea,
        }}
        onClick={() => onNavigate('population')}
      />
      
      <EconomyCategory 
        data={{
          currentGdpPerCapita: country.currentGdpPerCapita,
          currentTotalGdp: country.currentTotalGdp,
          adjustedGdpGrowth: country.adjustedGdpGrowth,
          economicTier: country.economicTier,
        }}
        onClick={() => onNavigate('gdp')}
      />
      
      <GovernmentCategory 
        data={{
          governmentType: country.governmentType,
          leader: country.leader,
          populationTier: country.populationTier,
        }}
        onClick={() => onNavigate('overview')} // Could create a government-specific view later
      />
      
      <SocietyCategory 
        data={{
          religion: country.religion,
          economicTier: country.economicTier,
          populationTier: country.populationTier,
          currentGdpPerCapita: country.currentGdpPerCapita,
        }}
        onClick={() => onNavigate('overview')} // Could create a society-specific view later
      />
      
      <GlobalRankCategory 
        data={{
          economicTier: country.economicTier,
          populationTier: country.populationTier,
          currentTotalGdp: country.currentTotalGdp,
          currentPopulation: country.currentPopulation,
        }}
        onClick={() => onNavigate('overview')} // Could create a ranking-specific view later
      />
    </div>
  );
}