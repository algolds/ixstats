// src/lib/ixtime/weather.ts
// In-Universe Meteorological Engine for the Prime Meridian of IxWorld (0° Longitude)

export type Season = "Spring" | "Summer" | "Autumn" | "Winter";

export type WeatherIconType =
  | "Sun"
  | "CloudSun"
  | "Cloud"
  | "CloudRain"
  | "Moon"
  | "Snowflake";

export interface PrimeMeridianWeather {
  tempC: number;
  tempF: number;
  season: Season;
  condition: string;
  icon: WeatherIconType;
  summary: string;
  diurnalPhase: "Night" | "Morning" | "Afternoon" | "Evening";
}

/**
 * Deterministic pseudo-random number generator from an integer seed.
 * Range: [0, 1)
 */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 9999.123) * 10000;
  return x - Math.floor(x);
}

/**
 * Calculates in-universe meteorological conditions at the Prime Meridian (0° Longitude) of IxWorld.
 *
 * Combines:
 * - Orbital seasonal baseline (Summer ~22°C, Autumn ~14°C, Spring ~15°C, Winter ~3°C)
 * - Solar diurnal sine curve (minimum at ~05:00, peak at ~14:30 solar time)
 * - Atmospheric weather condition variations derived from the day seed
 */
export function getPrimeMeridianWeather(date: Date): PrimeMeridianWeather {
  const month = date.getUTCMonth(); // 0-11
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60;

  // 1. Season Determination (Northern standard canon baseline)
  let season: Season;
  let baseSeasonTemp: number;

  if (month >= 2 && month <= 4) {
    season = "Spring";
    baseSeasonTemp = 15;
  } else if (month >= 5 && month <= 7) {
    season = "Summer";
    baseSeasonTemp = 22;
  } else if (month >= 8 && month <= 10) {
    season = "Autumn";
    baseSeasonTemp = 13;
  } else {
    season = "Winter";
    baseSeasonTemp = 3;
  }

  // 2. Diurnal Solar Variation (Sine wave peaking at 14.5 hours)
  // Shift so peak is at 14.5: (hours - 14.5) / 24 * 2 * Math.PI
  const solarAngle = ((hours - 14.5) / 24) * 2 * Math.PI;
  const diurnalSwing = 5.5 * Math.cos(solarAngle); // range: -5.5°C to +5.5°C

  // 3. Daily Atmospheric Variance based on epoch day seed
  const epochDay = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
  const daySeed = pseudoRandom(epochDay);
  const dayVariance = (daySeed - 0.5) * 4; // range: -2°C to +2°C

  const rawTempC = Math.round(baseSeasonTemp + diurnalSwing + dayVariance);
  const tempF = Math.round((rawTempC * 9) / 5 + 32);

  // 4. Diurnal Phase & Condition
  const isNight = hours < 6 || hours >= 21;
  let diurnalPhase: PrimeMeridianWeather["diurnalPhase"];
  if (hours >= 6 && hours < 12) diurnalPhase = "Morning";
  else if (hours >= 12 && hours < 18) diurnalPhase = "Afternoon";
  else if (hours >= 18 && hours < 21) diurnalPhase = "Evening";
  else diurnalPhase = "Night";

  // Atmospheric weather conditions
  let condition: string;
  let icon: WeatherIconType;

  if (season === "Winter" && rawTempC <= 1) {
    if (daySeed > 0.6) {
      condition = "Snow Flurries";
      icon = "Snowflake";
    } else if (daySeed > 0.3) {
      condition = "Overcast & Frost";
      icon = "Cloud";
    } else {
      condition = isNight ? "Clear & Freezing" : "Crisp Sun";
      icon = isNight ? "Moon" : "Sun";
    }
  } else if (daySeed > 0.75) {
    condition = "Passing Showers";
    icon = "CloudRain";
  } else if (daySeed > 0.5) {
    condition = isNight ? "Partly Cloudy" : "Partly Sunny";
    icon = isNight ? "Moon" : "CloudSun";
  } else if (daySeed > 0.25) {
    condition = "Overcast";
    icon = "Cloud";
  } else {
    condition = isNight ? "Clear Skies" : "Fair & Clear";
    icon = isNight ? "Moon" : "Sun";
  }

  const summary = `Prime Meridian (0° Longitude) • ${season} ${year} • ${condition}, ${rawTempC}°C (${tempF}°F)`;

  return {
    tempC: rawTempC,
    tempF,
    season,
    condition,
    icon,
    summary,
    diurnalPhase,
  };
}
