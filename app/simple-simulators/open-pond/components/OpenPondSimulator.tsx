"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { PondAPI } from "@/lib/simulation/pond-types";
import type { DayProfile, HourlyWeather, SeasonWeather } from "@/lib/simulation/weather-types";
import type { OpenPondTimestep, OpenPondConfig } from "@/lib/simulation/simple-outdoor/types";
import { WEATHER_CACHE } from "@/lib/simulation/weather-data";
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

/** Interpolate between two hourly entries based on fractional hour */
function interpolateWeather(profile: DayProfile, hour: number): HourlyWeather {
  const h0 = Math.floor(hour) % 24;
  const h1 = (h0 + 1) % 24;
  const t = hour - Math.floor(hour);
  const a = profile.hours[h0];
  const b = profile.hours[h1];

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
  const [totalDays, setTotalDays] = useState(5);

  const [underTheHoodOpen, setUnderTheHoodOpen] = useState(false);
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
    return WEATHER_CACHE[selectedCity]?.[season] ?? null;
  }, [selectedCity, season]);

  const getWeatherProfile = useCallback((): DayProfile | null => {
    return getSeasonWeather()?.profile ?? null;
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

  /** Build and start the animation loop. `profile` and `days` are captured in the closure. */
  const beginAnimLoop = useCallback((profile: DayProfile, days: number) => {
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

        const wFinal = interpolateWeather(profile, last.hour);
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
      const hour = totalHours % 24;

      pondRef.current?.setTime(hour);
      pondRef.current?.setDensity(current.biomass_concentration);

      const w = interpolateWeather(profile, hour);
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

    const profile = getWeatherProfile();
    if (!profile) return;

    // Pre-compute the full simulation using current slider config
    const { timesteps } = runSimulation(profile, simConfig, totalDays);
    simResultsRef.current = timesteps;

    setSimRunning(true);
    setSimPaused(false);
    pausedElapsedRef.current = 0;
    setSimDay(1);
    setSimHour(0);

    // Apply initial state
    const t0 = timesteps[0];
    setDensity(t0.biomass_concentration);
    setTimeOfDay(t0.hour);
    setCurrentTimestep(t0);
    pondRef.current?.setDensity(t0.biomass_concentration);
    pondRef.current?.setTime(t0.hour);

    const w = interpolateWeather(profile, 0);
    setWindDirection(Math.round(w.windDirection));
    setWindSpeed(Math.round(w.windSpeed * 10) / 10);
    setClouds(Math.round(w.cloudCover));
    setRain(Math.round(w.precipitation > 0 ? Math.min(w.precipitation * 20, 100) : 0));
    pondRef.current?.setWind(w.windDirection, w.windSpeed);
    pondRef.current?.setClouds(w.cloudCover / 100);
    pondRef.current?.setRain(w.precipitation > 0 ? Math.min(w.precipitation * 0.2, 1) : 0);

    startTimeRef.current = performance.now();
    beginAnimLoop(profile, totalDays);
  }, [stopSimulation, getWeatherProfile, simConfig, totalDays, beginAnimLoop]);

  const resumeSimulation = useCallback(() => {
    const profile = getWeatherProfile();
    if (!profile || !simResultsRef.current) return;

    // Adjust startTimeRef so elapsed picks up where we left off
    startTimeRef.current = performance.now() - pausedElapsedRef.current;
    setSimRunning(true);
    setSimPaused(false);
    beginAnimLoop(profile, totalDays);
  }, [getWeatherProfile, totalDays, beginAnimLoop]);

  useEffect(() => {
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const simHH = Math.floor(simHour);
  const simMM = Math.floor((simHour - simHH) * 60);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex gap-4" style={{ aspectRatio: "21 / 8" }}>
        <WorldMap
          selectedCity={selectedCity}
          season={season}
          weatherData={getSeasonWeather()}
          onCityChange={setSelectedCity}
          onSeasonChange={setSeason}
        />
        <div className="relative h-full min-w-0 flex-1">
          <PondCanvas onPondReady={onPondReady} />

          {/* Pond dimensions overlay */}
          <div className="absolute bottom-4 right-4 pointer-events-none rounded-md bg-black/60 px-2 py-1.5 backdrop-blur-sm">
            <svg
              viewBox="0 0 206 76"
              className="w-[220px]"
              aria-label={`Pond: 1 acre, 250 m × 17 m, 200 mm deep, ${Math.round(POND_GEO.V_liters / 10000) * 10} kL`}
            >
              {/* Top: 1 acre | volume */}
              <text x="4" y="10" fill="white" fontSize="10" fontFamily="monospace" fontWeight="600">1 acre | {Math.round(POND_GEO.V_liters / 10000) * 10}kL</text>
              {/* Racetrack outline (pushed down) */}
              <rect
                x="4"
                y="29"
                width="168"
                height="22"
                rx="11"
                fill="none"
                stroke="white"
                strokeWidth="1.2"
                strokeOpacity="0.7"
              />
              <text x="88" y="44" textAnchor="middle" fill="white" fillOpacity="0.85" fontSize="8.5" fontFamily="monospace">200mm deep</text>
              {/* Width dimension bar (right side, horizontal label) */}
              <line x1="180" y1="29" x2="180" y2="51" stroke="white" strokeWidth="0.7" strokeOpacity="0.6" />
              <line x1="177" y1="29" x2="183" y2="29" stroke="white" strokeWidth="0.7" strokeOpacity="0.6" />
              <line x1="177" y1="51" x2="183" y2="51" stroke="white" strokeWidth="0.7" strokeOpacity="0.6" />
              <text x="196" y="44" textAnchor="middle" fill="white" fillOpacity="0.8" fontSize="8" fontFamily="monospace">17m</text>
              {/* Bottom: length dimension line */}
              <line x1="4" y1="62" x2="172" y2="62" stroke="white" strokeWidth="0.7" strokeOpacity="0.6" />
              <line x1="4" y1="59" x2="4" y2="65" stroke="white" strokeWidth="0.7" strokeOpacity="0.6" />
              <line x1="172" y1="59" x2="172" y2="65" stroke="white" strokeWidth="0.7" strokeOpacity="0.6" />
              <text x="88" y="74" textAnchor="middle" fill="white" fillOpacity="0.8" fontSize="9" fontFamily="monospace">250m</text>
            </svg>
          </div>

          {/* Simulation overlay */}
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
