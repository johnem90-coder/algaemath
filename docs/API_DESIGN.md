# API Design

Backend endpoints for simulations and exports.

---

## Climate Data

### `GET /api/climate`

**Purpose:** Fetch historical weather data from Weatherbit API

**Query Parameters:**
- `location` (string, required) - City name or coordinates
- `start_date` (string, required) - ISO format: `2024-01-01`
- `end_date` (string, required) - ISO format: `2024-01-14`

**Response:**
```json
{
  "city": "Sydney, Australia",
  "latitude": -33.8688,
  "longitude": 151.2093,
  "data": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "dni": 850.2,
      "dhi": 120.5,
      "temp": 28.5,
      "wind_speed": 3.2,
      "humidity": 0.65,
      "pressure": 101325
    }
  ]
}
```

**Caching:** Cache results for 24 hours

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
- `API_ERROR` - External API failure (Weatherbit)
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

### Python Integration
- Use Vercel Python runtime for simulation endpoints
- Port existing Python code to serverless functions
- Keep functions under 10s execution time

### Caching Strategy
- Cache climate data for 24 hours (Redis/Vercel KV)
- Cache common simulation results (predefined scenarios)

### Streaming
- Use Server-Sent Events for long simulations
- Send progress updates every 10% complete
