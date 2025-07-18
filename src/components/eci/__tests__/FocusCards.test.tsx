import { render, screen } from '@testing-library/react';
import { FocusCards } from '../FocusCards';

const mockCountryData = {
  id: '1',
  name: 'Testland',
  currentTotalGdp: 1_000_000_000_000,
  currentGdpPerCapita: 50000,
  currentPopulation: 50000000,
  economicTier: 'Developed',
  populationTier: 4,
  adjustedGdpGrowth: 0.072,
  populationGrowthRate: 0.012,
  analytics: {
    growthTrends: {
      avgPopGrowth: 1.1,
      avgGdpGrowth: 2.5,
    },
    volatility: {
      popVolatility: 0.2,
      gdpVolatility: 0.3,
    },
    riskFlags: ['Debt'],
    vulnerabilities: ['Exports'],
  },
};

describe('FocusCards', () => {
  it('renders focus areas with real data', () => {
    render(
      <FocusCards
        countryData={mockCountryData as any}
        selectedFocus={null}
        setSelectedFocus={() => {}}
      />
    );
    expect(screen.getByText(/Economic Development/i)).toBeInTheDocument();
    expect(screen.getByText(/GDP Growth/i)).toBeInTheDocument();
    expect(screen.getByText('7.2%')).toBeInTheDocument();
    expect(screen.getByText(/GDP per Capita/i)).toBeInTheDocument();
    expect(screen.getByText('$50k')).toBeInTheDocument();
    expect(screen.getByText(/Social Development/i)).toBeInTheDocument();
    expect(screen.getByText('1.2%')).toBeInTheDocument();
  });

  it('handles missing analytics gracefully', () => {
    const partialData = { ...mockCountryData, analytics: undefined };
    render(
      <FocusCards
        countryData={partialData as any}
        selectedFocus={null}
        setSelectedFocus={() => {}}
      />
    );
    expect(screen.getByText(/Economic Development/i)).toBeInTheDocument();
    expect(screen.getByText('7.2%')).toBeInTheDocument();
  });

  it('renders loading state if no countryData', () => {
    render(
      <FocusCards
        countryData={undefined}
        selectedFocus={null}
        setSelectedFocus={() => {}}
      />
    );
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });
}); 