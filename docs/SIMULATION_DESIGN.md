# Simulation Design Reference

Engineering equations, state variables, and process models underpinning AlgaeMath simulations.

**Scope:** This document covers the process-level mathematics — mass balances, energy balances, heat flux components, and simulation engine mechanics. Growth rate kinetics (light, temperature, nutrient, pH response functions) are documented separately in `MODEL_REGISTRY.md`.

**Relationship to MODEL_REGISTRY.md:** The kinetic models in `MODEL_REGISTRY.md` produce normalized growth factors (0–1). Those factors are consumed here as inputs to the mass balance. The two documents are complementary — this one handles the engineering; that one handles the biology.

---

## Document Organization

Simulations are organized along two axes:

**Reactor Type:** Open Pond · Flat Panel PBR · Tubular PBR *(more may be added)*
**Environment:** Outdoor (climate-driven) · Indoor (controlled)

Not every combination is planned — see the status table at the end of each section. Equations are written for the specific combination where they differ between reactor type or environment. Shared equations are defined once in the **Shared / Common** section and referenced by name elsewhere.

---

## 1. Shared / Common Equations

These equations apply across multiple reactor types or environments. Define once, reference by name.

---

### 1.1 Biomass Growth — Core ODE

The fundamental state equation for biomass concentration X (g/L):

```
dX/dt = (µeff · X) - (D · X) - (X_harvest / V · δ_harvest)
```

**Where:**
| Symbol | Description | Units |
|---|---|---|
| X | Biomass concentration | g/L |
| µeff | Effective specific growth rate (see below) | /day |
| D | Dilution rate (continuous harvest) | /day |
| X_harvest | Biomass removed per harvest event | g |
| V | Culture volume | L |
| δ_harvest | Dirac delta — 1 at harvest event, 0 otherwise | — |

**Net growth rate:**
```
µnet = µmax · µL · µT · µN · µpH - µmaint - µdeath
```

| Symbol | Description | Notes |
|---|---|---|
| µmax | Maximum specific growth rate | Species-dependent, /day |
| µL | Light response factor | 0–1, from MODEL_REGISTRY |
| µT | Temperature response factor | 0–1, from MODEL_REGISTRY |
| µN | Nutrient response factor | 0–1, from MODEL_REGISTRY |
| µpH | pH response factor | 0–1, from MODEL_REGISTRY |
| µmaint | Maintenance respiration rate | /day, set to 0 in v1 (typical range 0.05–0.24) |
| µdeath | Death/lysis rate | /day, constant in v1 (typical default 0.05) |

**v1 simplifications:** µN = 1.0 (nutrients not limiting), µpH = 1.0 (pH not modeled), µmaint = 0.

**Effective growth rate with lighted fraction:**

Growth only occurs in the illuminated portion of the culture. The effective growth rate scales µnet by the fraction of the culture depth that receives usable light:

```
µeff = µnet · f_lighted
```

where f_lighted = min(L_lighted / L, 1.0) is the lighted depth fraction (see Section 1.3).

**Combination rule:** Multiplicative (all factors applied simultaneously). Liebig minimum (only the most limiting factor applies) is an alternative — this choice is a user-selectable option in the simulator.

**Integration note:** All growth rates are in /day. The simulation uses hourly timesteps with Euler integration, so the per-step update is:
```
X(t + Δt) = X(t) + (µeff / 24) · X(t) · Δt     [Δt = 1 h]
```

---

### 1.2 Productivity

Computed from the biomass ODE output, not integrated separately.

**Volumetric productivity (g/L/day):**
```
Pvol = µeff · X
```

**Areal productivity (g/m²/day):**
```
Pareal = Pvol · depth · 1000
```
*(depth in meters, factor of 1000 converts L/m³ to g/m²)*

**Cumulative harvested biomass (g):**
```
M_harvested += X_harvest at each harvest event
```

---

### 1.3 Light Attenuation — Average Intensity

The growth kinetics models take average light intensity Iavg as input. For a well-mixed culture of physical depth L (m) and biomass X (g/L):

#### Effective optical path from refraction

When light enters water at an angle, Snell's law bends the ray, increasing the actual path length through the culture. The effective depth replaces physical depth in the Beer-Lambert calculation:

```
θ_refracted = arcsin((n_air / n_water) · sin(θ_incident))
L_eff = L / cos(θ_refracted)
```

Direct and diffuse light have different incident angles and therefore different effective depths (see Section 2.3 for how these are determined per component).

#### Beer-Lambert averaged intensity

**Standard (single-component extinction):**
```
Iavg = I_surface / (ε · X · L_eff) · (1 - e^(-ε · X · L_eff))
```

**Two-component extinction (background + biomass):**
```
K = ε · X + kb
Iavg = I_surface / (K · L_eff) · (1 - e^(-K · L_eff))
```

| Symbol | Description | Typical Value | Units |
|---|---|---|---|
| I_surface | PAR at culture surface (after Fresnel) | From climate data | µmol/m²/s |
| ε | Specific extinction coefficient | 0.1–0.3 | m²/g |
| X | Biomass concentration | Variable | g/L |
| L_eff | Effective optical depth (from refraction) | Computed | m |
| kb | Background extinction (water + media) | 0.1–0.5 | m⁻¹ |

**Implementation note:** Iavg is recalculated at every timestep because X changes over time. Direct and diffuse components are attenuated separately (each with its own L_eff) and summed. The total Iavg is the value passed to the light response model (µL).

#### Lighted depth fraction

The depth at which PAR drops below a minimum usable threshold (I_min ≈ 1 µmol/m²/s). Below this depth, photosynthesis effectively stops. The lighted depth can be computed analytically:

```
L_lighted = -ln(I_min / I_surface) / K
```

clamped to [0, L]. The lighted fraction is:

```
f_lighted = min(L_lighted / L, 1.0)
```

This fraction scales the effective growth rate (see Section 1.1). In dilute cultures, f_lighted ≈ 1.0 (light reaches the bottom). In dense cultures, it can be significantly less than 1.

---

### 1.4 Harvest Logic

Two harvest strategies supported:

**Semi-continuous (turbidostat-style):** Harvest when X exceeds X_max. Remove volume V_harvest such that X returns to X_target.
```
V_harvest = V · (1 - X_target / X)    [when X > X_max]
X_harvest = X · V_harvest
```

**Periodic (batch-withdraw-fill):** Harvest on a fixed schedule (daily, every N days). Remove a fixed fraction f of culture volume.
```
V_harvest = f · V
X_harvest = X · V_harvest
X_new = X · (1 - f)
```

---

### 1.5 Surface Optics — Fresnel Reflection

Shared across reactor types. Every air-water (or air-glass) interface reflects a fraction of incoming light that depends on the angle of incidence.

#### Fresnel transmission factor

For unpolarized light hitting a flat water surface, the reflected fraction is computed from the S-polarized and P-polarized components of the Fresnel equations, then averaged:

```
θ_r = arcsin((n1 / n2) · sin(θ_i))

Rs = ((n1 · cos(θ_i) - n2 · cos(θ_r)) / (n1 · cos(θ_i) + n2 · cos(θ_r)))²
Rp = ((n1 · cos(θ_r) - n2 · cos(θ_i)) / (n1 · cos(θ_r) + n2 · cos(θ_i)))²

R = (Rs + Rp) / 2
T_fresnel = 1 - R
```

| Symbol | Description | Value |
|---|---|---|
| n1 | Refractive index of air | 1.0 |
| n2 | Refractive index of water | 1.333 |
| θ_i | Angle of incidence (from surface normal) | Variable |
| θ_r | Refracted angle (Snell's law) | Computed |

At near-vertical incidence (noon sun), T_fresnel ≈ 0.98 (only ~2% reflected). At grazing angles (sunrise/sunset), T_fresnel → 0 (nearly total reflection). This replaces the fixed albedo constant and captures the physical reality that early/late sunlight is mostly reflected off the pond surface.

#### Diffuse light equivalent angle

Diffuse sky radiation arrives from all directions across the hemisphere. For calculation purposes, a standard equivalent angle of **60° from the surface normal** is used (Losing 2011). This gives a fixed Fresnel transmission factor for the diffuse component of approximately 0.94.

---

## 2. Outdoor Open Raceway Pond

**Status: v1 implemented** — simulation engine, visualization, and interactive panels are complete.

**Geometry:** Elongated racetrack (oval) loop with a paddlewheel for mixing. Typical aspect ratio 10:1 (length:width). Culture is well-mixed horizontally; vertical mixing assumed complete (CSTR approximation in the vertical direction).

**Key assumptions for v1:**
- Temperature is uniform throughout the pond (well-mixed)
- CO₂ is not limiting (externally supplied or ignored)
- Nutrients are not limiting (µN = 1.0)
- pH is not modeled explicitly (µpH = 1.0)
- Evaporation affects water volume but salinity/nutrient concentration effects are ignored
- Precipitation effects on volume and dilution are ignored

---

### 2.1 State Variables

These are the values tracked at every timestep:

| Variable | Symbol | Units | Updated By |
|---|---|---|---|
| Biomass concentration | X | g/L | Mass balance ODE |
| Pond temperature | T_pond | °C | Heat balance ODE |
| Culture volume | V | m³ | Evaporation loss |
| Cumulative harvest | M_harvest | kg | Harvest events |
| Areal productivity | Pareal | g/m²/day | Computed |
| Current growth rate | µeff | /day | Computed |
| Average light intensity | Iavg | µmol/m²/s | Beer-Lambert (direct + diffuse) |
| Lighted depth fraction | f_lighted | 0–1 | Beer-Lambert threshold |
| Light factor | µL | 0–1 | Light model |
| Temperature factor | µT | 0–1 | Temp model |

---

### 2.2 Timestep

Simulation runs at **hourly timesteps** (Δt = 1 h). Climate data is provided at hourly resolution from the Open-Meteo Historical Weather API. Sub-hourly values within the animation loop are linearly interpolated between hourly entries.

Euler integration is used for simplicity and transparency (appropriate for educational use and hourly Δt):
```
X(t + Δt) = X(t) + (µeff / 24) · X(t)
T_pond(t + Δt) = T_pond(t) + dT_pond/dt · Δt
```

---

### 2.3 Surface Irradiance — Dual-Path PAR Conversion

Climate data provides solar irradiance in W/m² as separate direct and diffuse components on a horizontal surface. The light response models require PAR in µmol photons/m²/s. Each component is processed through its own optical path.

#### Direct component

Source: `directRadiation` from weather data (W/m², beam on horizontal surface).

```
θ_direct = 90° - solarElevation           (angle from surface normal)
T_direct = fresnelTransmission(θ_direct)   (angle-dependent, see Section 1.5)
L_eff_direct = L / cos(θ_refracted)        (refracted optical path, see Section 1.3)

I_direct_surface = directRadiation · f_PAR · 4.57 · T_direct    [µmol/m²/s]
I_direct_avg = beerLambert(I_direct_surface, X, L_eff_direct)    [µmol/m²/s]
```

#### Diffuse component

Source: `diffuseRadiation` from weather data (W/m², hemispherical diffuse on horizontal surface).

```
θ_diffuse = 60°                             (fixed equivalent angle, Losing 2011)
T_diffuse = fresnelTransmission(60°)         (≈ 0.94, constant)
L_eff_diffuse = L / cos(θ_refracted_60)      (constant for a given depth)

I_diffuse_surface = diffuseRadiation · f_PAR · 4.57 · T_diffuse   [µmol/m²/s]
I_diffuse_avg = beerLambert(I_diffuse_surface, X, L_eff_diffuse)   [µmol/m²/s]
```

#### Total average PAR in culture

```
Iavg = I_direct_avg + I_diffuse_avg
```

This is the value passed to the light response model (µL).

**PAR conversion constants:**
| Parameter | Value | Notes |
|---|---|---|
| f_PAR | 0.43 | PAR is ~43% of total solar spectrum |
| 4.57 | µmol/J | Conversion factor for sunlight in PAR range |
| Combined | 1.965 | f_PAR × 4.57 — shortcut for W/m² → µmol/m²/s |

**Cross-check:** `shortwaveRadiation` from weather data should equal `directRadiation + diffuseRadiation` (GHI). Can be used for validation.

---

### 2.4 Heat Balance — Pond Temperature ODE

The pond temperature changes based on the net heat flux into the culture:

```
dT_pond/dt = Q_net / (ρ_water · Cp_water · depth)
```

```
Q_net = Q_solar + Q_longwave_in - Q_evap - Q_convection - Q_conduction - Q_longwave_out - Q_biomass
```

All Q terms in **W/m²** (per unit pond surface area). ρ_water = 1000 kg/m³, Cp_water = 4186 J/kg/°C.

---

#### 2.4.0 Wind Speed Height Conversion

Weather data provides wind speed at 10m height (`wind_speed_10m`). Heat transfer correlations require wind at 2m height. Convert using the logarithmic wind profile over open water:

```
u2 = u10 · ln(2 / z0) / ln(10 / z0)
```

| Parameter | Value | Notes |
|---|---|---|
| z0 | 0.001 m | Aerodynamic roughness length for open water |
| Ratio | ≈ 0.75 | ln(2/0.001) / ln(10/0.001) = 7.60 / 9.21 |

All subsequent heat transfer equations in this section use `u2`.

---

#### 2.4.1 Solar Radiation Absorbed — Q_solar

Total shortwave radiation absorbed by the pond surface:

```
Q_solar = GHI · (1 - albedo_water)
```

where GHI = `shortwaveRadiation` from weather data (= `directRadiation + diffuseRadiation`).

| Parameter | Value | Notes |
|---|---|---|
| albedo_water | 0.06 | Average reflectance of open water surface |

**Note:** The detailed Fresnel model (Section 1.5) is used for the PAR light path. For the heat balance, the simpler GHI × (1 - albedo) is used since we are tracking total thermal energy, not spectrally-resolved photons.

---

#### 2.4.2 Incoming Longwave Radiation — Q_longwave_in

Atmospheric longwave radiation emitted downward from sky, with cloud cover correction:

```
Q_longwave_in = ε_atm · σ · T_air_K⁴ · (1 + 0.2 · C²)
```

where T_air_K = T_air + 273.15, and C is cloud fraction (0–1, from `cloudCover / 100`).

**Atmospheric emissivity (clear sky):**
```
ε_atm = 0.642 · (e_a / T_air_K)^(1/7)     [Brutsaert, 1975]
```

**Vapor pressure from dew point (preferred):**
```
e_a = 0.6108 · exp(17.27 · T_dew / (T_dew + 237.3))    [kPa]
```

where T_dew = `dewPoint` from weather data (°C). Dew point gives a more accurate vapor pressure than the RH × e_sat approach.

**Alternative — vapor pressure from relative humidity:**
```
e_sat = 0.6108 · exp(17.27 · T_air / (T_air + 237.3))    [kPa]
e_a = (RH / 100) · e_sat
```

Note: weather data provides RH as 0–100%, so divide by 100 before use.

| Symbol | Description | Units |
|---|---|---|
| σ | Stefan-Boltzmann constant = 5.67×10⁻⁸ | W/m²/K⁴ |
| T_air | Air temperature (from climate data) | °C |
| T_dew | Dew point temperature (from climate data) | °C |
| C | Cloud fraction (from `cloudCover / 100`) | 0–1 |
| e_a | Actual vapor pressure | kPa |

**Alternative formulation — sky temperature model:**

Instead of separating incoming and outgoing longwave, they can be combined into a single net longwave term using the sky temperature approach (Duffie & Beckman, 2013):

```
T_sky = T_air_K · (0.711 + 0.0056 · T_dew + 0.000073 · T_dew² + 0.013 · cos(π/12 · t_solar))^0.25
Q_longwave_net = ε_water · σ · (T_pond_K⁴ - T_sky⁴)
```

This includes a diurnal correction via the cosine term (sky radiates less at night). If using this formulation, Q_longwave_in and Q_longwave_out are replaced by a single Q_longwave_net term in the Q_net equation.

---

#### 2.4.3 Outgoing Longwave Radiation — Q_longwave_out

Thermal emission from the pond surface:

```
Q_longwave_out = ε_water · σ · (T_pond + 273.15)⁴
```

| Parameter | Value |
|---|---|
| ε_water | 0.97 (emissivity of water in infrared) |

---

#### 2.4.4 Evaporative Heat Loss — Q_evap

```
Q_evap = h_evap · (e_s_pond - e_a) · f_wind
```

**Saturation vapor pressure at pond surface:**
```
e_s_pond = 0.6108 · exp(17.27 · T_pond / (T_pond + 237.3))    [kPa]
```

**Wind function (Penman-type):**
```
f_wind = a_wind + b_wind · u2
```

where u2 is the converted 2m wind speed (see Section 2.4.0).

| Parameter | Typical Value | Notes |
|---|---|---|
| h_evap | 6.43 | Evaporative mass transfer coefficient (MJ/m²/day/kPa) |
| a_wind | 1.0 | Calm-air coefficient |
| b_wind | 0.536 | Wind enhancement coefficient |

**Unit conversion:** h_evap · (e_s - e_a) · f_wind returns MJ/m²/day. Convert to W/m²:
```
Q_evap_W = Q_evap_MJ / 0.0864
```
(since 1 W/m² = 0.0864 MJ/m²/day).

**Water volume loss from evaporation:**
```
dV/dt = -Q_evap_volume · A_pond
Q_evap_volume (m³/m²/h) = Q_evap (MJ/m²/day) / (λ_water · 24)
```
where λ_water = latent heat of vaporization ≈ 2.45 MJ/kg.

---

#### 2.4.5 Convective Heat Loss — Q_convection

Sensible heat exchange between pond surface and air.

**Option A — McAdams correlation (independent):**
```
Q_convection = h_c · (T_pond - T_air)
```

**Convection coefficient (wind-dependent):**
```
h_c = 3.0 + 4.2 · u2     [W/m²/°C]    (McAdams correlation for flat surfaces)
```

**Option B — Bowen ratio (coupled to evaporation):**

A physically-motivated alternative that links sensible heat transfer to latent heat transfer through the same boundary layer:

```
Q_convection = γ_bowen · (P_atm · (T_pond - T_air)) / (P_ref · (e_s_pond - e_a)) · Q_evap
```

| Parameter | Value | Notes |
|---|---|---|
| γ_bowen | 61.3 | Bowen constant (Pa/°C) |
| P_atm | From climate data or 101325 | Atmospheric pressure (Pa) |
| P_ref | 101325 | Reference pressure (Pa) |

The Bowen ratio approach is more self-consistent because both convective and evaporative transfer occur through the same boundary layer. Use this as the primary method; McAdams serves as a cross-check.

---

#### 2.4.6 Conductive Heat Loss to Ground — Q_conduction

Steady-state approximation through the liner and soil:

```
Q_conduction = k_ground · (T_pond - T_ground) / d_ground
```

| Parameter | Typical Value | Notes |
|---|---|---|
| k_ground | 1.5 | Soil thermal conductivity (W/m/°C) |
| T_ground | From weather data | `soilTemperature` at 7–28cm depth; fallback 15°C |
| d_ground | 0.5 | Effective depth for conduction (m) |

**Geometry note:** For racetrack ponds, the conduction area includes the side walls:
```
A_conduction = A_surface + perimeter · depth
```
Apply the ratio A_conduction / A_surface as a multiplier to Q_conduction when normalizing to W/m² of pond surface.

**Implementation note:** Conduction is typically small for shallow ponds in warm climates.

---

#### 2.4.7 Photosynthetic Heat Sink — Q_biomass

Photosynthesis converts solar energy into chemical energy stored in biomass, acting as a heat sink:

```
Q_biomass = H_combustion · X · (µeff / 24) · depth · 1000
```

where the factor of 1000 converts g/L to kg/m³, and division by 24 converts /day to /hour to match the per-timestep calculation.

| Parameter | Value | Notes |
|---|---|---|
| H_combustion | ~20 MJ/kg | Heat of combustion of algae biomass |

This term is typically small relative to solar and evaporative terms (on the order of 1–5 W/m²) but is physically real. Converting the result to W/m²: multiply MJ by 1e6 / 3600 = 277.8.

---

### 2.5 Design Parameters

User-specified inputs that define the physical pond:

| Parameter | Symbol | Typical Range | Units |
|---|---|---|---|
| Pond surface area | A | 0.1–10 | ha |
| Culture depth | L | 0.15–0.35 | m |
| Length-to-width ratio | AR | 5–20 | — |
| Paddlewheel velocity | v_mix | 0.1–0.3 | m/s |
| Liner type | — | HDPE / clay | — |

#### Racetrack geometry

The pond is a racetrack (oval) shape — two straight sides connected by semicircular ends:

```
W = sqrt(A / AR)                              (channel width, m)
Ltotal = A / W                                (total length, m)
A_surface = (Ltotal - W) · W + π · (W/2)²    (pond surface area, m²)
perimeter = 2 · (Ltotal - W) + π · W          (outer perimeter, m)
A_soil = A_surface + perimeter · depth         (ground contact area, m²)
V = A_surface · depth                          (culture volume, m³)
```

---

### 2.6 Simulation Outputs (per timestep)

This is the full state exported to the frontend at each hourly step — the typed interface that connects simulation to visualization:

```typescript
interface OpenPondTimestep {
  // Time
  day: number                 // Simulation day (1-indexed)
  hour: number                // Hour of day (0–23)

  // Core state
  biomass_concentration: number    // g/L
  pond_temperature: number         // °C
  culture_volume: number           // m³

  // Growth factors
  net_growth_rate: number          // /day
  light_factor: number             // 0–1
  temperature_factor: number       // 0–1
  nutrient_factor: number          // 0–1 (1.0 in v1)
  lighted_depth_fraction: number   // 0–1

  // Light detail
  par_direct_surface: number       // µmol/m²/s (after Fresnel, before Beer-Lambert)
  par_diffuse_surface: number      // µmol/m²/s (after Fresnel, before Beer-Lambert)
  par_avg_culture: number          // µmol/m²/s (volume-averaged, = Iavg)
  fresnel_transmission_direct: number  // 0–1 (angle-dependent)

  // Productivity
  productivity_volumetric: number  // g/L/day
  productivity_areal: number       // g/m²/day

  // Heat flux components (W/m²)
  q_solar: number
  q_longwave_in: number
  q_longwave_out: number
  q_evap: number
  q_convection: number
  q_conduction: number
  q_biomass: number
  q_net: number                    // sum of all Q terms

  // Climate inputs (from weather data)
  air_temperature: number          // °C
  dew_point: number                // °C
  relative_humidity: number        // 0–100 %
  cloud_cover: number              // 0–100 %
  wind_speed_10m: number           // m/s (raw from data)
  wind_speed_2m: number            // m/s (converted for heat transfer)
  direct_radiation: number         // W/m² (horizontal surface)
  diffuse_radiation: number        // W/m² (horizontal surface)
  solar_elevation: number          // degrees above horizon
  soil_temperature: number         // °C (7–28cm depth)
  precipitation: number            // mm

  // Water balance
  evap_L: number                   // Evaporative water loss this hour (L)
  makeup_L: number                 // Fresh water added this hour (L)
  harvest_water_removed_L: number  // Culture volume removed during harvest (L)
  harvest_water_returned_L: number // Water recycled from harvest (80%) (L)

  // Harvest events
  harvest_occurred: boolean
  harvest_mass_kg: number          // 0 if no harvest
}
```

**Simulation summary** (returned after run completes):
```typescript
interface OpenPondSummary {
  total_days: number
  total_harvested_kg: number
  avg_productivity_areal: number       // g/m²/day
  avg_productivity_volumetric: number  // g/L/day
  avg_temperature: number              // °C
  harvest_count: number
  min_temperature: number
  max_temperature: number
  final_density: number                // g/L
}
```

---

### 2.7 Visualization Data Mapping

How simulation outputs connect to the Three.js visualization and Recharts:

| Visual Element | Data Source | Notes |
|---|---|---|
| Pond water color (green intensity) | `biomass_concentration` | Scale 0–4 g/L → color gradient |
| Weather particle effects | `wind_speed_10m`, `cloud_cover`, `precipitation` | Rain/clouds from climate data |
| Temperature display | `pond_temperature` | °C, shown in data strip |
| Light beam angle/intensity | `solar_elevation`, `direct_radiation` | Daylight arc visualization |
| Biomass density chart | `biomass_concentration` vs time | SVG time-series in SimulationCharts |
| Productivity chart | `productivity_areal` vs time | SVG time-series in SimulationCharts |
| Accumulated biomass chart | cumulative `harvest_mass_kg` vs time | SVG time-series in SimulationCharts |
| Growth factor gauges | `light_factor`, `temperature_factor` | Current value displays in data strip |
| Light response position | `par_avg_culture` | Marker on µL curve in GrowthModelPanels |
| Temperature response position | `pond_temperature` | Marker on µT curve in GrowthModelPanels |
| Light attenuation profile | `biomass_concentration`, `epsilon`, `kb` | Depth vs intensity in GrowthModelPanels |
| Mass balance | `biomass_concentration`, `harvest_mass_kg` | Growth/harvest/net chart in GrowthModelPanels |
| Water balance | `evap_L`, `makeup_L`, `harvest_water_*` | Cumulative water tracking in GrowthModelPanels |
| Fresnel transmission | `fresnel_transmission_direct` vs `solar_elevation` | Shown on light attenuation chart |

---

## 3. Outdoor Flat Panel PBR

**Status: Planned (not yet designed)**

Key differences from Open Pond that will need separate equations:
- Vertical orientation → incidence angle matters significantly
- No evaporative cooling from open surface
- Temperature control via water jacket or spray cooling
- Much higher biomass density (2–10 g/L vs 0.3–0.5 g/L for pond)
- Shorter light path → different Beer-Lambert parameterization

*Equations to be designed before this simulator is built.*

---

## 4. Outdoor Tubular PBR

**Status: Planned (not yet designed)**

Key differences:
- Circular tube geometry → volumetric light averaging differs from flat slab
- Temperature governed by tube material conductivity and flow rate
- Light/dark cycling from tube rotation and flow
- Degasser column for O₂ removal (separate heat/mass exchange unit)

*Equations to be designed before this simulator is built.*

---

## 5. Indoor / Controlled Environment

**Status: Planned — Dynamic PBR Simulator**

Key differences for all reactor types:
- No solar term — replace with LED spectrum and intensity model
- No natural convection or wind — HVAC-controlled environment
- All heat terms become control system inputs (heater, chiller, fan)
- PID control loops replace passive heat balance
- CO₂ is actively controlled → pH and dissolved CO₂ become state variables

*Detailed equations will be designed when the Dynamic PBR Simulator is built.*

---

## 6. Adding a New Simulation Type

When designing a new reactor/environment combination, add to this document following this checklist:

1. **Define state variables** — what is tracked at every timestep
2. **Write the mass balance ODE** — dX/dt and any other changing concentrations
3. **Write the energy balance ODE** — dT/dt with all flux terms listed
4. **Specify geometry** — how it affects light path and heat exchange area
5. **Define design parameters** — what the user configures
6. **Define the timestep output interface** — typed `interface` matching the Outputs section pattern above
7. **Map outputs to visualization** — which visual elements use which variables
8. **Update the status table below**

---

## 7. Simulator Status Summary

| Reactor Type | Environment | Status | Notes |
|---|---|---|---|
| Open Raceway Pond | Outdoor | ✅ Complete | v1 implemented |
| Flat Panel PBR | Outdoor | 📋 Planned | Equations not yet designed |
| Tubular PBR | Outdoor | 📋 Planned | Equations not yet designed |
| Any | Indoor/Controlled | 📋 Planned | Dynamic PBR Simulator |

---

## 8. Constants Reference

Commonly used physical constants across all simulators:

| Constant | Symbol | Value | Units |
|---|---|---|---|
| Stefan-Boltzmann | σ | 5.67×10⁻⁸ | W/m²/K⁴ |
| Water density | ρ | 1000 | kg/m³ |
| Water heat capacity | Cp | 4186 | J/kg/°C |
| Latent heat of vaporization | λ | 2.45 | MJ/kg |
| PAR fraction of solar | f_PAR | 0.43 | — |
| PAR conversion factor | — | 4.57 | µmol/J |
| Universal gas constant | R | 8.314 | J/mol/K |
| Refractive index of air | n_air | 1.0 | — |
| Refractive index of water | n_water | 1.333 | — |
| Heat of combustion (algae) | H_comb | ~20 | MJ/kg |
| Bowen constant | γ | 61.3 | Pa/°C |
| Aerodynamic roughness (water) | z0 | 0.001 | m |
| Minimum PAR threshold | I_min | 1.0 | µmol/m²/s |
| Diffuse equivalent angle | θ_diff | 60 | degrees |

---

## 9. References

- Brutsaert, W. (1975). On a derivable formula for long-wave radiation from clear skies. *Water Resources Research*, 11(5), 742–744.
- Duffie, J.A. & Beckman, W.A. (2013). *Solar Engineering of Thermal Processes* (4th ed.). Wiley.
- Losing, F. (2011). Optical modelling of flat plate photobioreactors. *MSc Thesis, Wageningen University*.
- Marsullo, M. et al. (2015). Dynamic simulation of the microalgae cultivation in open ponds. *Energy Procedia*, 82, 39–45.
- McAdams, W.H. (1954). *Heat Transmission* (3rd ed.). McGraw-Hill.
- Penman, H.L. (1948). Natural evaporation from open water, bare soil and grass. *Proceedings of the Royal Society A*, 193, 120–145.
- Richmond, A. (Ed.) (2004). *Handbook of Microalgal Culture*. Blackwell Science.
- Slegers, P.M. et al. (2013). Design scenarios for flat panel photobioreactors. *Applied Energy*, 88(10), 3342–3353.
- Ogbonna, J.C. & Tanaka, H. (2000). Light requirement and photosynthetic cell cultivation. *Biochemical Engineering Journal*, 5(2), 105–112.
