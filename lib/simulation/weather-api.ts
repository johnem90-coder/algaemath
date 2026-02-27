import type {
  HourlyWeather,
  DayProfile,
  RawDayData,
  SeasonWeather,
} from "./weather-types";

const BASE_URL = "https://archive-api.open-meteo.com/v1/archive";

const HOURLY_PARAMS = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "cloud_cover",
  "wind_speed_10m",
  "wind_direction_10m",
  "precipitation",
  "direct_radiation",
  "diffuse_radiation",
  "shortwave_radiation",
  "soil_temperature_7_to_28cm",
].join(",");

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    dew_point_2m: number[];
    cloud_cover: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    precipitation: number[];
    direct_radiation: number[];
    diffuse_radiation: number[];
    shortwave_radiation: number[];
    soil_temperature_7_to_28cm: number[];
  };
}

const DEG = Math.PI / 180;

/**
 * Calculate solar position (elevation & azimuth) using simplified NOAA/Meeus formulas.
 * hour is in the location's local civil time; we convert to UTC via longitude.
 */
function solarPosition(lat: number, lng: number, dateStr: string, hour: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcHour = hour + 0.5 - lng / 15;
  const ms = Date.UTC(y, m - 1, d, 0, 0, 0) + utcHour * 3600000;
  const jd = ms / 86400000 + 2440587.5;
  const n = jd - 2451545.0;

  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;

  const epsilon = 23.439 * DEG - 0.0000004 * n * DEG;
  const sinDec = Math.sin(epsilon) * Math.sin(lambda);
  const dec = Math.asin(sinDec);

  const cosRA = Math.cos(lambda);
  const sinRA = Math.cos(epsilon) * Math.sin(lambda);
  let ra = Math.atan2(sinRA, cosRA);

  const gmst = (280.46061837 + 360.98564736629 * n) % 360;
  let ha = (gmst + lng - ra / DEG) % 360;
  if (ha > 180) ha -= 360;
  if (ha < -180) ha += 360;
  ha *= DEG;

  const latRad = lat * DEG;
  const sinElev = Math.sin(latRad) * Math.sin(dec) + Math.cos(latRad) * Math.cos(dec) * Math.cos(ha);
  const elevation = Math.asin(sinElev) / DEG;

  const cosAz = (Math.sin(dec) - Math.sin(latRad) * sinElev) / (Math.cos(latRad) * Math.cos(Math.asin(sinElev)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) / DEG;
  if (Math.sin(ha) > 0) azimuth = 360 - azimuth;

  return { elevation: round1(elevation), azimuth: round1(azimuth) };
}

/**
 * Fetch historical weather data from Open-Meteo for a location and date range.
 * Returns both the full raw daily data and an averaged "typical day" profile.
 */
export async function fetchSeasonWeather(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
  opts?: { location?: string; season?: string }
): Promise<SeasonWeather> {
  const url = new URL(BASE_URL);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("hourly", HOURLY_PARAMS);
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Open-Meteo API error: ${res.status} ${res.statusText}`);
  }

  const data: OpenMeteoResponse = await res.json();
  const { hourly } = data;

  // Group into days
  const dayMap = new Map<string, HourlyWeather[]>();
  for (let i = 0; i < hourly.time.length; i++) {
    const date = hourly.time[i].slice(0, 10); // "YYYY-MM-DD"
    const hour = parseInt(hourly.time[i].slice(11, 13), 10);
    const solar = solarPosition(lat, lng, date, hour);
    const entry: HourlyWeather = {
      hour,
      temperature: hourly.temperature_2m[i],
      relativeHumidity: hourly.relative_humidity_2m[i],
      dewPoint: hourly.dew_point_2m[i],
      cloudCover: hourly.cloud_cover[i],
      windSpeed: hourly.wind_speed_10m[i],
      windDirection: hourly.wind_direction_10m[i],
      precipitation: hourly.precipitation[i],
      directRadiation: hourly.direct_radiation[i],
      diffuseRadiation: hourly.diffuse_radiation[i],
      shortwaveRadiation: hourly.shortwave_radiation[i],
      soilTemperature: hourly.soil_temperature_7_to_28cm[i],
      solarElevation: solar.elevation,
      solarAzimuth: solar.azimuth,
    };
    if (!dayMap.has(date)) dayMap.set(date, []);
    dayMap.get(date)!.push(entry);
  }

  // Build raw day array
  const raw: RawDayData[] = [];
  for (const [date, hours] of dayMap) {
    // Ensure 24 entries sorted by hour
    hours.sort((a, b) => a.hour - b.hour);
    raw.push({ date, hours });
  }
  raw.sort((a, b) => a.date.localeCompare(b.date));

  // Average across all days to build a typical day profile
  const profile = averageDays(raw);

  return {
    location: opts?.location ?? `${lat},${lng}`,
    lat,
    lng,
    season: opts?.season ?? "",
    startDate,
    endDate,
    raw,
    profile,
  };
}

/** Average hourly data across multiple days into a single DayProfile */
function averageDays(days: RawDayData[]): DayProfile {
  const hours: HourlyWeather[] = [];

  for (let h = 0; h < 24; h++) {
    let temperature = 0, relativeHumidity = 0, dewPoint = 0, cloudCover = 0, windSpeed = 0;
    let windDirSin = 0, windDirCos = 0;
    let precipitation = 0, directRadiation = 0, diffuseRadiation = 0;
    let shortwaveRadiation = 0, soilTemperature = 0;
    let solarElevation = 0, solarAzSin = 0, solarAzCos = 0;
    let count = 0;

    for (const day of days) {
      const entry = day.hours.find((e) => e.hour === h);
      if (!entry) continue;
      count++;
      temperature += entry.temperature;
      relativeHumidity += entry.relativeHumidity;
      dewPoint += entry.dewPoint;
      cloudCover += entry.cloudCover;
      windSpeed += entry.windSpeed;
      const wRad = (entry.windDirection * Math.PI) / 180;
      windDirSin += Math.sin(wRad);
      windDirCos += Math.cos(wRad);
      precipitation += entry.precipitation;
      directRadiation += entry.directRadiation;
      diffuseRadiation += entry.diffuseRadiation;
      shortwaveRadiation += entry.shortwaveRadiation;
      soilTemperature += entry.soilTemperature;
      solarElevation += entry.solarElevation;
      const azRad = (entry.solarAzimuth * Math.PI) / 180;
      solarAzSin += Math.sin(azRad);
      solarAzCos += Math.cos(azRad);
    }

    if (count === 0) count = 1;
    const avgWindDir = ((Math.atan2(windDirSin / count, windDirCos / count) * 180) / Math.PI + 360) % 360;
    const avgSolarAz = ((Math.atan2(solarAzSin / count, solarAzCos / count) * 180) / Math.PI + 360) % 360;

    hours.push({
      hour: h,
      temperature: round1(temperature / count),
      relativeHumidity: round1(relativeHumidity / count),
      dewPoint: round1(dewPoint / count),
      cloudCover: round1(cloudCover / count),
      windSpeed: round1(windSpeed / count),
      windDirection: Math.round(avgWindDir),
      precipitation: round1(precipitation / count),
      directRadiation: round1(directRadiation / count),
      diffuseRadiation: round1(diffuseRadiation / count),
      shortwaveRadiation: round1(shortwaveRadiation / count),
      soilTemperature: round1(soilTemperature / count),
      solarElevation: round1(solarElevation / count),
      solarAzimuth: round1(avgSolarAz),
    });
  }

  return { hours };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
