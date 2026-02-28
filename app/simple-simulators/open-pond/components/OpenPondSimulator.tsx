"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { PondAPI } from "@/lib/simulation/pond-types";
import type { RawDayData, HourlyWeather, SeasonWeather } from "@/lib/simulation/weather-types";
import type { OpenPondTimestep, OpenPondConfig } from "@/lib/simulation/simple-outdoor/types";
import { runSimulation } from "@/lib/simulation/simple-outdoor/open-pond-engine";
import { DEFAULT_CONFIG } from "@/lib/simulation/simple-outdoor/types";
import { computeGeometry } from "@/lib/simulation/simple-outdoor/geometry";

const POND_GEO = computeGeometry(
  DEFAULT_CONFIG.area_ha,
  DEFAULT_CONFIG.aspect_ratio,
  DEFAULT_CONFIG.depth,
  DEFAULT_CONFIG.berm_width
);
import { ChevronDown } from "lucide-react";
import PondCanvas from "./PondCanvas";
import WorldMap, { type Season } from "./WorldMap";
import SimulationCharts from "./SimulationCharts";
import GrowthModelPanels from "./GrowthModelPanels";

const MS_PER_DAY = 2_000; // animation speed: 2s per simulated day

/* ── Weather gauge SVG helper ─────────────────────────────────── */

const G_TY = 14; // track top Y
const G_TH = 44; // track height
const G_TW = 7;  // track width
const G_TR = 3.5; // track corner radius

function weatherGauge(
  cx: number, fill: number, color: string,
  label: string, val: string, unit: string,
) {
  const f = Math.max(0, Math.min(1, fill));
  const fH = G_TH * f;
  const fY = G_TY + G_TH - fH;
  return (
    <g>
      <text x={cx} y={9} textAnchor="middle" fill="white" fillOpacity={0.5} fontSize={7.5} fontFamily="monospace">{label}</text>
      <rect x={cx - G_TW / 2} y={G_TY} width={G_TW} height={G_TH} rx={G_TR} fill="white" fillOpacity={0.12} />
      {fH > 0.5 && (
        <rect x={cx - G_TW / 2} y={fY} width={G_TW} height={fH} rx={Math.min(G_TR, fH / 2)} fill={color} fillOpacity={0.85} />
      )}
      <text x={cx} y={72} textAnchor="middle" fill="white" fontSize={9} fontFamily="monospace" fontWeight={600}>{val}</text>
      <text x={cx} y={81} textAnchor="middle" fill="white" fillOpacity={0.45} fontSize={7} fontFamily="monospace">{unit}</text>
    </g>
  );
}

const COMPASS_DIRS8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const CMP_CX = 126;
const CMP_CY = 36;
const CMP_R = 18;
const CMP_ARROW = CMP_R - 4;

/** Interpolate between two hourly entries based on day index and fractional hour */
function interpolateWeather(raw: RawDayData[], day: number, hour: number): HourlyWeather {
  const dayIndex = day % raw.length;
  const h0 = Math.floor(hour) % 24;
  const h1 = (h0 + 1) % 24;
  const t = hour - Math.floor(hour);
  const a = raw[dayIndex].hours[h0];
  // If h1 wraps to 0 (midnight), use next day's hour 0
  const nextDayIndex = h1 === 0 ? (dayIndex + 1) % raw.length : dayIndex;
  const b = raw[nextDayIndex].hours[h1];

  let dDir = b.windDirection - a.windDirection;
  if (dDir > 180) dDir -= 360;
  if (dDir < -180) dDir += 360;

  let dAz = b.solarAzimuth - a.solarAzimuth;
  if (dAz > 180) dAz -= 360;
  if (dAz < -180) dAz += 360;

  const lerp = (va: number, vb: number) => va + (vb - va) * t;

  return {
    hour,
    temperature: lerp(a.temperature, b.temperature),
    relativeHumidity: lerp(a.relativeHumidity, b.relativeHumidity),
    dewPoint: lerp(a.dewPoint, b.dewPoint),
    cloudCover: lerp(a.cloudCover, b.cloudCover),
    windSpeed: lerp(a.windSpeed, b.windSpeed),
    windDirection: ((a.windDirection + dDir * t) + 360) % 360,
    precipitation: lerp(a.precipitation, b.precipitation),
    directRadiation: lerp(a.directRadiation, b.directRadiation),
    diffuseRadiation: lerp(a.diffuseRadiation, b.diffuseRadiation),
    shortwaveRadiation: lerp(a.shortwaveRadiation, b.shortwaveRadiation),
    soilTemperature: lerp(a.soilTemperature, b.soilTemperature),
    solarElevation: lerp(a.solarElevation, b.solarElevation),
    solarAzimuth: ((a.solarAzimuth + dAz * t) + 360) % 360,
  };
}

/** Linearly interpolate between two simulation timesteps for smooth animation */
function lerpTimestep(
  a: OpenPondTimestep,
  b: OpenPondTimestep,
  t: number
): OpenPondTimestep {
  const lerp = (va: number, vb: number) => va + (vb - va) * t;
  return {
    day: a.day,
    hour: lerp(a.hour, b.hour),
    biomass_concentration: lerp(a.biomass_concentration, b.biomass_concentration),
    pond_temperature: lerp(a.pond_temperature, b.pond_temperature),
    culture_volume: lerp(a.culture_volume, b.culture_volume),
    net_growth_rate: lerp(a.net_growth_rate, b.net_growth_rate),
    light_factor: lerp(a.light_factor, b.light_factor),
    temperature_factor: lerp(a.temperature_factor, b.temperature_factor),
    nutrient_factor: 1.0,
    lighted_depth_fraction: lerp(a.lighted_depth_fraction, b.lighted_depth_fraction),
    par_direct_surface: lerp(a.par_direct_surface, b.par_direct_surface),
    par_diffuse_surface: lerp(a.par_diffuse_surface, b.par_diffuse_surface),
    par_avg_culture: lerp(a.par_avg_culture, b.par_avg_culture),
    fresnel_transmission_direct: lerp(a.fresnel_transmission_direct, b.fresnel_transmission_direct),
    productivity_volumetric: lerp(a.productivity_volumetric, b.productivity_volumetric),
    productivity_areal: lerp(a.productivity_areal, b.productivity_areal),
    q_solar: lerp(a.q_solar, b.q_solar),
    q_longwave_in: lerp(a.q_longwave_in, b.q_longwave_in),
    q_longwave_out: lerp(a.q_longwave_out, b.q_longwave_out),
    q_evap: lerp(a.q_evap, b.q_evap),
    q_convection: lerp(a.q_convection, b.q_convection),
    q_conduction: lerp(a.q_conduction, b.q_conduction),
    q_biomass: lerp(a.q_biomass, b.q_biomass),
    q_net: lerp(a.q_net, b.q_net),
    air_temperature: lerp(a.air_temperature, b.air_temperature),
    dew_point: lerp(a.dew_point, b.dew_point),
    relative_humidity: lerp(a.relative_humidity, b.relative_humidity),
    cloud_cover: lerp(a.cloud_cover, b.cloud_cover),
    wind_speed_10m: lerp(a.wind_speed_10m, b.wind_speed_10m),
    wind_speed_2m: lerp(a.wind_speed_2m, b.wind_speed_2m),
    direct_radiation: lerp(a.direct_radiation, b.direct_radiation),
    diffuse_radiation: lerp(a.diffuse_radiation, b.diffuse_radiation),
    solar_elevation: lerp(a.solar_elevation, b.solar_elevation),
    soil_temperature: lerp(a.soil_temperature, b.soil_temperature),
    precipitation: lerp(a.precipitation, b.precipitation),
    evap_L: lerp(a.evap_L, b.evap_L),
    rainfall_L: lerp(a.rainfall_L, b.rainfall_L),
    makeup_L: lerp(a.makeup_L, b.makeup_L),
    harvest_water_removed_L: a.harvest_water_removed_L,
    harvest_water_returned_L: a.harvest_water_returned_L,
    harvest_occurred: a.harvest_occurred,
    harvest_mass_kg: a.harvest_mass_kg,
  };
}

export default function OpenPondSimulator() {
  const [density, setDensity] = useState(1.24);
  const [timeOfDay, setTimeOfDay] = useState(12);
  const [windDirection, setWindDirection] = useState(225);
  const [windSpeed, setWindSpeed] = useState(3.8);
  const [clouds, setClouds] = useState(0);
  const [rain, setRain] = useState(0);

  const [selectedCity, setSelectedCity] = useState<string | null>("Gainesville");
  const [season, setSeason] = useState<Season>("spring");
  const [totalDays, setTotalDays] = useState(3);

  // Lazy-loaded weather data cache: city → { spring, summer, autumn, winter }
  const weatherCacheRef = useRef<Record<string, Record<string, SeasonWeather>>>({});
  const [weatherReady, setWeatherReady] = useState<string | null>(null); // triggers re-render on load
  const [loadingWeather, setLoadingWeather] = useState(false);
  const fetchingRef = useRef<Set<string>>(new Set());

  // Fetch weather JSON when a city is selected (if not already cached)
  useEffect(() => {
    if (!selectedCity) return;
    if (weatherCacheRef.current[selectedCity]) return;
    if (fetchingRef.current.has(selectedCity)) return;
    fetchingRef.current.add(selectedCity);
    setLoadingWeather(true);
    const city = selectedCity;
    const slug = city.toLowerCase().replace(/\s+/g, "-");
    fetch(`/weather/${slug}.json`)
      .then((r) => r.json())
      .then((data: Record<string, SeasonWeather>) => {
        weatherCacheRef.current[city] = data;
        fetchingRef.current.delete(city);
        setWeatherReady(city);
        setLoadingWeather(false);
      })
      .catch(() => {
        fetchingRef.current.delete(city);
        setLoadingWeather(false);
      });
  }, [selectedCity]);

  const [underTheHoodOpen, setUnderTheHoodOpen] = useState(false);
  const [showSimData, setShowSimData] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [simPaused, setSimPaused] = useState(false);
  const [simDay, setSimDay] = useState(0);
  const [simHour, setSimHour] = useState(0);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const pausedElapsedRef = useRef(0);

  // Mutable simulation config — slider changes update this
  const [simConfig, setSimConfig] = useState<OpenPondConfig>(DEFAULT_CONFIG);
  const handleConfigChange = useCallback((updates: Partial<OpenPondConfig>) => {
    setSimConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  // Precomputed simulation results
  const simResultsRef = useRef<OpenPondTimestep[] | null>(null);
  const [currentTimestep, setCurrentTimestep] = useState<OpenPondTimestep | null>(null);
  const [simIndex, setSimIndex] = useState(0);

  const pondRef = useRef<PondAPI | null>(null);

  const onPondReady = useCallback((api: PondAPI) => {
    pondRef.current = api;
    api.setDensity(1.24);
    api.setTime(12);
    api.setWind(225, 3.8);
    api.setClouds(0);
    api.setRain(0);
  }, []);

  const getSeasonWeather = useCallback((): SeasonWeather | null => {
    if (!selectedCity) return null;
    return weatherCacheRef.current[selectedCity]?.[season] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity, season, weatherReady]);

  const getWeatherRaw = useCallback((): RawDayData[] | null => {
    return getSeasonWeather()?.raw ?? null;
  }, [getSeasonWeather]);

  const stopSimulation = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    setSimRunning(false);
    setSimPaused(false);
    pausedElapsedRef.current = 0;
  }, []);

  const pauseSimulation = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    // Remember how far we got
    pausedElapsedRef.current = performance.now() - startTimeRef.current;
    setSimRunning(false);
    setSimPaused(true);
  }, []);

  /** Build and start the animation loop. `raw` and `days` are captured in the closure. */
  const beginAnimLoop = useCallback((raw: RawDayData[], days: number) => {
    const tick = (now: number) => {
      const results = simResultsRef.current;
      if (!results || results.length === 0) return;

      const durationMs = days * MS_PER_DAY;
      const elapsed = Math.max(0, now - startTimeRef.current);
      if (elapsed >= durationMs) {
        const last = results[results.length - 1];
        setCurrentTimestep(last);
        setDensity(last.biomass_concentration);
        setTimeOfDay(last.hour);
        setSimDay(last.day);
        setSimHour(last.hour);
        pondRef.current?.setDensity(last.biomass_concentration);
        pondRef.current?.setTime(last.hour);

        const wFinal = interpolateWeather(raw, last.day - 1, last.hour);
        setWindSpeed(Math.round(wFinal.windSpeed * 10) / 10);
        setWindDirection(Math.round(wFinal.windDirection));
        setClouds(Math.round(wFinal.cloudCover));
        setRain(Math.round(wFinal.precipitation > 0 ? Math.min(wFinal.precipitation * 20, 100) : 0));
        pondRef.current?.setWind(wFinal.windDirection, wFinal.windSpeed);
        pondRef.current?.setClouds(wFinal.cloudCover / 100);
        pondRef.current?.setRain(wFinal.precipitation > 0 ? Math.min(wFinal.precipitation * 0.2, 1) : 0);

        setSimRunning(false);
        setSimPaused(false);
        pausedElapsedRef.current = 0;
        animRef.current = null;
        return;
      }

      // Map animation progress to simulation timestep index
      const progress = elapsed / durationMs;
      const floatIndex = progress * (results.length - 1);
      const idx = Math.floor(floatIndex);
      const frac = floatIndex - idx;
      const current = lerpTimestep(
        results[idx],
        results[Math.min(idx + 1, results.length - 1)],
        frac
      );

      // Continuous hour for 3D renderer (day/night cycle)
      const totalHours = progress * days * 24;
      const day = Math.floor(totalHours / 24);
      const hour = (totalHours + 7) % 24; // sim starts at 7 AM

      pondRef.current?.setTime(hour);
      pondRef.current?.setDensity(current.biomass_concentration);

      const w = interpolateWeather(raw, day, hour);
      pondRef.current?.setWind(w.windDirection, w.windSpeed);
      pondRef.current?.setClouds(w.cloudCover / 100);
      pondRef.current?.setRain(w.precipitation > 0 ? Math.min(w.precipitation * 0.2, 1) : 0);

      setCurrentTimestep(current);
      setSimIndex(Math.floor(floatIndex));
      setDensity(current.biomass_concentration);
      setSimDay(current.day);
      setSimHour(hour);
      setTimeOfDay(Math.round(hour * 10) / 10);
      setWindSpeed(Math.round(w.windSpeed * 10) / 10);
      setWindDirection(Math.round(w.windDirection));
      setClouds(Math.round(w.cloudCover));
      setRain(Math.round(w.precipitation > 0 ? Math.min(w.precipitation * 20, 100) : 0));

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
  }, []);

  const startSimulation = useCallback(() => {
    stopSimulation();
    setShowSimData(false);

    const raw = getWeatherRaw();
    if (!raw) return;

    // Pre-compute the full simulation using current slider config
    const { timesteps } = runSimulation(raw, simConfig, totalDays);
    simResultsRef.current = timesteps;

    setSimRunning(true);
    setSimPaused(false);
    pausedElapsedRef.current = 0;
    setSimDay(1);
    setSimHour(7);

    // Apply initial state
    const t0 = timesteps[0];
    setDensity(t0.biomass_concentration);
    setTimeOfDay(t0.hour);
    setCurrentTimestep(t0);
    pondRef.current?.setDensity(t0.biomass_concentration);
    pondRef.current?.setTime(t0.hour);

    const w = interpolateWeather(raw, 0, 7);
    setWindDirection(Math.round(w.windDirection));
    setWindSpeed(Math.round(w.windSpeed * 10) / 10);
    setClouds(Math.round(w.cloudCover));
    setRain(Math.round(w.precipitation > 0 ? Math.min(w.precipitation * 20, 100) : 0));
    pondRef.current?.setWind(w.windDirection, w.windSpeed);
    pondRef.current?.setClouds(w.cloudCover / 100);
    pondRef.current?.setRain(w.precipitation > 0 ? Math.min(w.precipitation * 0.2, 1) : 0);

    startTimeRef.current = performance.now();
    beginAnimLoop(raw, totalDays);
  }, [stopSimulation, getWeatherRaw, simConfig, totalDays, beginAnimLoop]);

  const resumeSimulation = useCallback(() => {
    const raw = getWeatherRaw();
    if (!raw || !simResultsRef.current) return;

    // Adjust startTimeRef so elapsed picks up where we left off
    startTimeRef.current = performance.now() - pausedElapsedRef.current;
    setSimRunning(true);
    setSimPaused(false);
    beginAnimLoop(raw, totalDays);
  }, [getWeatherRaw, totalDays, beginAnimLoop]);

  useEffect(() => {
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const simComplete = !simRunning && !simPaused && simResultsRef.current !== null && simResultsRef.current.length > 0;

  // Map simulation day number (1-indexed) to the actual date string from raw weather data
  const simDateLookup = useCallback((day: number): string => {
    const raw = getWeatherRaw();
    if (!raw) return "";
    return raw[(day - 1) % raw.length].date;
  }, [getWeatherRaw]);

  const downloadSimCSV = useCallback(() => {
    const results = simResultsRef.current;
    if (!results || results.length === 0) return;

    const c = simConfig;
    const meta = [
      `# Open Pond Simulation — ${selectedCity ?? "Unknown"}, ${season}`,
      `# Area: ${c.area_ha} ha, Depth: ${c.depth} m, Aspect: ${c.aspect_ratio.toFixed(1)}, Berm: ${c.berm_width} m`,
      `# mu_max: ${c.mu_max} /day, Iopt: ${c.Iopt} umol/m2/s, Topt: ${c.Topt} C, alpha: ${c.alpha}, death_rate: ${c.death_rate} /day`,
      `# epsilon: ${c.epsilon} m2/g, kb: ${c.kb} /m, harvest: ${c.harvest_mode}`,
      `# Initial density: ${c.initial_density} g/L, Initial temp: ${c.initial_temperature} C`,
    ];

    const header = [
      "Date", "Day", "Hour",
      "Biomass(g/L)", "PondTemp(C)", "Volume(m3)",
      "NetGrowth(/day)", "LightFactor", "TempFactor", "NutrientFactor", "LightedFraction",
      "PAR_Direct(umol/m2/s)", "PAR_Diffuse(umol/m2/s)", "PAR_AvgCulture(umol/m2/s)", "FresnelT",
      "Prod_Vol(g/L/day)", "Prod_Areal(g/m2/day)",
      "q_solar(W/m2)", "q_lw_in(W/m2)", "q_lw_out(W/m2)", "q_evap(W/m2)", "q_conv(W/m2)", "q_cond(W/m2)", "q_bio(W/m2)", "q_net(W/m2)",
      "AirTemp(C)", "DewPoint(C)", "RH(%)", "CloudCover(%)", "Wind10m(m/s)", "Wind2m(m/s)", "DirectRad(W/m2)", "DiffuseRad(W/m2)", "SolarElev(deg)", "SoilTemp(C)", "Precip(mm)",
      "Evap(L)", "Rainfall(L)", "Makeup(L)", "HarvestWaterOut(L)", "HarvestWaterReturn(L)",
      "HarvestOccurred", "HarvestMass(kg)",
    ];

    const rows = results.map((t) => [
      simDateLookup(t.day), t.day, t.hour,
      t.biomass_concentration.toFixed(4), t.pond_temperature.toFixed(2), t.culture_volume.toFixed(3),
      t.net_growth_rate.toFixed(4), t.light_factor.toFixed(4), t.temperature_factor.toFixed(4), t.nutrient_factor.toFixed(4), t.lighted_depth_fraction.toFixed(4),
      t.par_direct_surface.toFixed(2), t.par_diffuse_surface.toFixed(2), t.par_avg_culture.toFixed(2), t.fresnel_transmission_direct.toFixed(4),
      t.productivity_volumetric.toFixed(4), t.productivity_areal.toFixed(2),
      t.q_solar.toFixed(2), t.q_longwave_in.toFixed(2), t.q_longwave_out.toFixed(2), t.q_evap.toFixed(2), t.q_convection.toFixed(2), t.q_conduction.toFixed(2), t.q_biomass.toFixed(4), t.q_net.toFixed(2),
      t.air_temperature.toFixed(1), t.dew_point.toFixed(1), t.relative_humidity.toFixed(1), t.cloud_cover.toFixed(1), t.wind_speed_10m.toFixed(1), t.wind_speed_2m.toFixed(1), t.direct_radiation.toFixed(1), t.diffuse_radiation.toFixed(1), t.solar_elevation.toFixed(1), t.soil_temperature.toFixed(1), t.precipitation.toFixed(2),
      t.evap_L.toFixed(2), t.rainfall_L.toFixed(2), t.makeup_L.toFixed(2), t.harvest_water_removed_L.toFixed(2), t.harvest_water_returned_L.toFixed(2),
      t.harvest_occurred ? 1 : 0, t.harvest_mass_kg.toFixed(4),
    ].join(","));

    const csv = [...meta, header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `open-pond-${(selectedCity ?? "sim").toLowerCase().replace(/\s+/g, "-")}-${season}-${totalDays}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [simConfig, selectedCity, season, totalDays, simDateLookup]);

  const simHH = Math.floor(simHour);
  const simMM = Math.floor((simHour - simHH) * 60);

  // Weather gauge derived values
  const precip = currentTimestep?.precipitation ?? 0;
  const windBlowDeg = (windDirection + 180) % 360; // blowing direction (matches wisps/flag)
  const windDirLabel = COMPASS_DIRS8[Math.round(windBlowDeg / 45) % 8];
  const rainFill = Math.min(1, precip / 3);
  const cloudFill = clouds / 100;
  const windFill = Math.min(1, windSpeed / 12);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex gap-4" style={{ aspectRatio: "21 / 8" }}>
        <WorldMap
          selectedCity={selectedCity}
          season={season}
          weatherData={getSeasonWeather()}
          onCityChange={setSelectedCity}
          onSeasonChange={setSeason}
          simComplete={simComplete}
          simDays={totalDays}
          loading={loadingWeather}
        />
        <div className="relative h-full min-w-0 flex-1">
          <PondCanvas onPondReady={onPondReady} />

          {/* Right-side overlays */}
          <div className="absolute bottom-4 right-4 pointer-events-none flex flex-col items-end gap-2">
            {/* Weather gauges — rain, cloud, wind + compass */}
            <div className="rounded-md bg-black/60 px-3 py-2 backdrop-blur-sm">
              <svg viewBox="0 0 158 84" className="w-[168px]" aria-hidden="true">
                {weatherGauge(14, rainFill, "hsl(220, 70%, 60%)", "Rain", precip.toFixed(1), "mm")}
                {weatherGauge(44, cloudFill, "hsl(220, 10%, 75%)", "Cloud", `${clouds}`, "%")}
                {weatherGauge(74, windFill, "hsl(180, 50%, 50%)", "Wind", windSpeed.toFixed(1), "m/s")}
                {/* Compass */}
                <circle cx={CMP_CX} cy={CMP_CY} r={CMP_R} fill="none" stroke="white" strokeOpacity={0.2} strokeWidth={0.8} />
                <circle cx={CMP_CX} cy={CMP_CY} r={1.5} fill="white" fillOpacity={0.3} />
                {/* Cardinal ticks */}
                <line x1={CMP_CX} y1={CMP_CY - CMP_R} x2={CMP_CX} y2={CMP_CY - CMP_R + 3} stroke="white" strokeOpacity={0.3} strokeWidth={0.8} />
                <line x1={CMP_CX + CMP_R} y1={CMP_CY} x2={CMP_CX + CMP_R - 3} y2={CMP_CY} stroke="white" strokeOpacity={0.3} strokeWidth={0.8} />
                <line x1={CMP_CX} y1={CMP_CY + CMP_R} x2={CMP_CX} y2={CMP_CY + CMP_R - 3} stroke="white" strokeOpacity={0.3} strokeWidth={0.8} />
                <line x1={CMP_CX - CMP_R} y1={CMP_CY} x2={CMP_CX - CMP_R + 3} y2={CMP_CY} stroke="white" strokeOpacity={0.3} strokeWidth={0.8} />
                <text x={CMP_CX} y={CMP_CY - CMP_R - 2} textAnchor="middle" fill="white" fillOpacity={0.4} fontSize={7} fontFamily="monospace">N</text>
                {/* Arrow — rotated to wind direction */}
                <g transform={`rotate(${windBlowDeg}, ${CMP_CX}, ${CMP_CY})`}>
                  <line x1={CMP_CX} y1={CMP_CY + 4} x2={CMP_CX} y2={CMP_CY - CMP_ARROW} stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeOpacity={0.9} />
                  <polygon points={`${CMP_CX},${CMP_CY - CMP_ARROW - 3} ${CMP_CX - 3},${CMP_CY - CMP_ARROW + 3} ${CMP_CX + 3},${CMP_CY - CMP_ARROW + 3}`} fill="white" fillOpacity={0.9} />
                </g>
                <text x={CMP_CX} y={72} textAnchor="middle" fill="white" fontSize={9} fontFamily="monospace" fontWeight={600}>{windDirLabel}</text>
              </svg>
            </div>
            {/* Pond dimensions */}
            <div className="rounded-md bg-black/60 px-2 py-1.5 backdrop-blur-sm">
              <svg
                viewBox="0 0 206 76"
                className="w-[220px]"
                aria-label={`Pond: 1 acre, 250 m × 17 m, 200 mm deep, ${Math.round(POND_GEO.V_liters / 10000) * 10} kL`}
              >
                <text x="4" y="10" fill="white" fontSize="10" fontFamily="monospace" fontWeight="600">1 acre | {Math.round(POND_GEO.V_liters / 10000) * 10}kL</text>
                <rect x="4" y="29" width="168" height="22" rx="11" fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.7" />
                <text x="88" y="44" textAnchor="middle" fill="white" fillOpacity="0.85" fontSize="8.5" fontFamily="monospace">200mm deep</text>
                <line x1="180" y1="29" x2="180" y2="51" stroke="white" strokeWidth="0.7" strokeOpacity="0.6" />
                <line x1="177" y1="29" x2="183" y2="29" stroke="white" strokeWidth="0.7" strokeOpacity="0.6" />
                <line x1="177" y1="51" x2="183" y2="51" stroke="white" strokeWidth="0.7" strokeOpacity="0.6" />
                <text x="196" y="44" textAnchor="middle" fill="white" fillOpacity="0.8" fontSize="8" fontFamily="monospace">17m</text>
                <line x1="4" y1="62" x2="172" y2="62" stroke="white" strokeWidth="0.7" strokeOpacity="0.6" />
                <line x1="4" y1="59" x2="4" y2="65" stroke="white" strokeWidth="0.7" strokeOpacity="0.6" />
                <line x1="172" y1="59" x2="172" y2="65" stroke="white" strokeWidth="0.7" strokeOpacity="0.6" />
                <text x="88" y="74" textAnchor="middle" fill="white" fillOpacity="0.8" fontSize="9" fontFamily="monospace">250m</text>
              </svg>
            </div>
          </div>

          {/* Simulation Data button — top-right, only after sim completes */}
          {simComplete && (
            <button
              onClick={() => setShowSimData((v) => !v)}
              className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-md bg-white/90 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-widest text-foreground/70 backdrop-blur-sm transition-colors hover:text-foreground"
            >
              Simulation Data
              <svg width="8" height="8" viewBox="0 0 8 8" className={`transition-transform ${showSimData ? "rotate-180" : ""}`}>
                <path d="M1.5 3L4 5.5L6.5 3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {/* Simulation data table overlay */}
          {showSimData && simResultsRef.current && (
            <div className="absolute inset-x-0 top-[33px] bottom-0 z-10 flex flex-col border-t bg-background/80 backdrop-blur-sm">
              <div className="flex items-center justify-between px-3 py-1.5 border-b">
                <span className="text-[9px] font-medium text-muted-foreground">
                  {simResultsRef.current.length} hourly timesteps &middot; {totalDays} days
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={downloadSimCSV} className="text-[9px] font-medium text-muted-foreground hover:text-foreground">
                    Download CSV
                  </button>
                  <button onClick={() => setShowSimData(false)} className="text-[9px] font-medium text-muted-foreground hover:text-foreground">
                    Close
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-max min-w-full border-collapse font-mono text-[9px]">
                  <thead>
                    <tr className="sticky top-0 bg-background/90 backdrop-blur-sm">
                      <th className="sticky left-0 z-20 bg-background/90 border-b border-r px-2 py-1.5 text-left font-semibold text-muted-foreground">Date</th>
                      <th className="sticky left-[68px] z-20 bg-background/90 border-b border-r px-2 py-1.5 text-left font-semibold text-muted-foreground">Hour</th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Biomass<br/><span className="font-normal">g/L</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Pond T<br/><span className="font-normal">&deg;C</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Volume<br/><span className="font-normal">m&sup3;</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Growth<br/><span className="font-normal">/day</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">f(I)</th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">f(T)</th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">f(N)</th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">f(z)</th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">PAR dir<br/><span className="font-normal">&mu;mol</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">PAR dif<br/><span className="font-normal">&mu;mol</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">PAR avg<br/><span className="font-normal">&mu;mol</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Fresnel</th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Prod vol<br/><span className="font-normal">g/L/d</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Prod areal<br/><span className="font-normal">g/m&sup2;/d</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">q solar<br/><span className="font-normal">W/m&sup2;</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">q LW in<br/><span className="font-normal">W/m&sup2;</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">q LW out<br/><span className="font-normal">W/m&sup2;</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">q evap<br/><span className="font-normal">W/m&sup2;</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">q conv<br/><span className="font-normal">W/m&sup2;</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">q cond<br/><span className="font-normal">W/m&sup2;</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">q bio<br/><span className="font-normal">W/m&sup2;</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">q net<br/><span className="font-normal">W/m&sup2;</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Air T<br/><span className="font-normal">&deg;C</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Dew Pt<br/><span className="font-normal">&deg;C</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">RH<br/><span className="font-normal">%</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Cloud<br/><span className="font-normal">%</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Wind 10m<br/><span className="font-normal">m/s</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Wind 2m<br/><span className="font-normal">m/s</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Direct<br/><span className="font-normal">W/m&sup2;</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Diffuse<br/><span className="font-normal">W/m&sup2;</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Sun El<br/><span className="font-normal">deg</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Soil T<br/><span className="font-normal">&deg;C</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Precip<br/><span className="font-normal">mm</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Evap<br/><span className="font-normal">L</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Rain<br/><span className="font-normal">L</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Makeup<br/><span className="font-normal">L</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Harv Out<br/><span className="font-normal">L</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Harv Ret<br/><span className="font-normal">L</span></th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Harvest</th>
                      <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground">Harv kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simResultsRef.current.map((t, i) => (
                      <tr key={i} className="hover:bg-foreground/5">
                        <td className="sticky left-0 bg-background/80 border-r px-2 py-0.5 text-muted-foreground tabular-nums">{i === 0 || t.day !== simResultsRef.current![i - 1].day ? simDateLookup(t.day) : ""}</td>
                        <td className="sticky left-[68px] bg-background/80 border-r px-2 py-0.5 tabular-nums">{String(Math.round(t.hour)).padStart(2, "0")}:00</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.biomass_concentration.toFixed(3)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.pond_temperature.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.culture_volume.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.net_growth_rate.toFixed(3)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.light_factor.toFixed(3)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.temperature_factor.toFixed(3)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.nutrient_factor.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.lighted_depth_fraction.toFixed(3)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.par_direct_surface.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.par_diffuse_surface.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.par_avg_culture.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.fresnel_transmission_direct.toFixed(3)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.productivity_volumetric.toFixed(4)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.productivity_areal.toFixed(2)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.q_solar.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.q_longwave_in.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.q_longwave_out.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.q_evap.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.q_convection.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.q_conduction.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.q_biomass.toFixed(4)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.q_net.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.air_temperature.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.dew_point.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.relative_humidity.toFixed(0)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.cloud_cover.toFixed(0)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.wind_speed_10m.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.wind_speed_2m.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.direct_radiation.toFixed(0)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.diffuse_radiation.toFixed(0)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.solar_elevation.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.soil_temperature.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.precipitation.toFixed(2)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.evap_L.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.rainfall_L.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.makeup_L.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.harvest_water_removed_L.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.harvest_water_returned_L.toFixed(1)}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.harvest_occurred ? "Y" : ""}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{t.harvest_mass_kg > 0 ? t.harvest_mass_kg.toFixed(2) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Simulation controls — top-left */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="w-[120px] flex overflow-hidden rounded-md shadow-sm">
              {simRunning ? (
                <>
                  <button
                    onClick={pauseSimulation}
                    className="flex-1 py-1.5 text-[11px] font-medium tracking-wide transition-colors bg-red-300/90 text-white hover:bg-red-400/90"
                  >
                    Pause
                  </button>
                  <button
                    onClick={stopSimulation}
                    className="flex-1 py-1.5 text-[11px] font-medium tracking-wide transition-colors bg-red-500/90 text-white hover:bg-red-600/90 border-l border-red-600/40"
                  >
                    Stop
                  </button>
                </>
              ) : simPaused ? (
                <>
                  <button
                    onClick={resumeSimulation}
                    className="flex-1 py-1.5 text-[11px] font-medium tracking-wide transition-colors bg-white/90 text-foreground hover:bg-white backdrop-blur-sm"
                  >
                    Resume
                  </button>
                  <button
                    onClick={stopSimulation}
                    className="flex-1 py-1.5 text-[11px] font-medium tracking-wide transition-colors bg-red-500/90 text-white hover:bg-red-600/90 border-l border-red-600/40"
                  >
                    Stop
                  </button>
                </>
              ) : (
                <button
                  onClick={startSimulation}
                  className="flex-1 py-1.5 text-[11px] font-medium tracking-wide transition-colors text-center bg-white/90 text-foreground hover:bg-white backdrop-blur-sm"
                >
                  Run Simulation
                </button>
              )}
            </span>
            <div className="flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1.5 font-mono text-[11px] text-white backdrop-blur-sm">
              <span className="text-white/60">Day</span>
              <span className="tabular-nums font-semibold">{simDay}</span>
              <span className="text-white/40">|</span>
              <span className="tabular-nums font-semibold">
                {String(simHH).padStart(2, "0")}:{String(simMM).padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <SimulationCharts
        simResults={simResultsRef.current}
        simIndex={simIndex}
        config={simConfig}
        onConfigChange={handleConfigChange}
        totalDays={totalDays}
        onTotalDaysChange={setTotalDays}
        simRunning={simRunning}
      />

      {/* Under the Hood — collapsible advanced panels */}
      <div className="border-t pt-2">
        <button
          onClick={() => setUnderTheHoodOpen((prev) => !prev)}
          className="flex w-full items-center justify-between py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Under the Hood</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
              underTheHoodOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {underTheHoodOpen && (
          <GrowthModelPanels
            config={simConfig}
            simTimestep={currentTimestep}
            simRunning={simRunning}
            simPaused={simPaused}
            simResults={simResultsRef.current}
            simIndex={simIndex}
            onConfigChange={handleConfigChange}
            totalDays={totalDays}
            onTotalDaysChange={setTotalDays}
            onStartSim={startSimulation}
            onStopSim={stopSimulation}
            onPauseSim={pauseSimulation}
            onResumeSim={resumeSimulation}
          />
        )}
      </div>
    </div>
  );
}
