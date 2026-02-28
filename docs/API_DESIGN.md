# API Design

Backend endpoints for simulations and exports.

---

## Climate Data

### `GET /api/climate`

**Purpose:** Fetch historical weather data from Open-Meteo Historical Weather API

**Note:** Currently, weather data is generated via `scripts/generate-weather-data.mjs` and stored as static JSON files in `public/weather/[city-slug].json` (29 cities × 4 seasons). These are lazy-loaded at runtime when a city is selected. The runtime API client in `lib/simulation/weather-api.ts` can also fetch on-demand for locations not in the static cache.

**Query Parameters:**
- `location` (string, required) - City name or coordinates
- `start_date` (string, required) - ISO format: `2024-01-01`
- `end_date` (string, required) - ISO format: `2024-01-14`

**Response (matches `SeasonWeather` interface in `weather-types.ts`):**
```json
{
  "location": "Gainesville, FL",
  "lat": 29.6516,
  "lng": -82.3248,
  "season": "spring",
  "startDate": "2024-03-01",
  "endDate": "2024-03-14",
  "raw": [
    {
      "date": "2024-03-01",
      "hours": [
        {
          "hour": 0,
          "temperature": 15.2,
          "relativeHumidity": 82,
          "dewPoint": 12.1,
          "cloudCover": 45,
          "windSpeed": 2.8,
          "windDirection": 180,
          "precipitation": 0.0,
          "directRadiation": 0,
          "diffuseRadiation": 0,
          "shortwaveRadiation": 0,
          "soilTemperature": 18.5,
          "solarElevation": -25.3,
          "solarAzimuth": 0
        }
      ]
    }
  ],
  "profile": { "hours": [] }
}
```

**Caching:** Static cache for predefined cities/seasons; runtime fetch for custom locations

---

## Simple Outdoor Simulation

### `POST /api/simulate/simple`

**Purpose:** Run 1-2 week climate-based simulation

**Request Body:**
```json
{
  "system_type": "open-pond",
  "location": "Sydney, Australia",
  "start_date": "2024-01-01",
  "end_date": "2024-01-14",
  "initial_conditions": {
    "biomass_density": 0.1,
    "temperature": 25
  },
  "system_params": {
    "depth": 0.25,
    "area": 4046.86,
    "length_to_width": 10
  },
  "models": {
    "light": "banerjee",
    "temperature": "marsullo",
    "nutrient": "monod"
  },
  "model_params": {
    "light": {
      "I_half_sat": 112.2,
      "I_inhibition": 369.3
    },
    "temperature": {
      "T_optimal": 32,
      "T_lethal": 45
    }
  }
}
```

**Response (Streaming via Server-Sent Events):**
```
data: {"day": 1, "hour": 0, "density": 0.102, "temp": 26.5, "growth_rate": 0.05}
data: {"day": 1, "hour": 1, "density": 0.103, "temp": 27.1, "growth_rate": 0.06}
...
data: {"complete": true, "summary": {"total_biomass": 1250, "avg_productivity": 8.5}}
```

**Alternative (Non-streaming):**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "density": 0.102,
      "temperature": 26.5,
      "growth_rate": 0.05,
      "productivity_areal": 8.2,
      "productivity_volumetric": 0.033
    }
  ],
  "summary": {
    "total_biomass_kg": 1250,
    "avg_productivity_areal": 8.5,
    "avg_productivity_volumetric": 0.034,
    "harvest_events": 3,
    "total_harvested_kg": 800
  }
}
```

---

## Dynamic PBR Simulation

### `POST /api/simulate/dynamic`

**Purpose:** Run controlled environment simulation with feedback loops

**Request Body:**
```json
{
  "duration_hours": 168,
  "timestep_minutes": 5,
  "initial_conditions": {
    "biomass_density": 0.5,
    "temperature": 25,
    "pH": 7.5,
    "nutrient_conc": 100
  },
  "setpoints": {
    "temperature": 30,
    "pH": 8.0,
    "nutrient_conc": 150,
    "light_intensity": 800,
    "co2_ppm": 5000
  },
  "pid_params": {
    "temperature": {"kp": 50, "ki": 0.5, "kd": 5},
    "pH": {"kp": 10, "ki": 0.1, "kd": 1}
  },
  "system_specs": {
    "volume": 1000,
    "surface_area": 50,
    "heater_max_power": 5000,
    "fan_max_cfm": 500
  },
  "models": {
    "light": "banerjee",
    "temperature": "marsullo"
  }
}
```

**Response:** Similar to simple simulation, plus:
```json
{
  "data": [
    {
      "timestamp": "...",
      "density": 0.51,
      "temperature": 29.8,
      "control_actions": {
        "heater_power": 2500,
        "fan_speed": 0,
        "nutrient_pump_ml": 0,
        "co2_flow": 100
      },
      "chemistry": {
        "pH": 7.98,
        "co2_aq": 5.2,
        "hco3": 120,
        "co3": 15
      }
    }
  ],
  "events": [
    {
      "timestamp": "2024-01-01T03:45:00Z",
      "type": "nutrient_dose",
      "volume_ml": 50
    }
  ]
}
```

---

## Export Endpoints

### `POST /api/export/csv`

**Purpose:** Generate CSV from simulation data

**Request Body:**
```json
{
  "data": [],
  "columns": ["timestamp", "density", "temperature"]
}
```

**Response:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="simulation_results.csv"

timestamp,density,temperature
2024-01-01T00:00:00Z,0.102,26.5
...
```

---

### `POST /api/export/pdf`

**Purpose:** Generate PDF report

**Request Body:**
```json
{
  "title": "Open Pond Simulation - Sydney Jan 2024",
  "summary": {},
  "charts": [
    {
      "type": "line",
      "title": "Biomass Density Over Time",
      "data": []
    }
  ]
}
```

**Response:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="simulation_report.pdf"

[PDF binary data]
```

---

### `POST /api/export/excel`

**Purpose:** Generate Excel workbook (for TEA)

**Request Body:**
```json
{
  "template": "open-pond-tea",
  "inputs": {
    "system_size": 10,
    "location": "Arizona",
    "capex_multiplier": 1.0
  }
}
```

**Response:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="tea_calculator.xlsx"

[Excel binary data]
```

---

## Error Responses

All endpoints return errors in this format:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "Invalid date range: end_date must be after start_date"
  }
}
```

**Error Codes:**
- `INVALID_PARAMETER` - Bad input
- `API_ERROR` - External API failure (Open-Meteo)
- `SIMULATION_ERROR` - Simulation failed to converge
- `EXPORT_ERROR` - File generation failed
- `RATE_LIMIT` - Too many requests

---

## Rate Limiting

- Climate API: 10 requests/minute per IP
- Simulation API: 5 requests/minute per IP
- Export API: 20 requests/minute per IP

---

## Implementation Notes

### Architecture
- Simulation runs entirely client-side in TypeScript via `lib/simulation/simple-outdoor/open-pond-engine.ts`
- Full simulation is pre-computed before animation starts (all timesteps computed upfront, then animated via `requestAnimationFrame`)
- Weather data is pre-cached as static JSON files in `public/weather/` for 29 cities (lazy-loaded at runtime)
- No API keys required — Open-Meteo Historical Weather API is free
- API routes above are aspirational designs for future features (PDF/Excel export, etc.)
- No server-side API routes have been implemented yet

### Weather Data Pipeline
- Static JSON files for 29 predefined cities in `public/weather/[city-slug].json`
- Each file contains all 4 seasons (spring, summer, autumn, winter) with 14 days × 24 hours of weather data
- Generated by `scripts/generate-weather-data.mjs` which fetches from Open-Meteo Historical Weather API
- Loaded on-demand via `fetch()` when a city is selected, cached in a `useRef` map during the session
- Legacy static TypeScript cache (`lib/simulation/weather-data.ts`) is superseded by the JSON approach

### Data Export
- CSV export is implemented client-side in `OpenPondSimulator.tsx` via `downloadSimCSV` callback
- Builds CSV with metadata comment rows + 40+ column header + all hourly timestep data
- Triggered via Blob + anchor click pattern (no server-side API needed)
- Interactive data table overlay also available in-browser

### Simulation Output
- See `docs/SIMULATION_DESIGN.md` Section 2.6 for the full per-timestep output interface (`OpenPondTimestep`)
- Results are computed client-side and rendered to SVG charts (`SimulationCharts.tsx`, `GrowthModelPanels.tsx`) and Three.js canvas (`PondCanvas.tsx`)
