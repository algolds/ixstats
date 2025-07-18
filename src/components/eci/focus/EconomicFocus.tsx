import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoaderFour } from '@/components/ui/loader';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { api } from '@/trpc/react';
import type { CountryWithEconomicData } from '@/types/ixstats';
import { HistoricalTrends } from './HistoricalTrends';

export function EconomicFocus() {
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
    return <LoaderFour text="Loading Economic Data..." />;
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
    gdp: point.totalGdp,
    gdpPerCapita: point.gdpPerCapita,
    growthRate: (point.gdpGrowthRate || 0) * 100,
  }));
  // Prepare projections for future chart
  const projections = (countryData.projections || []).map((point: any) => ({
    date: point.formattedTime || point.ixTime || '',
    gdp: point.totalGdp,
    gdpPerCapita: point.gdpPerCapita,
    growthRate: (point.gdpGrowthRate || 0) * 100,
  }));
  // Risk analytics
  const analytics = countryData.analytics || {};
  const riskFlags = analytics.riskFlags || [];
  const vulnerabilities = analytics.vulnerabilities || [];
  const volatility = analytics.volatility || {};

  const chartConfig = {
    gdp: { color: '#f59e42', label: 'GDP' },
    gdpPerCapita: { color: '#fbbf24', label: 'GDP per Capita' },
    growthRate: { color: '#10b981', label: 'Growth Rate' },
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <Card className="w-full max-w-2xl bg-black/30 border border-orange-500/30">
        <CardHeader>
          <CardTitle className="text-3xl flex items-center gap-2">
            <span role="img" aria-label="Economic">💰</span> Economic Focus Area
          </CardTitle>
          <Badge className="bg-orange-600/80 text-white">Live Data</Badge>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="text-lg text-gray-300 mb-2">{countryData.name}</div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-orange-300">Total GDP</div>
                <div className="text-xl font-bold text-orange-200">${(countryData.currentTotalGdp/1e12).toFixed(2)}T</div>
              </div>
              <div>
                <div className="text-sm text-orange-300">GDP per Capita</div>
                <div className="text-xl font-bold text-orange-200">${countryData.currentGdpPerCapita.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-orange-300">Growth Rate</div>
                <div className={`text-xl font-bold ${countryData.adjustedGdpGrowth > 0 ? 'text-green-400' : 'text-red-400'}`}>{(countryData.adjustedGdpGrowth*100).toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-sm text-orange-300">Economic Tier</div>
                <div className="text-xl font-bold text-orange-200">{countryData.economicTier}</div>
              </div>
            </div>
            <div className="text-sm text-gray-400 mb-2">Last Calculated: {countryData.lastCalculated ? new Date(countryData.lastCalculated).toLocaleString() : 'N/A'}</div>
          </div>
          <Button variant="outline" className="border-orange-500 text-orange-300" onClick={() => router.back()}>
            ← Back to ECI
          </Button>
        </CardContent>
      </Card>

      {/* Advanced Analytics Section */}
      <div className="w-full max-w-4xl mt-8 space-y-8">
        <HistoricalTrends
          title="Economic Trends (Historical)"
          data={historical}
          config={chartConfig}
          leftKeys={["gdp", "gdpPerCapita"]}
          rightKeys={["growthRate"]}
          leftLabelColor="#f59e42"
          rightLabelColor="#10b981"
        />
        <HistoricalTrends
          title="Economic Projections (Forecast)"
          data={projections}
          config={chartConfig}
          leftKeys={["gdp", "gdpPerCapita"]}
          rightKeys={["growthRate"]}
          leftLabelColor="#f59e42"
          rightLabelColor="#10b981"
        />
        {/* Risk Analytics Panel */}
        <Card className="bg-black/20 border border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-xl text-orange-200">Risk Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <span className="font-semibold text-orange-300">Risk Flags:</span>
              {riskFlags.length > 0 ? (
                <ul className="list-disc ml-6 text-orange-200">
                  {riskFlags.map((flag: string, i: number) => <li key={i}>{flag}</li>)}
                </ul>
              ) : <span className="text-gray-400 ml-2">None</span>}
            </div>
            <div className="mb-2">
              <span className="font-semibold text-orange-300">Vulnerabilities:</span>
              {vulnerabilities.length > 0 ? (
                <ul className="list-disc ml-6 text-orange-200">
                  {vulnerabilities.map((v: string, i: number) => <li key={i}>{v}</li>)}
                </ul>
              ) : <span className="text-gray-400 ml-2">None</span>}
            </div>
            <div>
              <span className="font-semibold text-orange-300">Volatility:</span>
              <span className="ml-2 text-orange-200">GDP: {volatility.gdpVolatility ?? '--'} | Population: {volatility.popVolatility ?? '--'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 