"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { PondAPI } from "@/lib/simulation/pond-types";
import type { DayProfile, HourlyWeather, SeasonWeather } from "@/lib/simulation/weather-types";
import { WEATHER_CACHE } from "@/lib/simulation/weather-data";
import PondCanvas from "./PondCanvas";
import WorldMap, { type Season } from "./WorldMap";
import PondControls from "./PondControls";
import WeatherPanel from "./WeatherPanel";
import DataStrip from "./DataStrip";

const TOTAL_DAYS = 5;
const DURATION_MS = 10_000;

/** Interpolate between two hourly entries based on fractional hour */
function interpolateWeather(profile: DayProfile, hour: number): HourlyWeather {
  const h0 = Math.floor(hour) % 24;
  const h1 = (h0 + 1) % 24;
  const t = hour - Math.floor(hour);
  const a = profile.hours[h0];
  const b = profile.hours[h1];

  // Circular interpolation for wind direction
  let dDir = b.windDirection - a.windDirection;
  if (dDir > 180) dDir -= 360;
  if (dDir < -180) dDir += 360;

  // Circular interpolation for solar azimuth
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

export default function OpenPondSimulator() {
  const [density, setDensity] = useState(1.24);
  const [timeOfDay, setTimeOfDay] = useState(12);
  const [windDirection, setWindDirection] = useState(225);
  const [windSpeed, setWindSpeed] = useState(3.8);
  const [clouds, setClouds] = useState(0);
  const [rain, setRain] = useState(0);

  const [selectedCity, setSelectedCity] = useState<string | null>("Gainesville");
  const [season, setSeason] = useState<Season>("spring");

  const [simRunning, setSimRunning] = useState(false);
  const [simDay, setSimDay] = useState(0);
  const [simHour, setSimHour] = useState(0);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  const pondRef = useRef<PondAPI | null>(null);

  const onPondReady = useCallback((api: PondAPI) => {
    pondRef.current = api;
    api.setDensity(1.24);
    api.setTime(12);
    api.setWind(225, 3.8);
    api.setClouds(0);
    api.setRain(0);
  }, []);

  const handleDensityChange = useCallback((v: number) => {
    setDensity(v);
    pondRef.current?.setDensity(v);
  }, []);

  const handleTimeChange = useCallback((v: number) => {
    setTimeOfDay(v);
    pondRef.current?.setTime(v);
  }, []);

  const handleWindDirectionChange = useCallback(
    (v: number) => {
      setWindDirection(v);
      pondRef.current?.setWind(v, windSpeed);
    },
    [windSpeed]
  );

  const handleWindSpeedChange = useCallback(
    (v: number) => {
      setWindSpeed(v);
      pondRef.current?.setWind(windDirection, v);
    },
    [windDirection]
  );

  const handleCloudsChange = useCallback((v: number) => {
    setClouds(v);
    pondRef.current?.setClouds(v / 100);
  }, []);

  const handleRainChange = useCallback((v: number) => {
    setRain(v);
    pondRef.current?.setRain(v / 100);
  }, []);

  /** Get the weather data for the current city + season, if available */
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
  }, []);

  const startSimulation = useCallback(() => {
    stopSimulation();

    const profile = getWeatherProfile();

    setSimRunning(true);
    setSimDay(1);
    setSimHour(8);
    setTimeOfDay(8);
    pondRef.current?.setTime(8);

    // Apply weather for hour 8 immediately
    if (profile) {
      const w = interpolateWeather(profile, 8);
      setWindSpeed(Math.round(w.windSpeed * 10) / 10);
      setWindDirection(Math.round(w.windDirection));
      setClouds(Math.round(w.cloudCover));
      setRain(Math.round(w.precipitation > 0 ? Math.min(w.precipitation * 20, 100) : 0));
      pondRef.current?.setWind(w.windDirection, w.windSpeed);
      pondRef.current?.setClouds(w.cloudCover / 100);
      pondRef.current?.setRain(w.precipitation > 0 ? Math.min(w.precipitation * 0.2, 1) : 0);
    }

    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      if (elapsed >= DURATION_MS) {
        setTimeOfDay(8);
        pondRef.current?.setTime(8);
        setSimDay(TOTAL_DAYS);
        setSimHour(8);
        setSimRunning(false);
        animRef.current = null;
        if (profile) {
          const w = interpolateWeather(profile, 8);
          setWindSpeed(Math.round(w.windSpeed * 10) / 10);
          setWindDirection(Math.round(w.windDirection));
          setClouds(Math.round(w.cloudCover));
          setRain(Math.round(w.precipitation > 0 ? Math.min(w.precipitation * 20, 100) : 0));
          pondRef.current?.setWind(w.windDirection, w.windSpeed);
          pondRef.current?.setClouds(w.cloudCover / 100);
          pondRef.current?.setRain(w.precipitation > 0 ? Math.min(w.precipitation * 0.2, 1) : 0);
        }
        return;
      }

      const progress = elapsed / DURATION_MS;
      const totalHours = progress * TOTAL_DAYS * 24;
      const day = Math.floor(totalHours / 24) + 1;
      const hour = (totalHours % 24 + 8) % 24;

      // Send full-precision time to the 3D renderer every frame
      pondRef.current?.setTime(hour);

      // Apply weather data for this hour
      if (profile) {
        const w = interpolateWeather(profile, hour);
        pondRef.current?.setWind(w.windDirection, w.windSpeed);
        pondRef.current?.setClouds(w.cloudCover / 100);
        pondRef.current?.setRain(w.precipitation > 0 ? Math.min(w.precipitation * 0.2, 1) : 0);

        // Update React state for sliders (throttled to 0.1h snaps)
        setWindSpeed(Math.round(w.windSpeed * 10) / 10);
        setWindDirection(Math.round(w.windDirection));
        setClouds(Math.round(w.cloudCover));
        setRain(Math.round(w.precipitation > 0 ? Math.min(w.precipitation * 20, 100) : 0));
      }

      const sliderHour = Math.round(hour * 10) / 10;
      setSimDay(day);
      setSimHour(hour);
      setTimeOfDay(sliderHour);

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
  }, [stopSimulation, getWeatherProfile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const simHH = Math.floor(simHour);
  const simMM = Math.floor((simHour - simHH) * 60);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex gap-4" style={{ aspectRatio: "21 / 9" }}>
        <WorldMap
          selectedCity={selectedCity}
          season={season}
          weatherData={getSeasonWeather()}
          onCityChange={setSelectedCity}
          onSeasonChange={setSeason}
        />
        <div className="relative h-full min-w-0 flex-1">
          <PondCanvas onPondReady={onPondReady} />

          {/* Simulation overlay */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <button
              onClick={simRunning ? stopSimulation : startSimulation}
              className={`rounded-md px-3 py-1.5 text-[11px] font-medium tracking-wide shadow-sm transition-colors ${
                simRunning
                  ? "bg-red-500/90 text-white hover:bg-red-600/90"
                  : "bg-white/90 text-foreground hover:bg-white backdrop-blur-sm"
              }`}
            >
              {simRunning ? "Stop" : "Run Simulation"}
            </button>
            {simRunning && (
              <div className="flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1.5 font-mono text-[11px] text-white backdrop-blur-sm">
                <span className="text-white/60">Day</span>
                <span className="tabular-nums font-semibold">{simDay}</span>
                <span className="text-white/40">|</span>
                <span className="tabular-nums font-semibold">
                  {String(simHH).padStart(2, "0")}:{String(simMM).padStart(2, "0")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PondControls
          density={density}
          timeOfDay={timeOfDay}
          windDirection={windDirection}
          onDensityChange={handleDensityChange}
          onTimeChange={handleTimeChange}
          onWindDirectionChange={handleWindDirectionChange}
        />
        <WeatherPanel
          clouds={clouds}
          rain={rain}
          windSpeed={windSpeed}
          onCloudsChange={handleCloudsChange}
          onRainChange={handleRainChange}
          onWindSpeedChange={handleWindSpeedChange}
        />
      </div>

      <DataStrip
        density={density}
        timeOfDay={timeOfDay}
        windSpeed={windSpeed}
        windDirection={windDirection}
        clouds={clouds}
      />
    </div>
  );
}
