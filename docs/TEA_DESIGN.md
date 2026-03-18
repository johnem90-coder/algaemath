# Techno-Economic Analysis (TEA) Design Reference

Engineering cost models, financial analysis, and data structures for AlgaeMath techno-economic analyses.

**Scope:** This document covers the cost estimation methodology — equipment sizing, capital costs, operating costs, material balances, and financial analysis. Growth kinetics and simulation are documented separately in `SIMULATION_DESIGN.md` and `MODEL_REGISTRY.md`.

**Relationship to other docs:** The simulation engine produces growth rates and productivities. The TEA consumes a subset of those parameters (growth rate, harvest density, active days) as inputs, but runs its own independent sizing and cost calculations. The two systems are complementary — the simulator answers "how much biomass?" and the TEA answers "at what cost?"

---

## Document Organization

TEA analyses are organized by **reactor type**: Open Raceway Pond · Flat Panel PBR · Tubular PBR *(more may be added)*.

Each reactor type follows the same structural pattern (inputs → geometry → material balance → equipment sections → cost rollup → financial analysis) but with different equipment lists, sizing correlations, and cost data.

Shared equations and financial methods are defined once in **Section 1 (Common)** and referenced by name elsewhere. Reactor-specific details are in **Section 2+**.

---

## 1. Common / Shared

These modules apply across all reactor types.

---

### 1.1 System Input Variables

Every TEA analysis accepts these top-level inputs. Default values shown are for the open raceway pond / Spirulina baseline.

#### Physical System Inputs

| Parameter | Symbol | Default | Range | Units | Notes |
|---|---|---|---|---|---|
| Desired Output | Q_target | 800 | 10–5000 | tons BM/yr | Controls overall system size |
| Active Time | t_active | 330 | 200–365 | days/yr | Operating days per year |
| Pond Size | A_pond | 1.0 | 0.5–10 | acres | Individual pond area |
| Pond Depth | L | 0.12 | 0.10–0.35 | m | Culture depth |
| Pond L:W Ratio | AR | 10 | 5–20 | — | Length-to-width ratio |
| Pond Spacing (columns) | s_col | 2.6 | 1.5–5.0 | m | Between pond columns |
| Pond Spacing (rows) | s_row | 1.85 | 1.5–5.0 | m | Between pond rows |
| Unit Lifetime | T_life | 30 | 10–40 | years | Facility operating lifetime |

#### Growth Inputs

| Parameter | Symbol | Default | Range | Units | Notes |
|---|---|---|---|---|---|
| Effective Growth Rate | µ_eff | 0.207 | 0.05–0.50 | /day | From simulation or literature |
| Density at Harvest | X_harvest | 0.362 | 0.1–1.0 | g/L | Steady-state concentration |

#### Unit Cost Inputs

| Parameter | Symbol | Default | Units | Notes |
|---|---|---|---|---|
| Electricity Price | p_elec | 0.4024 | $/kWh | Hawaii 2022 commercial rate |
| Natural Gas Price | p_gas | 0.03367 | $/cuft | Hawaii 2022/2023 industrial |
| Diesel Price | p_diesel | 1.60 | $/L | May 2022 |
| CO₂ Price | p_co2 | 375 | $/ton | DAC-sourced estimate |
| Potassium Nitrate Price | p_kno3 | 600 | $/ton | Volatile commodity |
| Diammonium Phosphate Price | p_dap | 600 | $/ton | Volatile commodity |
| Other Micronutrient Price | p_micro | 600 | $/ton | Estimate |
| Water Price | p_water | 0.1329 | $/m³ | Municipal supply |
| Labor Rate | p_labor | 36.50 | $/hr | ~$70k/yr salary |

#### Algae Composition Inputs

These drive the stoichiometric nutrient demand calculation (Section 1.3).

| Element | Source Compound | Formula | % of Biomass | Default | Notes |
|---|---|---|---|---|---|
| Carbon | Carbon Dioxide | CO₂ | C_frac | 0.54 | Needs better sourcing |
| Nitrogen | Potassium Nitrate | KNO₃ | N_frac | 0.018 | Needs better sourcing |
| Phosphorus | Diammonium Phosphate | (NH₄)₂HPO₄ | P_frac | 0.0022 | Needs better sourcing |
| Other Micronutrients | — | — | M_frac | 0.000269 | Derived: P_frac²/N_frac (rough estimate) |

#### Financial Inputs

| Parameter | Symbol | Default | Range | Units | Notes |
|---|---|---|---|---|---|
| Federal Tax Rate | τ_fed | 0.25 | 0–0.40 | — | US 2023 |
| State Tax Rate | τ_state | 0.064 | 0–0.15 | — | Hawaii 2023 |
| Discount Rate | r | 0.10 | 0.05–0.20 | — | For NPV/DCF |
| Depreciation Method | — | MACRS-7 | — | — | 7-year MACRS or straight-line |
| Working Capital | W_cap | 0.05 | 0.03–0.10 | fraction of CAPEX | Initial working capital |
| Salvage Value | S_val | 0.0 | 0–0.10 | fraction of CAPEX | End-of-life value |

**Derived:**
```
τ_total = τ_fed + τ_state − (τ_fed × τ_state)
```

#### Non-Technical Overhead Costs

Annual overhead expressed as $/ton of biomass produced:

| Category | Default ($/ton BM) | Notes |
|---|---|---|
| Quality Assurance | 100 | |
| Regulatory Compliance | 50 | |
| Marketing | 100 | |
| Sales | 50 | |
| **Total** | **300** | |

```
overhead_annual = overhead_per_ton × Q_actual
```

---

### 1.2 Geometry & Sizing — Racetrack Pond

Shared geometry model for open raceway ponds (used by both biomass and inoculum sections).

#### Single Pond Dimensions

```
W = sqrt(A_pond_m2 / AR)                                  // Channel width (m)
L_total = W × AR                                           // Total length (m)
SA = W × (L_total − W) + π × (W/2)²                       // Pond surface area (m²)
perimeter = 2 × (L_total − W) + π × W                     // Outer perimeter (m)
V_pond = SA × L                                            // Culture volume per pond (m³)
```

where `A_pond_m2 = A_pond_acres × 4046.86`.

#### System Sizing

```
BM_production_rate = X_harvest × µ_eff                     // g/L/day
BM_production_annual = BM_production_rate × t_active        // g/L/yr

V_required = Q_target × 10⁶ / BM_production_annual         // Total volume needed (L)
V_required_m3 = V_required / 1000                           // (m³)

n_ponds = ceil(V_required_m3 / V_pond)                      // Number of ponds
```

**Actual production** (may exceed target due to rounding up):
```
Q_actual = n_ponds × V_pond × BM_production_annual / 10⁶   // tons/yr
```

#### Land Area

```
// Pond layout grid
n_rows = ceil(n_ponds / 2)                                  // Ponds arranged in 2 columns
n_cols = floor(n_ponds / n_rows)

// Total land footprint
land_width = n_cols × (W + s_col)                           // m
land_length = n_rows × (L_total + s_row)                    // m
A_land_m2 = land_width × land_length                        // m²
A_land_acres = A_land_m2 / 4046.86                          // acres
```

Note: The current model uses a simplified grid layout. The actual layout in the Excel uses `n_rows = ceil(n_ponds / 2)` and arranges ponds with the specified column and row spacing, then computes total area as `(W + s_col) × (L_total + s_row) × n_ponds`.

#### Liner Area (for cost estimation)

```
A_bottom = SA                                               // m²
A_flat_sides = 2 × (L_total − W) × L                       // m² (straight sections)
A_round_sides = π × W × L                                   // m² (semicircular ends, ×2 but half-circumference each)
A_liner_per_pond = A_bottom + A_flat_sides + A_round_sides  // m²
A_liner_total = A_liner_per_pond × n_ponds                  // m²
```

---

### 1.3 Nutrient Stoichiometry & Material Balance

Calculates annual demand for CO₂, nutrients, and water from biomass composition inputs.

#### Nutrient Demand

For each element (Carbon, Nitrogen, Phosphorus):

```
molecule_demand = element_frac × (MW_source / AW_element) / η_uptake    // g source molecule / g biomass
```

| Element | AW (g/mol) | Source | MW (g/mol) | Uptake Efficiency η | Buffer |
|---|---|---|---|---|---|
| Carbon | 12.011 | CO₂ | 44.01 | 0.30 | 0.30 |
| Nitrogen | 14.007 | KNO₃ | 101.103 | 1.00 | 0.20 |
| Phosphorus | 30.974 | (NH₄)₂HPO₄ | 132.06 | 1.00 | 0.20 |

**Note:** CO₂ uptake efficiency of 30% reflects significant degassing losses in open ponds. This is a key parameter that differs dramatically between open ponds (~30%) and closed PBRs (~80–95%).

```
daily_consumption = Q_actual_tons_per_day × molecule_demand × 1000       // kg/day
daily_with_buffer = daily_consumption × (1 + buffer)                     // kg/day
annual_consumption = daily_with_buffer × t_active / 1000                 // tons/yr
```

Where `Q_actual_tons_per_day = Q_actual / t_active`.

**Other micronutrients** demand is estimated as: `P_annual × (P_annual / N_annual)` — a rough scaling, not stoichiometric.

#### Water Demand

```
// Harvesting transfer volume
V_transfer_daily = V_system × µ_eff                          // m³/day (culture sent to harvesting)

// Evaporation
V_evap_daily = evap_rate_mm × A_pond_total_m2 / 1000        // m³/day

// Harvest return water (not all water is removed)
η_harvest = 0.70                                              // Harvest dewatering efficiency
V_slurry_daily = V_transfer_daily × (1 − η_harvest)          // m³/day (slurry volume)

// Total daily water consumption
V_water_daily = V_evap_daily + V_slurry_daily                 // m³/day
V_water_annual = V_water_daily × t_active                     // m³/yr
```

| Parameter | Default | Units | Notes |
|---|---|---|---|
| evap_rate_mm | 10 | mm/day | Location-dependent |
| η_harvest | 0.70 | — | Fraction of water removed in dewatering |

---

### 1.4 Cost Escalation

Equipment costs from reference years are escalated to a common analysis year.

```
cost_target_year = cost_reference_year × escalation_factor
```

| From → To | Factor | Basis |
|---|---|---|
| 2006 → 2022 | 1.42 | Approximate CEPCI ratio |
| 2011 → 2022 | 1.24 | Approximate CEPCI ratio |
| AUD → USD | 0.70827 | Exchange rate (static) |

**Note for future improvement:** These should be replaced with actual CEPCI indices and a configurable analysis year. The current factors are baked-in approximations.

---

### 1.5 Installation Cost Factors

Capital costs include both direct equipment purchase and indirect installation costs. Each section defines its own factor ranges.

**Indirect cost categories:**

| Category | Description |
|---|---|
| Installation | Physical mounting, foundations |
| Process Piping | Pipe, valves, fittings |
| Instrumentation | Sensors, control systems |
| Insulation | Thermal insulation |
| Electrical | Wiring, switchgear, panels |
| Buildings | Structures, enclosures |
| Yard Improvement | Grading, roads, fencing |
| Auxiliary Facilities | Utilities, support infrastructure |
| Engineering | Design, procurement |
| Construction | Construction management |
| Contractor's Fee | General contractor overhead |
| Contingency | Uncertainty allowance |

Each factor is expressed as a fraction of direct equipment purchase cost. The total installed cost for a section is:

```
total_capital = equipment_purchase × (1 + Σ installation_factors) + land_cost
```

**Exception:** Biomass and Inoculum pond costs from NREL reference data are **fully installed** — no additional installation factors are applied. Only land cost is added.

See `installation-factors.json` for per-section values.

---

### 1.6 Maintenance Cost Model

Annual maintenance per equipment item:

```
maintenance_cost = purchase_cost × maintenance_rate
```

| Wear Rate | Multiplier | Typical Equipment |
|---|---|---|
| Low | 3% | Tanks, hoppers, silos, piping |
| Medium | 5% | Pumps, ponds, mix tanks |
| High | 7% | Filters, dryers |

---

### 1.7 Energy Cost Model

Each equipment item has a power rating and annual run time. Energy cost depends on the fuel type:

```
// Electricity
annual_energy_kWh = power_kW × run_time_hrs_per_yr
annual_cost_elec = annual_energy_kWh × p_elec

// Diesel (for pumps with diesel drives)
// Uses drive train efficiency chain: pump η × drive η × motor η
η_chain = η_pump × η_drive × η_motor     // 0.70 × 0.95 × 0.35 = 0.23275
annual_energy_MJ = power_kW × run_time_hrs_per_yr × (MJ_per_kWh / η_chain)
annual_diesel_L = annual_energy_MJ / MJ_per_L_diesel
annual_cost_diesel = annual_diesel_L × p_diesel

// Natural gas (for dryers)
// Specific to equipment — see Section 2 drying details
annual_cost_gas = annual_gas_cuft × p_gas
```

| Constant | Value | Units |
|---|---|---|
| MJ_per_kWh | 3.6 | MJ/kWh |
| MJ_per_L_diesel | 38.4 | MJ/L |
| η_pump | 0.70 | — |
| η_drive | 0.95 | — |
| η_motor | 0.35 | — |

---

### 1.8 Labor Cost Model

Each section defines named roles with headcount and salary. See `labor-roles.json` for the full listing.

```
section_labor_cost = Σ (headcount × annual_salary)
```

---

### 1.9 Financial Analysis

The financial module consumes the fully computed cost breakdown (total CAPEX, annual OPEX, annual production) and produces standard investment metrics.

#### Total Capital Investment (TCI)

```
TCI = total_CAPEX + working_capital
working_capital = W_cap × total_CAPEX
```

#### Annual Operating Cost (AOC)

```
AOC = materials_cost + energy_cost + maintenance_cost + labor_cost + overhead_cost
```

Where `overhead_cost = overhead_per_ton × Q_actual`.

#### Depreciation

**MACRS 7-year schedule** (default):

| Year | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Rate | 14.29% | 24.49% | 17.49% | 12.49% | 8.93% | 8.92% | 8.93% | 4.46% |

**Straight-line alternative:**
```
annual_depreciation = (total_CAPEX − salvage_value) / depreciation_period
```

#### Annual Cash Flow (for year t)

```
revenue(t) = sale_price × Q_actual
COGS(t) = AOC
gross_profit(t) = revenue(t) − COGS(t)
depreciation(t) = MACRS_rate(t) × total_CAPEX        // only during depreciation period
taxable_income(t) = gross_profit(t) − depreciation(t)
taxes(t) = max(0, taxable_income(t) × τ_total)
net_income(t) = taxable_income(t) − taxes(t)
free_cash_flow(t) = net_income(t) + depreciation(t)   // add back non-cash depreciation
```

**Year 0 (initial investment):**
```
cash_flow(0) = −TCI
```

**Final year (with salvage):**
```
cash_flow(T_life) = free_cash_flow(T_life) + salvage_value
```

#### Net Present Value (NPV)

```
NPV = Σ(t=0 to T_life) [ cash_flow(t) / (1 + r)^t ]
```

#### Internal Rate of Return (IRR)

The discount rate r* such that NPV(r*) = 0. Solved numerically (Newton-Raphson or bisection).

#### Minimum Biomass Selling Price (MBSP)

The sale price at which NPV = 0 at the specified discount rate. Solved numerically — find `sale_price*` such that:

```
NPV(sale_price*, r) = 0
```

This is more rigorous than the current Excel approach (which simply divides total annual cost by production).

#### Payback Period

**Simple:**
```
payback_simple = TCI / annual_free_cash_flow
```

**Discounted:**
Find the year t where cumulative discounted cash flow first becomes positive.

#### Revenue Sensitivity Table

For a range of assumed sale prices (user-configurable or default sweep), compute:

| At each sale price | Formula |
|---|---|
| Annual Revenue | sale_price × Q_actual |
| Annual COGS | AOC |
| Gross Profit | Revenue − COGS |
| Depreciation | MACRS schedule (or 0 after depreciation period) |
| Taxable Income | Gross Profit − Depreciation |
| Taxes | max(0, Taxable Income × τ_total) |
| Net Income | Taxable Income − Taxes |
| Net Profit Margin | Net Income / Revenue |
| NPV | Full DCF at this sale price |

---

### 1.10 MBSP Breakdown

The MBSP can be decomposed by section and by cost category to show where costs originate.

**By section** ($/ton of MBSP):

```
MBSP_capex_section = section_CAPEX / (Q_actual × T_life)    // Annualized capital per ton
MBSP_opex_section = section_OPEX / Q_actual                  // Operating cost per ton
```

**By expense category** ($/ton of MBSP):

| Category | Calculation |
|---|---|
| Annualized CAPEX | total_CAPEX / (Q_actual × T_life) |
| OPEX | AOC / Q_actual |
| Non-Technical Overhead | overhead_per_ton (fixed) |

**Note:** The annualized CAPEX approximation above (`CAPEX / tons / lifetime`) is a simplified view. The true MBSP from the DCF accounts for time-value of money and depreciation tax shields, so these breakdowns are illustrative, not exact components of the DCF-derived MBSP.

---

## 2. Open Raceway Pond — Spirulina Baseline

**Status: Reference data extracted from Excel model (v1)**

**System overview:** Large-scale outdoor Spirulina cultivation in racetrack ponds with paddlewheel mixing. Biomass is harvested via multi-stage dewatering (screening → vacuum belt filtration) and spray-dried to powder.

**Process flow:**
```
Water Supply → Filtration → Nutrient Mixing → Growth Ponds → Harvesting → Drying → Storage
                                                    ↑                        |
                                                    └── Water Recycle ───────┘
```

**Inoculum flow (parallel system):**
```
Pond Cs (0.001 ac) → Pond Bs (0.01 ac) → Pond As (0.1 ac) → Growth Ponds
         ×3                  ×3                  ×3
         7-day cycle each tier
```

---

### 2.1 Section: Inputs (Water Treatment & Delivery)

Handles water sourcing, filtration, nutrient storage, mixing, and CO₂ supply.

#### Equipment List

| ID | Name | Type | Function | Sizing Basis |
|---|---|---|---|---|
| INP-01 | Tank 1 | Cone Roof | Raw water storage | Buffer days × daily water demand |
| INP-02 | Pump 1 | Vortex Impeller (diesel) | Raw water transfer | Daily water ÷ run hours |
| INP-03 | Filter 1 | Ultrafiltration | Water purification | Daily water in GPD |
| INP-04 | Tank 2s | Cone Roof | Filtered water buffer (1 per row) | Buffer days × daily demand ÷ n_rows |
| INP-05 | Pump 2s | Diesel pump | Tank 2 → Mix Tank transfer | Volume per fill ÷ run time |
| INP-06 | Hopper 1s | Dry storage | KNO₃ storage (1 per 2 ponds) | Buffer days × daily nutrient ÷ density |
| INP-07 | Hopper 2s | Dry storage | DAP storage (1 per 2 ponds) | Buffer days × daily nutrient ÷ density |
| INP-08 | Hopper 3s | Dry storage | Micronutrient storage (1 per 2 ponds) | Derived from Hopper 2 sizing |
| INP-09 | Mix Tank 1s | Cone + Propeller | Nutrient dissolving (1 per 2 ponds) | Fixed 510 gal capacity |
| INP-10 | CO₂ Tanks | Pressure vessel | Liquid CO₂ storage | Buffer days × daily CO₂ ÷ density |

See `equipment-catalog.json` for full specifications, costs, and source citations.

#### Cost Correlations

**Tank cost** (Tank 1, Tank 2s, and Harvesting Tank 3s share this):
```
cost_2006 = 5700 + 700 × capacity_m3^0.7       // USD, 2006
cost_2022 = cost_2006 × 1.42                    // Escalated to 2022
```
Source: Not documented. Likely Perry's Chemical Engineers' Handbook or similar.

#### Sizing Logic

Tank 1 capacity:
```
required_m3 = buffer_days × V_water_daily
units = ceil(required_m3 / available_capacity)
```

Pump 1 flow:
```
required_Ls = (required_m3 / (buffer_days × units)) × 1000 / (run_hrs × 3600)
```

Filter 1 capacity:
```
required_GPD = (V_water_daily / buffer_days) × 1000 / (run_hrs × 3600) × (3600 / 3.78541 × 24)
units = ceil(required_GPD / available_GPD)
```

All other items: `units = n_ponds / 2` (one per two ponds) or `n_rows` (one per row).

CO₂ tank sizing:
```
required_m3 = daily_co2_consumption_tons × buffer_days / co2_liquid_density
units = required_m3 / tank_capacity
```

#### Installation Factors (Inputs Section)

| Category | Factor |
|---|---|
| Auxiliary Facilities | 0.20–0.50 |
| Engineering | 0.20–0.25 |
| Construction | 0.30–0.35 |
| Contractor's Fee | 0.03–0.05 |
| Contingency | 0.07–0.10 |

See `installation-factors.json` for full values.

---

### 2.2 Section: Biomass (Growth Ponds)

The main production system — racetrack ponds with paddlewheel mixing.

#### Equipment

| ID | Name | Sizing | Notes |
|---|---|---|---|
| BIO-01 | Racetrack Ponds | n_ponds × pond_cost | Fully installed cost from NREL reference |

#### Pond Cost Correlation

From NREL 2011 Algae Farm Model (fully installed, includes liner, earthwork, paddlewheel, baffles):

```
pond_cost_2011 = 60788 × pond_size_acres + 68046          // USD, 2011
pond_cost_2022 = pond_cost_2011 × 1.24                     // Escalated to 2022
```

This linear correlation was fit to NREL data points for "Full" liner option. See `nrel-pond-reference.json` for the original data table.

**No additional installation factors** — NREL costs are fully installed.

#### Paddlewheel Energy Correlation

From NREL reference data, power-law fit:

```
energy_per_acre_day = 34.2 × pond_size_acres^(−0.176)     // kWh/acre/day
energy_per_pond_yr = energy_per_acre_day × pond_size_acres × t_active  // kWh/pond/yr
total_energy = energy_per_pond_yr × n_ponds                 // kWh/yr
```

---

### 2.3 Section: Inoculum

Three-tier scaling system to inoculate large ponds. Each tier has 3 ponds and a 7-day growth cycle.

#### Inoculum Pond Tiers

| Tier | Name | Size (acres) | Size Factor | Count |
|---|---|---|---|---|
| A | Pond As | 0.1 | 1/10 of large pond | 3 |
| B | Pond Bs | 0.01 | 1/100 of large pond | 3 |
| C | Pond Cs | 0.001 | 1/1000 of large pond | 3 |

The inoculum pond sizes scale as fractions of the main pond size.

#### Cost & Energy

Same NREL pond cost correlation and paddlewheel energy correlation as biomass section, applied at the smaller pond sizes.

```
inoc_pond_cost = 60788 × inoc_pond_acres + 68046           // per pond, 2011 $
```

Energy costs for inoculum ponds are small relative to biomass ponds (~$152/yr total vs ~$1.66M/yr for biomass).

---

### 2.4 Section: Harvesting

Multi-stage dewatering process. Operates during a harvest window each day.

#### Process Parameters

| Parameter | Value | Notes |
|---|---|---|
| Ponds per harvest system | n_rows (half of n_ponds) | All ponds harvested by 1 system |
| Number of harvest systems | n_cols | Typically 1–2 |
| Time to harvest | 6 hrs/day | Harvest window |
| Inlet flow | V_transfer_daily / n_harvest_systems | m³/day per system |
| Filter 3 efficiency | 0.70 | Fraction of water removed |
| Filter 4 efficiency | 0.25 | Further dewatering |

#### Equipment List

| ID | Name | Type | Function | Sizing Basis |
|---|---|---|---|---|
| HAR-01 | Pump 3s | Twin Impeller (diesel) | Pond → Filter 2 transfer | Inlet flow ÷ harvest hours |
| HAR-02 | Filter 2s | Slant Screen | Primary biomass separation | Inlet flow ÷ unit capacity |
| HAR-03 | Filter 3s | Shaker Screen | Biomass chunk breakup | Same count as Filter 2s |
| HAR-04 | Filter 4s | Vacuum Belt | Wash & dewater | Post-Filter 3 flow ÷ unit capacity |
| HAR-05 | Tank 3s | Cone Roof | Filtrate holding | Buffer × daily filtrate volume |
| HAR-06 | Pump 4s | Centrifugal (electric) | Return water to ponds | Filtrate flow rate |

#### Installation Factors (Harvesting Section)

| Category | Factor |
|---|---|
| Process Piping | 0.30–0.40 |
| Instrumentation | 0.20–0.35 |
| Insulation | 0.01–0.03 |
| Electrical | 0.10–0.15 |
| Buildings | 0.10–0.45 |
| Yard Improvement | 0.05–0.15 |
| Auxiliary Facilities | 0.20–0.50 |
| Engineering | 0.20–0.25 |
| Construction | 0.30–0.35 |
| Contractor's Fee | 0.03–0.05 |
| Contingency | 0.07–0.10 |

---

### 2.5 Section: Drying

Final dewatering from harvest slurry (~75% water) to dry product (~5% moisture).

#### Process Parameters

| Parameter | Calculation | Notes |
|---|---|---|
| Inlet flow | Outlet of all Filter 4 systems | m³/hr |
| Water content inlet | 0.75 (75%) | Post-harvest slurry |
| Water content outlet | 0.05 (5%) | Final dry product |
| Evaporation required | inlet_flow × (water_in − water_out) | kg/hr |
| Number of drying systems | Same as harvest systems | |

#### Equipment List

| ID | Name | Type | Function | Notes |
|---|---|---|---|---|
| DRY-01 | Pump 5s | Sludge Pump | Slurry transfer to dryer | Source: Alibaba |
| DRY-02 | Dryer 1 | Spray Dryer (natural gas) | Evaporate excess water | Cost correlation |
| DRY-03 | Silo 1 | Dry bulk storage | Finished product holding | 14-day buffer |

#### Spray Dryer Cost Correlation

```
cost_2006 = 190000 + 180 × evap_rate_kg_hr^0.9            // USD, 2006
cost_2022 = cost_2006 × 1.42                               // Escalated to 2022
```

Source: Not documented.

#### Dryer Energy

```
heat_required_MJ_per_ton = 2260                             // MJ/ton water evaporated
dryer_efficiency = 0.25                                      // 25% thermal efficiency
heat_input_MJ_hr = heat_required × evap_rate / 1000 / efficiency
natural_gas_cuft_yr = heat_input_MJ_hr × t_active × operating_factor
```

Where `operating_factor = 1.06` accounts for startup/shutdown losses.

---

### 2.6 Cost Rollup

Total system costs are the sum across all sections:

```
total_CAPEX = Σ section_capital_cost                        // Inputs + Biomass + Inoculum + Harvesting + Drying
total_OPEX = Σ section_operating_cost                       // Materials + Energy + Maintenance + Labor per section
```

Each section's operating cost:
```
section_OPEX = materials + energy + maintenance + labor
```

**System-wide operating metrics:**

| Metric | Calculation |
|---|---|
| Total electricity (kWh/yr) | Sum across all sections |
| Total diesel (L/yr) | Sum across all sections |
| Total natural gas (cuft/yr) | Drying section only |
| Total water (m³/yr) | From material balance |
| Total CO₂ (tons/yr) | From nutrient stoichiometry |
| System productivity (g/m²/day) | Q_actual × 10⁶ / (A_land_m2 × t_active) |
| CO₂ fixation (tons/yr) | C_frac × Q_actual × 1000 × (MW_CO₂ / AW_C) |

---

### 2.7 Output Interfaces

#### TEA Result Summary

```typescript
interface TEAResult {
  // System sizing
  n_ponds: number;
  actual_production_tons_yr: number;
  land_area_acres: number;
  land_area_hectares: number;
  system_volume_m3: number;
  system_productivity_g_m2_day: number;

  // Cost totals
  total_capex: number;                    // $
  total_annual_opex: number;              // $/yr
  total_annual_overhead: number;          // $/yr
  total_annual_cost: number;              // $/yr (OPEX + overhead)

  // Per-section breakdown
  sections: Record<string, SectionCost>;

  // Resource consumption
  resources: ResourceConsumption;

  // Financial analysis
  financials: FinancialAnalysis;
}

interface SectionCost {
  section_id: string;                     // 'inputs' | 'biomass' | 'inoculum' | 'harvesting' | 'drying'
  section_name: string;
  capital_cost: number;                   // $
  equipment_purchase: number;             // $
  installation_cost: number;              // $
  land_cost: number;                      // $
  operating_cost: number;                 // $/yr
  materials_cost: number;                 // $/yr
  energy_cost: number;                    // $/yr
  maintenance_cost: number;               // $/yr
  labor_cost: number;                     // $/yr
  equipment: EquipmentItem[];
}

interface EquipmentItem {
  id: string;                             // 'INP-01', 'BIO-01', etc.
  name: string;
  type: string;                           // 'Cone Roof', 'Vortex Impeller', etc.
  function: string;                       // Description of role
  unit_cost: number;                      // $/unit (in analysis year)
  cost_basis_year: number;                // Year of original cost
  cost_escalation_factor: number;
  units_required: number;
  total_purchase_cost: number;
  power_rating_kW: number;
  energy_type: 'electricity' | 'diesel' | 'natural_gas' | 'none';
  annual_energy_units: number;            // kWh, L, or cuft
  annual_energy_cost: number;
  maintenance_rate: number;               // 0.03, 0.05, or 0.07
  annual_maintenance_cost: number;
  source_url: string | null;
  source_citation: string | null;
  notes: string | null;
}

interface ResourceConsumption {
  electricity_kWh_yr: number;
  diesel_L_yr: number;
  natural_gas_cuft_yr: number;
  water_m3_yr: number;
  co2_tons_yr: number;
  kno3_tons_yr: number;
  dap_tons_yr: number;
  co2_fixation_tons_yr: number;
}

interface FinancialAnalysis {
  // Key metrics
  mbsp: number;                           // $/ton (NPV=0 price)
  npv: number;                            // $ at specified sale price & discount rate
  irr: number;                            // % (rate where NPV=0)
  payback_simple_years: number;
  payback_discounted_years: number;

  // Configuration used
  discount_rate: number;
  tax_rate: number;
  depreciation_method: string;
  unit_lifetime_years: number;

  // Annual cash flow schedule
  cash_flows: AnnualCashFlow[];

  // Sensitivity table
  sensitivity: SensitivityRow[];

  // MBSP breakdown
  mbsp_by_section: MBSPBreakdown[];
  mbsp_by_category: MBSPCategoryBreakdown;
}

interface AnnualCashFlow {
  year: number;                           // 0 = initial investment
  revenue: number;
  cogs: number;
  gross_profit: number;
  depreciation: number;
  taxable_income: number;
  taxes: number;
  net_income: number;
  free_cash_flow: number;
  cumulative_dcf: number;                 // Running NPV
}

interface SensitivityRow {
  sale_price: number;
  revenue: number;
  gross_profit: number;
  net_income: number;
  net_profit_margin: number;
  npv: number;
}

interface MBSPBreakdown {
  section_id: string;
  section_name: string;
  capex_per_ton: number;                  // Annualized
  opex_per_ton: number;
  total_per_ton: number;
  percent_of_mbsp: number;
}

interface MBSPCategoryBreakdown {
  annualized_capex: number;               // $/ton
  opex: number;                           // $/ton
  overhead: number;                       // $/ton
  total: number;                          // $/ton (= MBSP simplified)
}
```

---

## 3. Reference Data Files

All reference data is stored as JSON in `lib/technoeconomics/open-pond/data/`. These files are imported directly by TypeScript modules and compiled into the client bundle. They serve as the "database" — the source of truth for equipment specs, costs, and correlations that the calculation engine consumes.

| File | Contents |
|---|---|
| `default-config.json` | All input parameters with defaults, ranges, and units |
| `equipment-catalog.json` | Every equipment item (specs, costs, sources, energy) |
| `nrel-pond-reference.json` | NREL 2011 pond cost and energy data |
| `cost-correlations.json` | Tank, dryer, paddlewheel cost formulas |
| `installation-factors.json` | Per-section indirect cost multipliers |
| `land-prices.json` | US state land pricing reference |
| `labor-roles.json` | Per-section roles, headcounts, salaries |
| `nutrient-chemistry.json` | Elements, molecules, weights, efficiencies |

See each file for schema details.

---

## 4. Adding a New Reactor Type TEA

When designing a TEA for a new reactor type (e.g., Flat Panel PBR):

1. **Define system inputs** — which parameters differ from open pond
2. **Define geometry** — reactor dimensions, packing density, land footprint
3. **Define sections** — what equipment is needed (may share some with open pond)
4. **Create equipment catalog entries** — new items for the reactor type
5. **Define cost correlations** — any reactor-specific sizing/cost formulas
6. **Reuse common modules** — nutrient stoichiometry, financial analysis, cost rollup
7. **Add reference data files** as needed

The financial analysis module (Section 1.9) is completely reactor-agnostic and should require no changes.

---

## 5. Confidence & Data Quality Flags

Each data point carries an implicit confidence level based on its sourcing:

| Level | Description | Examples |
|---|---|---|
| **High** | Published reference with citation | NREL pond costs, molecular weights |
| **Medium** | Vendor quote or correlation from handbook | Tank cost correlation, pump prices (AUD) |
| **Low** | Estimate or rough guess | Micronutrient fraction, labor headcounts, some filter costs |
| **Derived** | Computed from other values | Equipment counts, annual consumption |

These are tracked in `equipment-catalog.json` via the `source_confidence` field.

---

## 6. Status Summary

| Reactor Type | Status | Notes |
|---|---|---|
| Open Raceway Pond (Spirulina) | ✅ Engine + UI implemented | `runTEA()` in `lib/technoeconomics/open-pond/engine.ts` |
| Flat Panel PBR | 📋 Planned | Different geometry, no evap cooling |
| Tubular PBR | 📋 Planned | Tube geometry, degasser |

### Implementation Notes (deviations from original Excel)

- **Pond cost correlation:** Coefficients (60788, 68046) are already fitted to 2022-escalated data. No additional ×1.24 escalation applied (the original doc said 2011 output year, but the fit was to escalated data points).
- **Nutrient buffers removed:** The 30% CO₂ buffer, 20% N/P/micro buffers from the original Excel have been removed. The stoichiometric demand is used directly.
- **n_ponds rounded to grid:** `n_ponds = n_rows × n_cols` (always even), may exceed `ceil(V_required / V_pond)` by 1.
- **Installation costs:** Three-tier cascade (installation factors × equipment → indirect factors × installation → other factors × (installation + indirect)), not a single multiplier. Per-factor tracking for future user adjustability.
- **Inoculum sizing:** Pond counts calculated from inoculation timeline (default 6 months), not hardcoded. `ponds_per_tier = ceil(n_ponds / (target_weeks - n_tiers))`.
- **Equipment sizing:** Constraint-based selection from shared catalogs (water pumps, sludge pumps, tanks, filters, hoppers) rather than fixed unit counts from Excel. Unit counts may differ from Excel when flow volumes differ.
- **Land costs:** Removed from section CAPEX; to be added as a separate facility-level cost in a future update.

---

## 7. Implementation Architecture

### 7.1 Client-Side Execution

The TEA engine runs entirely client-side in the browser, following the same pattern as the open pond simulation engine in `lib/simulation/simple-outdoor/`. The engine is a **pure function**: it takes a configuration object and returns a complete `TEAResult`. There is no server-side computation.

This enables reactive, live recalculation — the user adjusts any input (equipment cost, energy price, facility size, sale price, etc.) and all outputs update immediately without a network round-trip.

### 7.2 File Placement

**Project documentation** (read-only reference):
```
docs/
├── TEA_DESIGN.md                          # This specification document
└── TEA_AlgaeBiomass_RacewayPond_Spirulina_230908.xlsx   # Original Excel (provenance archive)
```

**Calculation engine and reference data** (compiled into client bundle):
```
lib/technoeconomics/
├── types.ts                               # Shared TypeScript interfaces (TEAResult, SectionCost, etc.)
├── common/
│   ├── constants.ts                       # Physical constants, conversion factors, efficiency chains
│   ├── geometry.ts                        # Racetrack pond geometry (shared by biomass & inoculum)
│   ├── nutrient-balance.ts                # Stoichiometric nutrient demand from composition
│   ├── cost-escalation.ts                 # Year-based cost indexing
│   ├── installation.ts                    # Installation factor computation
│   ├── financials.ts                      # NPV, IRR, DCF, MBSP, depreciation, cash flow schedule
│   └── energy.ts                          # Energy cost calculations (electricity, diesel, gas)
│
├── open-pond/
│   ├── index.ts                           # Re-exports
│   ├── data/                              # Reference data — imported by TypeScript, bundled into client
│   │   ├── equipment-catalog.json
│   │   ├── nrel-pond-reference.json
│   │   ├── cost-correlations.json
│   │   ├── installation-factors.json
│   │   ├── land-prices.json
│   │   ├── labor-roles.json
│   │   └── nutrient-chemistry.json
│   ├── config.ts                          # Default config, typed exports, parameter ranges
│   ├── sections/
│   │   ├── inputs.ts                      # Water treatment & delivery section
│   │   ├── biomass.ts                     # Growth ponds section
│   │   ├── inoculum.ts                    # Inoculum scaling section
│   │   ├── harvesting.ts                  # Dewatering section
│   │   └── drying.ts                      # Spray drying section
│   ├── engine.ts                          # Main entry: config → TEAResult
│   └── outputs.ts                         # Cost rollup, MBSP breakdown, resource totals
│
├── flat-panel/                            # Future — same structure
└── tubular/                               # Future — same structure
```

**Page and UI components:**
```
app/technoeconomics/
├── page.tsx                               # Overview / index page
└── open-pond/
    ├── page.tsx                           # Open pond TEA page
    └── components/
        └── ...                            # UI components (sliders, charts, tables, etc.)
```

### 7.3 Reactive Recalculation Pattern

The UI maintains a config state object initialized from defaults. When the user edits any parameter, the config is updated and the engine re-runs:

```typescript
// Conceptual pattern (matches existing simulator approach)
const [config, setConfig] = useState(getDefaultConfig());
const result = useMemo(() => runTEA(config), [config]);
```

The `runTEA()` function is deterministic and fast (no async, no I/O) — it computes the full result from the config in a single synchronous pass. All reference data is already in memory via static imports.

### 7.4 Data Override Model

Every value in the reference data files has a default. The user's edits are stored as **overrides** on top of those defaults — the original reference data is never mutated. This means:

- A "Reset to defaults" action is trivial (clear overrides)
- The user can see which values they've changed vs. the baseline
- The original reference data remains available for CSV export as provenance

---

## 8. References

- NREL (2011). *Algae Farm Model — Open Ponds TEA Tool v1*. National Renewable Energy Laboratory.
- Perry, R.H. & Green, D.W. (2008). *Perry's Chemical Engineers' Handbook* (8th ed.). McGraw-Hill. [Assumed source for tank cost correlation]
- US EIA (2022). State electricity and natural gas prices.
- USDA (2022). Land Values Summary.
