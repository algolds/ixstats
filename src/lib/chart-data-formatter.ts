// src/lib/chart-data-formatter.ts
import { formatNumber } from "~/lib/format";
import { IxTime } from "~/lib/ixtime";
import type { ChartDataPoint } from "~/lib/chart-data-processor";
import type { ChartType } from "~/app/countries/_components/detail";

export interface FormattedChartDataPoint extends ChartDataPoint {
  formattedPopulation: string;
  formattedGdpPerCapita: string;
  formattedTotalGdp: string;
  formattedPopulationDensity: string;
  formattedGdpDensity: string;
}

export interface ChartFormatOptions {
  useCompactNumbers: boolean;
  currencySymbol: string;
  labelFormat: 'short' | 'full';
}

export class ChartDataFormatter {
  /**
   * Format chart data points with human-readable values
   */
  static formatChartData(
    data: ChartDataPoint[],
    options: ChartFormatOptions = {
      useCompactNumbers: true,
      currencySymbol: '$',
      labelFormat: 'short'
    }
  ): FormattedChartDataPoint[] {
    return data.map(point => ({
      ...point,
      formattedPopulation: this.formatPopulation(point.population, options.useCompactNumbers),
      formattedGdpPerCapita: this.formatGdpPerCapita(point.gdpPerCapita, options),
      formattedTotalGdp: this.formatTotalGdp(point.totalGdp, options),
      formattedPopulationDensity: this.formatPopulationDensity(point.populationDensity, options.useCompactNumbers),
      formattedGdpDensity: this.formatGdpDensity(point.gdpDensity, options)
    }));
  }

  /**
   * Format population value (already in millions)
   */
  static formatPopulation(value: number | undefined | null, compact: boolean): string {
    if (value == null) return 'N/A';
    return `${formatNumber(value, false, 1, compact)}${compact ? '' : ' million'}`;
  }

  /**
   * Format GDP per capita
   */
  static formatGdpPerCapita(value: number | undefined | null, options: ChartFormatOptions): string {
    if (value == null) return 'N/A';
    return formatNumber(value, true, 0, options.useCompactNumbers);
  }

  /**
   * Format total GDP (already in billions)
   */
  static formatTotalGdp(value: number | undefined | null, options: ChartFormatOptions): string {
    if (value == null) return 'N/A';
    return `${formatNumber(value, true, 1, options.useCompactNumbers)}${options.useCompactNumbers ? '' : ' billion'}`;
  }

  /**
   * Format population density
   */
  static formatPopulationDensity(value: number | undefined | null, compact: boolean): string {
    if (value == null) return 'N/A';
    return `${formatNumber(value, false, 1, compact)}${compact ? '' : ' per km²'}`;
  }

  /**
   * Format GDP density
   */
  static formatGdpDensity(value: number | undefined | null, options: ChartFormatOptions): string {
    if (value == null) return 'N/A';
    return `${formatNumber(value, true, 1, options.useCompactNumbers)}${options.useCompactNumbers ? '' : ' per km²'}`;
  }

  /**
   * Get appropriate unit label for a chart type
   */
  static getUnitLabel(chartType: ChartType, compact: boolean = true): string {
    switch (chartType) {
      case 'population':
        return compact ? 'Population (M)' : 'Population (millions)';
      case 'gdp':
        return compact ? 'GDP ($B)' : 'GDP ($ billions)';
      case 'gdpPerCapita':
        return compact ? 'GDP/capita ($)' : 'GDP per capita ($)';
      case 'density':
        return compact ? 'Pop/km²' : 'Population per km²';
      default:
        return '';
    }
  }

  /**
   * Format a timestamp for chart display
   */
  static formatTimeLabel(timestamp: number, format: 'short' | 'full' = 'short'): string {
    if (format === 'short') {
      return IxTime.getCurrentGameYear(timestamp).toString();
    } else {
      return IxTime.formatIxTime(timestamp, false);
    }
  }
}
