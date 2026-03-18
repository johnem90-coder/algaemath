"use client";

import type { TEAResult } from "@/lib/technoeconomics/open-pond";

interface Props {
  result: TEAResult;
}

interface InputRow {
  label: string;
  value: string;
  notes?: string;
}

export function InputVariablesTable({ result }: Props) {
  const c = result.config;

  const rows: InputRow[] = [
    { label: "Electricity Price", value: `$${c.electricity_per_kWh}/kWh`, notes: "Hawaii 2022 commercial" },
    { label: "Natural Gas Price", value: `$${c.natural_gas_per_cuft}/cuft`, notes: "Hawaii 2022/2023 industrial" },
    { label: "Diesel Price", value: `$${c.diesel_per_L.toFixed(2)}/L`, notes: "May 2022" },
    { label: "CO\u2082 Price", value: `$${c.co2_per_ton}/ton`, notes: "DAC-sourced estimate" },
    { label: "KNO\u2083 Price", value: `$${c.kno3_per_ton}/ton`, notes: "Volatile commodity" },
    { label: "DAP Price", value: `$${c.dap_per_ton}/ton`, notes: "Volatile commodity" },
    { label: "Micronutrient Price", value: `$${c.micronutrient_per_ton}/ton`, notes: "Estimate" },
    { label: "Water Price", value: `$${c.water_per_m3}/m\u00B3`, notes: "Municipal supply" },
    { label: "Labor Rate", value: `$${c.labor_rate_per_hr.toFixed(2)}/hr`, notes: "~$70k/yr equivalent" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-6 font-medium">Parameter</th>
            <th className="py-2 pr-6 font-medium text-right">Value</th>
            <th className="py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-dashed">
              <td className="py-1.5 pr-6 font-sans text-sm">{row.label}</td>
              <td className="py-1.5 pr-6 text-right whitespace-nowrap">
                {row.value}
              </td>
              <td className="py-1.5 font-sans text-xs text-muted-foreground">
                {row.notes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
