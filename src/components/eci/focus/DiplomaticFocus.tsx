import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoaderFour } from '@/components/ui/loader';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { api } from '@/trpc/react';
import type { CountryWithEconomicData } from '@/types/ixstats';
import { ChartContainer } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

// Helper to convert economic tier to a numeric score for charting
const tierToScore = (tier: string) => {
  const map: Record<string, number> = {
    'Impoverished': 1,
    'Developing': 2,
    'Developed': 3,
    'Healthy': 4,
    'Strong': 5,
    'Very Strong': 6,
    'Extravagant': 7
  };
  return map[tier] || 0;
};

export function DiplomaticFocus() {
  const router = useRouter();
  const { user } = useUser();
  const { data: profile, isLoading: profileLoading, error: profileError } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );
  const { data: countryData, isLoading: countryLoading, error: countryError } = api.countries.getByIdWithEconomicData.useQuery(
    { id: profile?.countryId || '' },
    { enabled: !!profile?.countryId, refetchInterval: 30000 }
  );

  if (profileLoading || countryLoading) {
    return <LoaderFour text="Loading Diplomatic Data..." />;
  }
  if (profileError || countryError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500 mb-2">Failed to load data</div>
          <div className="text-gray-400 mb-4">Please try again later or contact support if the problem persists.</div>
        </div>
      </div>
    );
  }
  if (!countryData) {
    return <LoaderFour text="Loading country data..." />;
  }

  // Prepare historical data for charts
  const historical = (countryData.historical || []).map((point: any) => ({
    date: point.formattedTime || point.ixTimeTimestamp || '',
    tradeCapacity: point.totalGdp,
    economicTierScore: tierToScore(point.economicTier),
  }));
  // Prepare projections for future chart
  const projections = (countryData.projections || []).map((point: any) => ({
    date: point.formattedTime || point.ixTime || '',
    tradeCapacity: point.totalGdp,
    economicTierScore: tierToScore(point.economicTier),
  }));
  // Risk analytics
  const analytics = countryData.analytics || {};
  const riskFlags = analytics.riskFlags || [];
  const vulnerabilities = analytics.vulnerabilities || [];
  const volatility = analytics.volatility || {};

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <Card className="w-full max-w-2xl bg-black/30 border border-green-500/30">
        <CardHeader>
          <CardTitle className="text-3xl flex items-center gap-2">
            <span role="img" aria-label="Diplomatic">🤝</span> Diplomatic Focus Area
          </CardTitle>
          <Badge className="bg-green-600/80 text-white">Live Data</Badge>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="text-lg text-gray-300 mb-2">{countryData.name}</div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-green-300">Region</div>
                <div className="text-xl font-bold text-green-200">{countryData.region || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-green-300">Trade Capacity</div>
                <div className="text-xl font-bold text-green-200">${(countryData.currentTotalGdp/1e12).toFixed(2)}T</div>
              </div>
              <div>
                <div className="text-sm text-green-300">Economic Tier</div>
                <div className="text-xl font-bold text-green-200">{countryData.economicTier}</div>
              </div>
              <div>
                <div className="text-sm text-green-300">Population Tier</div>
                <div className="text-xl font-bold text-green-200">{countryData.populationTier}</div>
              </div>
            </div>
            <div className="text-sm text-gray-400 mb-2">Last Calculated: {countryData.lastCalculated ? new Date(countryData.lastCalculated).toLocaleString() : 'N/A'}</div>
          </div>
          <Button variant="outline" className="border-green-500 text-green-300" onClick={() => router.back()}>
            ← Back to ECI
          </Button>
        </CardContent>
      </Card>

      {/* Advanced Analytics Section */}
      <div className="w-full max-w-4xl mt-8 space-y-8">
        {/* Historical Trends Chart */}
        <Card className="bg-black/20 border border-green-500/20">
          <CardHeader>
            <CardTitle className="text-xl text-green-200">Diplomatic Trends (Historical)</CardTitle>
          </CardHeader>
          <CardContent>
            {historical.length > 1 ? (
              <ChartContainer config={{ tradeCapacity: { color: '#34d399', label: 'Trade Capacity (GDP)' }, economicTierScore: { color: '#6ee7b7', label: 'Economic Tier (Score)' } }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historical} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: '#34d399' }} />
                    <YAxis yAxisId="left" tick={{ fill: '#34d399' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6ee7b7' }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="tradeCapacity" stroke="#34d399" name="Trade Capacity (GDP)" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="economicTierScore" stroke="#6ee7b7" name="Economic Tier (Score)" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="text-gray-400">Not enough historical data for chart.</div>
            )}
          </CardContent>
        </Card>
        {/* Projections Chart */}
        <Card className="bg-black/20 border border-green-500/20">
          <CardHeader>
            <CardTitle className="text-xl text-green-200">Diplomatic Projections (Forecast)</CardTitle>
          </CardHeader>
          <CardContent>
            {projections.length > 1 ? (
              <ChartContainer config={{ tradeCapacity: { color: '#34d399', label: 'Trade Capacity (GDP)' }, economicTierScore: { color: '#6ee7b7', label: 'Economic Tier (Score)' } }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={projections} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: '#34d399' }} />
                    <YAxis yAxisId="left" tick={{ fill: '#34d399' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6ee7b7' }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="tradeCapacity" stroke="#34d399" name="Trade Capacity (GDP)" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="economicTierScore" stroke="#6ee7b7" name="Economic Tier (Score)" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="text-gray-400">Not enough projection data for chart.</div>
            )}
          </CardContent>
        </Card>
        {/* Risk Analytics Panel */}
        <Card className="bg-black/20 border border-green-500/20">
          <CardHeader>
            <CardTitle className="text-xl text-green-200">Risk Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <span className="font-semibold text-green-300">Risk Flags:</span>
              {riskFlags.length > 0 ? (
                <ul className="list-disc ml-6 text-green-200">
                  {riskFlags.map((flag: string, i: number) => <li key={i}>{flag}</li>)}
                </ul>
              ) : <span className="text-gray-400 ml-2">None</span>}
            </div>
            <div className="mb-2">
              <span className="font-semibold text-green-300">Vulnerabilities:</span>
              {vulnerabilities.length > 0 ? (
                <ul className="list-disc ml-6 text-green-200">
                  {vulnerabilities.map((v: string, i: number) => <li key={i}>{v}</li>)}
                </ul>
              ) : <span className="text-gray-400 ml-2">None</span>}
            </div>
            <div>
              <span className="font-semibold text-green-300">Volatility:</span>
              <span className="ml-2 text-green-200">Trade Capacity: {volatility.gdpVolatility ?? '--'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 