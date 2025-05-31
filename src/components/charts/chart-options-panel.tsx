// src/components/charts/chart-options-panel.tsx
import { Switch } from "~/components/ui/switch";
import { Slider } from "~/components/ui/slider";
import { Label } from "~/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "~/components/ui/select";
import { useChartContext } from "~/context/chart-context";
import type { TimeResolutionType } from "~/context/ixstats-context";

interface ChartOptionsPanelProps {
  showResolutionControl?: boolean;
  showForecastControl?: boolean;
}

export function ChartOptionsPanel({
  showResolutionControl = true,
  showForecastControl = true
}: ChartOptionsPanelProps) {
  const { 
    timeResolution, 
    setTimeResolution,
    showForecast,
    setShowForecast,
    forecastYears,
    setForecastYears,
    normalizeValues,
    setNormalizeValues
  } = useChartContext();
  
  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-md">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="normalize-values">Normalize Values</Label>
          <Switch
            id="normalize-values"
            checked={normalizeValues}
            onCheckedChange={setNormalizeValues}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Display values in millions/billions for readability
        </p>
      </div>
      
      {showResolutionControl && (
        <div className="space-y-2">
          <Label htmlFor="time-resolution">Time Resolution</Label>
          <Select
            value={timeResolution}
            onValueChange={(value) => setTimeResolution(value as TimeResolutionType)}
          >
            <SelectTrigger id="time-resolution">
              <SelectValue placeholder="Select resolution" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="annual">Annual</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      
      {showForecastControl && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="show-forecast">Show Forecast</Label>
            <Switch
              id="show-forecast"
              checked={showForecast}
              onCheckedChange={setShowForecast}
            />
          </div>
          
          {showForecast && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="forecast-years">Forecast Years: {forecastYears}</Label>
              </div>
              <Slider
                id="forecast-years"
                min={1}
                max={20}
                step={1}
                value={[forecastYears]}
                onValueChange={(values) => setForecastYears(values[0])}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
