"use client";

import type { TEAResult } from "@/lib/technoeconomics/open-pond";

interface Props {
  result: TEAResult;
}

interface Row {
  label: string;
  value: string;
  notes?: string;
}

function CategoryTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </h4>
      <table className="w-full text-sm border-collapse mb-1">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1.5 pr-4 font-medium text-xs">Parameter</th>
            <th className="py-1.5 pr-4 font-medium text-xs text-right">Value</th>
            <th className="py-1.5 font-medium text-xs">Notes</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-dashed">
              <td className="py-1.5 pr-4 font-sans text-sm">{row.label}</td>
              <td className="py-1.5 pr-4 text-right whitespace-nowrap">{row.value}</td>
              <td className="py-1.5 font-sans text-xs text-muted-foreground">{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InputVariablesTable({ result }: Props) {
  const c = result.config;

  const systemInputs: Row[] = [
    { label: "Active Days", value: `${c.active_days_yr} days/yr`, notes: "Operating days per year" },
    { label: "Pond Size", value: `${c.pond_size_acres} acres`, notes: "Individual pond area" },
    { label: "Pond Depth", value: `${c.pond_depth_m} m`, notes: "Culture depth" },
    { label: "L:W Ratio", value: `${c.pond_lw_ratio}`, notes: "Length-to-width ratio" },
    { label: "Column Spacing", value: `${c.pond_spacing_col_m} m`, notes: "Between pond columns" },
    { label: "Row Spacing", value: `${c.pond_spacing_row_m} m`, notes: "Between pond rows" },
    { label: "Unit Lifetime", value: `${c.unit_lifetime_yrs} yrs`, notes: "Facility operating lifetime" },
  ];

  // Growth rate and harvest density are now controlled by the top-level sliders

  const unitCosts: Row[] = [
    { label: "Electricity", value: `$${c.electricity_per_kWh}/kWh`, notes: "Commercial rate estimate" },
    { label: "Natural Gas", value: `$${c.natural_gas_per_cuft}/cuft`, notes: "Industrial rate estimate" },
    { label: "Diesel", value: `$${c.diesel_per_L.toFixed(2)}/L`, notes: "May 2022" },
    { label: "CO\u2082", value: `$${c.co2_per_ton}/ton`, notes: "DAC-sourced estimate" },
    { label: "KNO\u2083", value: `$${c.kno3_per_ton}/ton`, notes: "Volatile commodity" },
    { label: "DAP", value: `$${c.dap_per_ton}/ton`, notes: "Volatile commodity" },
    { label: "Micronutrients", value: `$${c.micronutrient_per_ton}/ton`, notes: "Estimate" },
    { label: "Water", value: `$${c.water_per_m3}/m\u00B3`, notes: "Municipal supply" },
    { label: "Labor Rate", value: `$${c.labor_rate_per_hr.toFixed(2)}/hr`, notes: "~$70k/yr equivalent" },
  ];

  const algaeComposition: Row[] = [
    { label: "Carbon Fraction", value: `${(c.carbon_frac * 100).toFixed(1)}%`, notes: "CO\u2082 source" },
    { label: "Nitrogen Fraction", value: `${(c.nitrogen_frac * 100).toFixed(1)}%`, notes: "KNO\u2083 source" },
    { label: "Phosphorus Fraction", value: `${(c.phosphorus_frac * 100).toFixed(2)}%`, notes: "DAP source" },
    { label: "Micronutrient Fraction", value: `${(c.micronutrient_frac * 100).toFixed(4)}%`, notes: "Derived estimate" },
  ];

  const financialInputs: Row[] = [
    { label: "Federal Tax Rate", value: `${(c.federal_tax_rate * 100).toFixed(0)}%`, notes: "US federal corporate rate" },
    { label: "State Tax Rate", value: `${(c.state_tax_rate * 100).toFixed(1)}%`, notes: "State income tax rate" },
    { label: "Discount Rate", value: `${(c.discount_rate * 100).toFixed(0)}%`, notes: "For NPV/DCF" },
    { label: "Depreciation", value: c.depreciation_method, notes: "15-year MACRS for infrastructure" },
    { label: "Working Capital", value: `${(c.working_capital_fraction * 100).toFixed(0)}%`, notes: "Fraction of CAPEX" },
    { label: "Salvage Value", value: `${(c.salvage_value_fraction * 100).toFixed(0)}%`, notes: "End-of-life fraction" },
  ];

  const overheadCosts: Row[] = [
    { label: "Overhead", value: `$${c.overhead_per_ton}/ton`, notes: "Quality + regulatory + marketing + sales" },
  ];

  const processParams: Row[] = [
    { label: "Evaporation Rate", value: `${c.evaporation_rate_mm_day} mm/day`, notes: "Location-dependent" },
    { label: "Harvest Efficiency", value: `${(c.harvest_efficiency * 100).toFixed(0)}%`, notes: "Primary dewatering" },
    { label: "Harvest Hours", value: `${c.harvest_hours_per_day} hrs/day`, notes: "Daily harvest window" },
    { label: "Dryer Inlet Water", value: `${(c.dryer_inlet_water_content * 100).toFixed(0)}%`, notes: "Post-harvest slurry" },
    { label: "Dryer Outlet Water", value: `${(c.dryer_outlet_water_content * 100).toFixed(0)}%`, notes: "Final dry product" },
    { label: "Dryer Efficiency", value: `${(c.dryer_efficiency * 100).toFixed(0)}%`, notes: "Spray dryer thermal" },
    { label: "Dryer Operating Factor", value: `${c.dryer_operating_factor}`, notes: "Overhead factor" },
    { label: "Silo Buffer", value: `${c.silo_buffer_days} days`, notes: "Finished product storage" },
    { label: "Filter 3 Efficiency", value: `${(c.filter3_efficiency * 100).toFixed(0)}%`, notes: "Shaker screen dewatering" },
  ];

  const uptakeEfficiencies: Row[] = [
    { label: "CO\u2082 Uptake", value: `${(c.co2_uptake_efficiency * 100).toFixed(0)}%`, notes: "Open pond ~30%, PBR ~80-95%" },
    { label: "N Uptake", value: `${(c.n_uptake_efficiency * 100).toFixed(0)}%`, notes: "Nitrogen absorption" },
    { label: "P Uptake", value: `${(c.p_uptake_efficiency * 100).toFixed(0)}%`, notes: "Phosphorus absorption" },
  ];

  const dieselDrivetrain: Row[] = [
    { label: "Pump Efficiency", value: `${(c.eta_pump * 100).toFixed(0)}%`, notes: "Mechanical" },
    { label: "Drivetrain Efficiency", value: `${(c.eta_drive * 100).toFixed(0)}%`, notes: "Transmission" },
    { label: "Motor Efficiency", value: `${(c.eta_motor * 100).toFixed(0)}%`, notes: "Diesel thermal" },
  ];

  const maintenanceRates: Row[] = [
    { label: "Passive", value: `${(c.maintenance_rate_passive * 100).toFixed(0)}%`, notes: "Tanks, hoppers, storage" },
    { label: "Mechanical", value: `${(c.maintenance_rate_mechanical * 100).toFixed(0)}%`, notes: "Pumps, mixers" },
    { label: "Membrane", value: `${(c.maintenance_rate_membrane * 100).toFixed(0)}%`, notes: "UF/MF filters" },
  ];

  const bufferDays: Row[] = [
    { label: "Raw Water Tank", value: `${c.tank1_buffer_days} days`, notes: "Raw water storage" },
    { label: "Filtered Water Tank", value: `${c.tank2_buffer_days} days`, notes: "Filtered water buffer" },
    { label: "CO\u2082 Tank", value: `${c.co2_tank_buffer_days} days`, notes: "Liquid CO\u2082 storage" },
    { label: "Nutrient Hoppers", value: `${c.hopper_buffer_days} days`, notes: "Dry storage" },
    { label: "Filtrate Tank", value: `${c.filtrate_tank_buffer_days} days`, notes: "Harvesting filtrate" },
  ];

  const construction: Row[] = [
    { label: "Max Ponds/Batch", value: `${c.max_ponds_per_batch}`, notes: "Per construction batch" },
    { label: "Build Time", value: `${c.pond_build_weeks} wk`, notes: "Per pond" },
    { label: "Batch Test Time", value: `${c.batch_test_weeks} wks`, notes: "Test run after build" },
  ];

  const land: Row[] = [
    { label: "Land Price", value: `$${c.land_price_per_acre.toLocaleString()}/acre`, notes: "Selected location" },
    { label: "Land Buffer", value: `${(c.land_buffer_fraction * 100).toFixed(0)}%`, notes: "Extra beyond pond footprint" },
  ];

  const inoculum: Row[] = [
    { label: "Target Duration", value: `${c.inoculation_target_months} months`, notes: "Time to inoculate all ponds" },
    ...c.inoculum_tiers.map((t) => ({
      label: t.name,
      value: `${(t.size_fraction * 100).toFixed(1)}% \u00D7 ${t.cycle_days}d`,
      notes: "Size fraction \u00D7 cycle",
    })),
  ];

  return (
    <div className="space-y-5">
      <CategoryTable title="System Inputs" rows={systemInputs} />
      {/* Growth Inputs removed — now controlled by top-level sliders */}
      <CategoryTable title="Unit Costs" rows={unitCosts} />
      <CategoryTable title="Algae Composition" rows={algaeComposition} />
      <CategoryTable title="Financial Inputs" rows={financialInputs} />
      <CategoryTable title="Overhead Costs" rows={overheadCosts} />
      <CategoryTable title="Process Parameters" rows={processParams} />
      <CategoryTable title="Uptake Efficiencies" rows={uptakeEfficiencies} />
      <CategoryTable title="Diesel Drivetrain" rows={dieselDrivetrain} />
      <CategoryTable title="Maintenance Rates" rows={maintenanceRates} />
      <CategoryTable title="Buffer Days" rows={bufferDays} />
      <CategoryTable title="Construction" rows={construction} />
      <CategoryTable title="Land" rows={land} />
      <CategoryTable title="Inoculum" rows={inoculum} />
    </div>
  );
}
