"use client";
import { Card, CardContent } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Badge } from "@/components/ui/badge";

interface GlobalStatsData {
  totalNations: number;
  globalGDP: number;
  activeDiplomats: number;
  onlineUsers: number;
  tradeVolume: number;
  activeConflicts: number;
}

interface GlobalStatsProps {
  data?: GlobalStatsData;
}

export function GlobalStats({ data }: GlobalStatsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount);
  };

  if (!data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-blue-900/20 border-blue-700/30">
            <CardContent className="p-4 text-center">
              <div className="h-8 bg-blue-800/30 rounded animate-pulse mb-2" />
              <div className="h-4 bg-blue-800/30 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      <Card className="bg-blue-900/20 border-blue-700/30">
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-100 mb-1">
            <NumberTicker value={data.totalNations} />
          </div>
          <div className="text-sm text-blue-300">Nations</div>
        </CardContent>
      </Card>

      <Card className="bg-blue-900/20 border-blue-700/30">
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-green-400 mb-1">
            <NumberTicker 
              value={data.globalGDP} 
              prefix="$" 
              decimalPlaces={1}
              suffix="T"
            />
          </div>
          <div className="text-sm text-blue-300">Global GDP</div>
        </CardContent>
      </Card>

      <Card className="bg-blue-900/20 border-blue-700/30">
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-purple-400 mb-1">
            <NumberTicker value={data.activeDiplomats} />
          </div>
          <div className="text-sm text-blue-300">Active Diplomats</div>
        </CardContent>
      </Card>

      <Card className="bg-blue-900/20 border-blue-700/30">
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400 mb-1">
            <NumberTicker value={data.onlineUsers} />
          </div>
          <div className="text-sm text-blue-300">Online Users</div>
        </CardContent>
      </Card>

      <Card className="bg-blue-900/20 border-blue-700/30">
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-400 mb-1">
            <NumberTicker 
              value={data.tradeVolume} 
              prefix="$" 
              decimalPlaces={1}
              suffix="B"
            />
          </div>
          <div className="text-sm text-blue-300">Trade Volume</div>
        </CardContent>
      </Card>

      <Card className="bg-blue-900/20 border-blue-700/30">
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-red-400 mb-1">
            <NumberTicker value={data.activeConflicts} />
          </div>
          <div className="text-sm text-blue-300">Active Conflicts</div>
        </CardContent>
      </Card>
    </div>
  );
}