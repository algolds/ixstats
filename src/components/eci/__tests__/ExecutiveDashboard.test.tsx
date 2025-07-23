import { render, screen } from '@testing-library/react';
import { ExecutiveDashboard } from '../ExecutiveDashboard';

const mockCountryData = {
  name: 'Testland',
  economicTier: 'Developed',
  populationTier: 4,
  adjustedGdpGrowth: 0.072,
  populationGrowthRate: 0.012,
  currentPopulation: 50000000,
};

describe('ExecutiveDashboard', () => {
  it('renders all metrics with real data', () => {
    render(<ExecutiveDashboard countryData={mockCountryData as any} userId="test-user-id" />);
    expect(screen.getByText(/Economic Growth/i)).toBeInTheDocument();
    expect(screen.getByText('7.2%')).toBeInTheDocument();
    expect(screen.getByText(/Population Growth/i)).toBeInTheDocument();
    expect(screen.getByText('1.2%')).toBeInTheDocument();
    expect(screen.getByText(/Economic Tier/i)).toBeInTheDocument();
    expect(screen.getByText('Developed')).toBeInTheDocument();
    expect(screen.getByText(/Population Tier/i)).toBeInTheDocument();
    expect(screen.getByText('Tier 4')).toBeInTheDocument();
  });

  it('handles missing fields gracefully', () => {
    render(<ExecutiveDashboard countryData={{} as any} userId="test-user-id" />);
    expect(screen.getByText(/Economic Growth/i)).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });
}); 