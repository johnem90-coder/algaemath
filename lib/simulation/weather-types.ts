/** One hour of weather observation */
export interface HourlyWeather {
  hour: number;
  temperature: number; // °C
  relativeHumidity: number; // 0–100 %
  dewPoint: number; // °C
  cloudCover: number; // 0–100 %
  windSpeed: number; // m/s (10m)
  windDirection: number; // degrees (10m)
  precipitation: number; // mm
  directRadiation: number; // W/m² direct beam on horizontal surface
  diffuseRadiation: number; // W/m² diffuse component
  shortwaveRadiation: number; // W/m² GHI (direct + diffuse, for cross-check)
  soilTemperature: number; // °C (7–28 cm depth)
  solarElevation: number; // degrees above horizon (calculated)
  solarAzimuth: number; // degrees from north (calculated)
}

/** Averaged weather for a single "typical day" across a date range */
export interface DayProfile {
  hours: HourlyWeather[]; // 24 entries, one per hour (0–23)
}

/** Raw hourly observations for each day in the date range */
export interface RawDayData {
  date: string; // "YYYY-MM-DD"
  hours: HourlyWeather[]; // 24 entries
}

/** Full weather dataset for a location + season */
export interface SeasonWeather {
  location: string;
  lat: number;
  lng: number;
  season: string;
  startDate: string;
  endDate: string;
  raw: RawDayData[]; // full 14-day hourly data (for display/download)
  profile: DayProfile; // averaged typical day (for driving simulation)
}

/** Cache structure: city name → season → SeasonWeather */
export type WeatherCache = Record<string, Record<string, SeasonWeather>>;
