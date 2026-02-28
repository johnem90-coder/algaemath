/**
 * Fetches historical weather data from Open-Meteo for all simulator cities
 * and writes individual JSON files to public/weather/{city-slug}.json.
 *
 * Southern-hemisphere cities get inverted season-to-date mappings so that
 * "summer" always means local summer regardless of hemisphere.
 *
 * Usage: node scripts/generate-weather-data.mjs
 */

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

/* ── Cities (must match WorldMap.tsx CITIES array) ──────────────────── */

const CITIES = [
  // Australia
  { name: "Sydney", lat: -33.87, lng: 151.21 },
  { name: "Perth", lat: -31.95, lng: 115.86 },
  { name: "Alice Springs", lat: -23.7, lng: 133.88 },
  // India
  { name: "Delhi", lat: 28.61, lng: 77.21 },
  { name: "Pune", lat: 18.52, lng: 73.86 },
  { name: "Bangalore", lat: 12.97, lng: 77.59 },
  // United States
  { name: "Gainesville", lat: 29.65, lng: -82.32 },
  { name: "Dallas", lat: 32.78, lng: -96.8 },
  { name: "San Diego", lat: 32.72, lng: -117.16 },
  { name: "Honolulu", lat: 21.31, lng: -157.86 },
  // South America
  { name: "Lima", lat: -12.05, lng: -77.04 },
  { name: "Santiago", lat: -33.45, lng: -70.67 },
  { name: "Natal", lat: -5.79, lng: -35.21 },
  // Central America
  { name: "Mexico City", lat: 19.43, lng: -99.13 },
  // Southeast Asia
  { name: "Ho Chi Minh City", lat: 10.82, lng: 106.63 },
  // Middle East
  { name: "Muscat", lat: 23.59, lng: 58.54 },
  { name: "Jeddah", lat: 21.49, lng: 39.19 },
  // North Africa
  { name: "Cairo", lat: 30.04, lng: 31.24 },
  { name: "Tripoli", lat: 32.9, lng: 13.18 },
  { name: "Casablanca", lat: 33.57, lng: -7.59 },
  // Europe
  { name: "Madrid", lat: 40.42, lng: -3.7 },
  { name: "Rome", lat: 41.9, lng: 12.5 },
  { name: "Paris", lat: 48.86, lng: 2.35 },
  { name: "Berlin", lat: 52.52, lng: 13.41 },
  // Sub-Saharan Africa
  { name: "Dakar", lat: 14.69, lng: -17.44 },
  { name: "Lagos", lat: 6.52, lng: 3.38 },
  { name: "Mombasa", lat: -4.05, lng: 39.67 },
  { name: "Cape Town", lat: -33.93, lng: 18.42 },
  { name: "Johannesburg", lat: -26.2, lng: 28.04 },
];

/* ── Season date ranges ─────────────────────────────────────────────── */

// Northern hemisphere: standard meteorological seasons
const NH_SEASONS = {
  spring: { start: "2024-03-01", end: "2024-03-14" },
  summer: { start: "2024-06-01", end: "2024-06-14" },
  autumn: { start: "2024-09-01", end: "2024-09-14" },
  winter: { start: "2024-12-01", end: "2024-12-14" },
};

// Southern hemisphere: seasons shifted 6 months so "summer" = local summer
const SH_SEASONS = {
  spring: { start: "2024-09-01", end: "2024-09-14" },
  summer: { start: "2024-12-01", end: "2024-12-14" },
  autumn: { start: "2024-03-01", end: "2024-03-14" },
  winter: { start: "2024-06-01", end: "2024-06-14" },
};

/* ── Helpers ─────────────────────────────────────────────────────────── */

const DEG = Math.PI / 180;

function round1(v) {
  return Math.round(v * 10) / 10;
}

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Calculate solar position (elevation & azimuth) using simplified astronomical formulas.
 * Based on NOAA Solar Calculator / Meeus approximations.
 *
 * hour is in the location's local civil time (from Open-Meteo with timezone=auto).
 * We convert to UTC using longitude/15 as an approximation of the timezone offset,
 * which avoids dependence on the machine's local timezone.
 */
function solarPosition(lat, lng, dateStr, hour) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcHour = hour + 0.5 - lng / 15; // +0.5 for mid-hour, subtract lng-based offset
  const ms = Date.UTC(y, m - 1, d, 0, 0, 0) + utcHour * 3600000;
  const jd = ms / 86400000 + 2440587.5;
  const n = jd - 2451545.0;

  // Mean solar longitude, anomaly, ecliptic longitude
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;

  // Obliquity and declination
  const epsilon = 23.439 * DEG - 0.0000004 * n * DEG;
  const sinDec = Math.sin(epsilon) * Math.sin(lambda);
  const dec = Math.asin(sinDec);

  // Right ascension
  const cosRA = Math.cos(lambda);
  const sinRA = Math.cos(epsilon) * Math.sin(lambda);
  let ra = Math.atan2(sinRA, cosRA);

  // Greenwich mean sidereal time
  const gmst = (280.46061837 + 360.98564736629 * n) % 360;
  // Local hour angle
  let ha = (gmst + lng - ra / DEG) % 360;
  if (ha > 180) ha -= 360;
  if (ha < -180) ha += 360;
  ha *= DEG;

  const latRad = lat * DEG;

  // Elevation
  const sinElev = Math.sin(latRad) * Math.sin(dec) + Math.cos(latRad) * Math.cos(dec) * Math.cos(ha);
  const elevation = Math.asin(sinElev) / DEG;

  // Azimuth (from north, clockwise)
  const cosAz = (Math.sin(dec) - Math.sin(latRad) * sinElev) / (Math.cos(latRad) * Math.cos(Math.asin(sinElev)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) / DEG;
  if (Math.sin(ha) > 0) azimuth = 360 - azimuth;

  return { elevation: round1(elevation), azimuth: round1(azimuth) };
}

/* ── API fetch ──────────────────────────────────────────────────────── */

async function fetchWeather(lat, lng, startDate, endDate) {
  const url = new URL(BASE_URL);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("hourly", HOURLY_PARAMS);
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

/* ── Process API response into SeasonWeather ────────────────────────── */

function processResponse(data, location, season, lat, lng, startDate, endDate) {
  const { hourly } = data;

  // Group into days
  const dayMap = new Map();
  for (let i = 0; i < hourly.time.length; i++) {
    const date = hourly.time[i].slice(0, 10);
    const hour = parseInt(hourly.time[i].slice(11, 13), 10);
    const solar = solarPosition(lat, lng, date, hour);
    const entry = {
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
    dayMap.get(date).push(entry);
  }

  const raw = [];
  for (const [date, hours] of dayMap) {
    hours.sort((a, b) => a.hour - b.hour);
    raw.push({ date, hours });
  }
  raw.sort((a, b) => a.date.localeCompare(b.date));

  // Average across days → profile
  const profileHours = [];
  for (let h = 0; h < 24; h++) {
    let temperature = 0, relativeHumidity = 0, dewPoint = 0, cloudCover = 0, windSpeed = 0;
    let windDirSin = 0, windDirCos = 0;
    let precipitation = 0, directRadiation = 0, diffuseRadiation = 0;
    let shortwaveRadiation = 0, soilTemperature = 0;
    let solarElevation = 0, solarAzSin = 0, solarAzCos = 0;
    let count = 0;

    for (const day of raw) {
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

    profileHours.push({
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

  return {
    location,
    lat,
    lng,
    season,
    startDate,
    endDate,
    raw,
    profile: { hours: profileHours },
  };
}

/* ── Main ───────────────────────────────────────────────────────────── */

async function main() {
  const fs = await import("fs");
  const path = await import("path");
  const outDir = path.join(process.cwd(), "public", "weather");

  // Ensure output directory exists
  fs.mkdirSync(outDir, { recursive: true });

  const totalCities = CITIES.length;
  let completed = 0;

  for (const city of CITIES) {
    const hemisphere = city.lat < 0 ? "SH" : "NH";
    const seasons = city.lat < 0 ? SH_SEASONS : NH_SEASONS;
    console.log(`\n[${++completed}/${totalCities}] ${city.name} (${hemisphere}, ${city.lat}°, ${city.lng}°)`);

    const cityData = {};

    for (const [season, dates] of Object.entries(seasons)) {
      console.log(`  ${season}: ${dates.start} → ${dates.end}`);
      try {
        const data = await fetchWeather(city.lat, city.lng, dates.start, dates.end);
        cityData[season] = processResponse(
          data, city.name, season, city.lat, city.lng, dates.start, dates.end
        );
      } catch (err) {
        console.error(`  ERROR fetching ${city.name}/${season}: ${err.message}`);
        process.exit(1);
      }
      // Brief pause to be polite to the API
      await new Promise((r) => setTimeout(r, 300));
    }

    const slug = slugify(city.name);
    const filePath = path.join(outDir, `${slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(cityData), "utf-8");
    const sizeKB = Math.round(fs.statSync(filePath).size / 1024);
    console.log(`  → ${slug}.json (${sizeKB} KB)`);
  }

  console.log(`\nDone! Generated ${totalCities} city files in public/weather/`);
}

main().catch(console.error);
