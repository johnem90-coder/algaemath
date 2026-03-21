// Dynamic labor computation — headcounts scale with facility size
//
// Biomass & Harvesting: base staff at 10 ponds, +1 operator per 10 ponds,
//   +1 maintenance supervisor at 40 and 80 ponds
// Inputs, Inoculum, Drying: no labor at 10 ponds, roles added at 20/30/40/50 thresholds
// Land: minimum 1 grounds keeper, +1 per 20 acres

import type { LaborRole } from "../types";

// ── Salary schedule ──────────────────────────────────────────────

const SAL = {
  ops_manager: 219000,
  equipment_engineer: 182500,
  maintenance_supervisor: 146000,
  administrator: 73000,
  operator: 73000,
  grounds_keeper: 52000,
};

// ── Helper: build role if headcount > 0 ──────────────────────────

function role(title: string, headcount: number, salary: number): LaborRole | null {
  return headcount > 0 ? { title, headcount, annual_salary: salary } : null;
}

// ── Biomass / Harvesting scaling ─────────────────────────────────
// Base (10 ponds): 1 ops mgr, 1 engineer, 1 maint supervisor, 1 admin, 1 operator
// +1 operator per 10 ponds
// +1 maint supervisor at 40 ponds and again at 80 ponds

function computePondSectionLabor(nPonds: number, prefix: string): LaborRole[] {
  const operators = Math.max(1, Math.ceil(nPonds / 10));
  const maintSupervisors = 1 + (nPonds >= 40 ? 1 : 0) + (nPonds >= 80 ? 1 : 0);

  return [
    { title: `${prefix} Ops Manager`, headcount: 1, annual_salary: SAL.ops_manager },
    { title: `${prefix} Equipment Engineer`, headcount: 1, annual_salary: SAL.equipment_engineer },
    { title: `${prefix} Maintenance Supervisor`, headcount: maintSupervisors, annual_salary: SAL.maintenance_supervisor },
    { title: `${prefix} Administrator`, headcount: 1, annual_salary: SAL.administrator },
    { title: `${prefix} Operator`, headcount: operators, annual_salary: SAL.operator },
  ];
}

// ── Support section scaling (Inputs, Inoculum, Drying) ───────────
// 10 ponds: no labor
// 20 ponds: +1 operator
// 30 ponds: +1 ops manager
// 40 ponds: +1 equipment engineer
// 50 ponds: +1 maintenance supervisor

function computeSupportSectionLabor(nPonds: number, prefix: string): LaborRole[] {
  if (nPonds < 20) return [];

  const roles: LaborRole[] = [];
  const r = (t: string, hc: number, s: number) => { const x = role(t, hc, s); if (x) roles.push(x); };

  r(`${prefix} Operator`, 1, SAL.operator);
  if (nPonds >= 30) r(`${prefix} Ops Manager`, 1, SAL.ops_manager);
  if (nPonds >= 40) r(`${prefix} Equipment Engineer`, 1, SAL.equipment_engineer);
  if (nPonds >= 50) r(`${prefix} Maintenance Supervisor`, 1, SAL.maintenance_supervisor);

  return roles;
}

// ── Land scaling ─────────────────────────────────────────────────
// Minimum 1 grounds keeper, +1 per 20 acres

function computeLandLabor(landAcres: number): LaborRole[] {
  const headcount = Math.max(1, Math.ceil(landAcres / 20));
  return [{ title: "Grounds Keeper", headcount, annual_salary: SAL.grounds_keeper }];
}

// ── Main export ──────────────────────────────────────────────────

export function computeLabor(
  nPonds: number,
  landAcres: number
): Record<string, LaborRole[]> {
  return {
    biomass: computePondSectionLabor(nPonds, "Pond"),
    harvesting: computePondSectionLabor(nPonds, "Harvesting"),
    inputs: computeSupportSectionLabor(nPonds, "Inputs"),
    inoculum: computeSupportSectionLabor(nPonds, "Inoculum"),
    drying: computeSupportSectionLabor(nPonds, "Drying"),
    land: computeLandLabor(landAcres),
  };
}
