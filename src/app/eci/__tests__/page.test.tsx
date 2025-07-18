import { render, screen, waitFor } from '@testing-library/react';
import ExecutiveCommandInterface from '../page';
import * as trpcReact from '@/trpc/react';
import * as clerk from '@clerk/nextjs';

jest.mock('@/trpc/react');
jest.mock('@clerk/nextjs');

const mockProfile = { userId: 'user1', countryId: 'country1' };
const mockCountryData = {
  id: 'country1',
  name: 'Testland',
  economicTier: 'Developed',
  populationTier: 4,
  adjustedGdpGrowth: 0.072,
  populationGrowthRate: 0.012,
  currentPopulation: 50000000,
};

describe('ExecutiveCommandInterface (ECI Page)', () => {
  beforeEach(() => {
    (clerk.useUser as jest.Mock).mockReturnValue({ user: { id: 'user1' } });
    (trpcReact.api.users.getProfile.useQuery as jest.Mock).mockReturnValue({ data: mockProfile });
    (trpcReact.api.countries.getByIdWithEconomicData.useQuery as jest.Mock).mockReturnValue({ data: mockCountryData });
  });

  it('renders loading state when profile is not loaded', () => {
    (trpcReact.api.users.getProfile.useQuery as jest.Mock).mockReturnValue({ data: undefined });
    render(<ExecutiveCommandInterface />);
    expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
  });

  it('renders ECI page with real data', async () => {
    render(<ExecutiveCommandInterface />);
    await waitFor(() => {
      expect(screen.getByText(/Executive Command Interface/i)).toBeInTheDocument();
      expect(screen.getByText(/Testland/i)).toBeInTheDocument();
      expect(screen.getByText(/Economic Development/i)).toBeInTheDocument();
      expect(screen.getByText(/Social Development/i)).toBeInTheDocument();
    });
  });

  it('handles missing country data gracefully', async () => {
    (trpcReact.api.countries.getByIdWithEconomicData.useQuery as jest.Mock).mockReturnValue({ data: undefined });
    render(<ExecutiveCommandInterface />);
    await waitFor(() => {
      expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
    });
  });
}); 