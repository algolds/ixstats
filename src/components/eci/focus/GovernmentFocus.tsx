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

// Helper to convert economic/population tier to a numeric score for charting
const tierToScore = (tier: string) => {
  const map: Record<string, number> = {
    'Impoverished': 1,
    'Developing': 2,
    'Developed': 3,
    'Healthy': 4,
    'Strong': 5,
    'Very Strong': 6,
    'Extravagant': 7,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, 'X': 8
  };
  return map[tier] || 0;
};

export function GovernmentFocus() {
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
    return <LoaderFour text="Loading Government Data..." />;
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
    economicTierScore: tierToScore(point.economicTier),
    populationTierScore: tierToScore(point.populationTier),
  }));
  // Prepare projections for future chart
  const projections = (countryData.projections || []).map((point: any) => ({
    date: point.formattedTime || point.ixTime || '',
    economicTierScore: tierToScore(point.economicTier),
    populationTierScore: tierToScore(point.populationTier),
  }));
  // Risk analytics
  const analytics = countryData.analytics || {};
  const riskFlags = analytics.riskFlags || [];
  const vulnerabilities = analytics.vulnerabilities || [];
  const volatility = analytics.volatility || {};

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <Card className="w-full max-w-2xl bg-black/30 border border-blue-500/30">
        <CardHeader>
          <CardTitle className="text-3xl flex items-center gap-2">
            <span role="img" aria-label="Government">🏛️</span> Government Focus Area
          </CardTitle>
          <Badge className="bg-blue-600/80 text-white">Live Data</Badge>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="text-lg text-gray-300 mb-2">{countryData.name}</div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-blue-300">Government Type</div>
                <div className="text-xl font-bold text-blue-200">{countryData.governmentType || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-blue-300">Economic Tier</div>
                <div className="text-xl font-bold text-blue-200">{countryData.economicTier}</div>
              </div>
              <div>
                <div className="text-sm text-blue-300">Population Tier</div>
                <div className="text-xl font-bold text-blue-200">{countryData.populationTier}</div>
              </div>
              <div>
                <div className="text-sm text-blue-300">Leader</div>
                <div className="text-xl font-bold text-blue-200">{countryData.leader || 'N/A'}</div>
              </div>
            </div>
            <div className="text-sm text-gray-400 mb-2">Last Calculated: {countryData.lastCalculated ? new Date(countryData.lastCalculated).toLocaleString() : 'N/A'}</div>
          </div>
          <Button variant="outline" className="border-blue-500 text-blue-300" onClick={() => router.back()}>
            ← Back to ECI
          </Button>
        </CardContent>
      </Card>

      {/* Advanced Analytics Section */}
      <div className="w-full max-w-4xl mt-8 space-y-8">
        {/* Historical Trends Chart */}
        <Card className="bg-black/20 border border-blue-500/20">
          <CardHeader>
            <CardTitle className="text-xl text-blue-200">Government Trends (Historical)</CardTitle>
          </CardHeader>
          <CardContent>
            {historical.length > 1 ? (
              <ChartContainer config={{ economicTierScore: { color: '#60a5fa', label: 'Economic Tier (Score)' }, populationTierScore: { color: '#818cf8', label: 'Population Tier (Score)' } }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historical} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: '#60a5fa' }} />
                    <YAxis yAxisId="left" tick={{ fill: '#60a5fa' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#818cf8' }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="economicTierScore" stroke="#60a5fa" name="Economic Tier (Score)" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="populationTierScore" stroke="#818cf8" name="Population Tier (Score)" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="text-gray-400">Not enough historical data for chart.</div>
            )}
          </CardContent>
        </Card>
        {/* Projections Chart */}
        <Card className="bg-black/20 border border-blue-500/20">
          <CardHeader>
            <CardTitle className="text-xl text-blue-200">Government Projections (Forecast)</CardTitle>
          </CardHeader>
          <CardContent>
            {projections.length > 1 ? (
              <ChartContainer config={{ economicTierScore: { color: '#60a5fa', label: 'Economic Tier (Score)' }, populationTierScore: { color: '#818cf8', label: 'Population Tier (Score)' } }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={projections} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: '#60a5fa' }} />
                    <YAxis yAxisId="left" tick={{ fill: '#60a5fa' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#818cf8' }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="economicTierScore" stroke="#60a5fa" name="Economic Tier (Score)" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="populationTierScore" stroke="#818cf8" name="Population Tier (Score)" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="text-gray-400">Not enough projection data for chart.</div>
            )}
          </CardContent>
        </Card>
        {/* Risk Analytics Panel */}
        <Card className="bg-black/20 border border-blue-500/20">
          <CardHeader>
            <CardTitle className="text-xl text-blue-200">Risk Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <span className="font-semibold text-blue-300">Risk Flags:</span>
              {riskFlags.length > 0 ? (
                <ul className="list-disc ml-6 text-blue-200">
                  {riskFlags.map((flag: string, i: number) => <li key={i}>{flag}</li>)}
                </ul>
              ) : <span className="text-gray-400 ml-2">None</span>}
            </div>
            <div className="mb-2">
              <span className="font-semibold text-blue-300">Vulnerabilities:</span>
              {vulnerabilities.length > 0 ? (
                <ul className="list-disc ml-6 text-blue-200">
                  {vulnerabilities.map((v: string, i: number) => <li key={i}>{v}</li>)}
                </ul>
              ) : <span className="text-gray-400 ml-2">None</span>}
            </div>
            <div>
              <span className="font-semibold text-blue-300">Volatility:</span>
              <span className="ml-2 text-blue-200">Economic Tier: {volatility.gdpVolatility ?? '--'} | Population Tier: {volatility.popVolatility ?? '--'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 