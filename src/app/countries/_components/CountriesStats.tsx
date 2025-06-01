'use client';

import { Card, CardContent } from '~/components/ui/card';
import {
  formatPopulation,
  formatCurrency
} from '~/lib/chart-utils';

interface CountriesStatsProps {
  totalCountries: number;
  showing: number;
  totalPopulation: number;
  combinedGdp: number;
}

export function CountriesStats({
  totalCountries,
  showing,
  totalPopulation,
  combinedGdp
}: CountriesStatsProps) {
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Total Countries</p>
            <p className="text-2xl font-bold">
              {totalCountries.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Showing</p>
            <p className="text-2xl font-bold">
              {showing.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Total Population
            </p>
            <p className="text-2xl font-bold">
              {formatPopulation(totalPopulation)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Combined GDP
            </p>
            <p className="text-2xl font-bold">
              {formatCurrency(combinedGdp)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
