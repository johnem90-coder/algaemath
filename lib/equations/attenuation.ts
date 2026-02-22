export interface Parameter {
  symbol: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  step: number;
}

export interface AttenuationEquation {
  id: string;
  name: string;
  latexNormalized: string;
  latexFull: string;
  description: string;
  parameters: Parameter[];
  piecewise: boolean;
}

export const attenuationEquations: AttenuationEquation[] = [
  {
    id: "beer-lambert",
    name: "Beer–Lambert",
    latexNormalized: String.raw`\frac{I(z)}{I_0} = e^{-\varepsilon \cdot X \cdot z}`,
    latexFull: String.raw`I(z) = I_0 \cdot e^{-\varepsilon \cdot X \cdot z}`,
    description:
      "Exponential decay of light with depth through a cell suspension. The specific absorption coefficient ε characterises how strongly the biomass absorbs light per unit mass, while X is the culture density. Together ε·X gives the total volumetric extinction coefficient. Higher biomass or stronger pigmentation causes rapid attenuation — a critical design constraint for dense photobioreactor cultures.",
    piecewise: false,
    parameters: [
      {
        symbol: "\\varepsilon",
        label: "Specific Absorption Coefficient",
        unit: "m²/kg",
        min: 100,
        max: 500,
        default: 150,
        step: 10,
      },
      {
        symbol: "X",
        label: "Biomass Density",
        unit: "g/L",
        min: 0.1,
        max: 10,
        default: 2,
        step: 0.1,
      },
    ],
  },
  {
    id: "two-component",
    name: "Two-Component Attenuation",
    latexNormalized: String.raw`\frac{I(z)}{I_0} = e^{-(K_w + \varepsilon \cdot X)\, z}`,
    latexFull: String.raw`I(z) = I_0 \cdot e^{-(K_w + \varepsilon \cdot X)\, z}`,
    description:
      "Extends Beer–Lambert by splitting the extinction coefficient into two additive terms: background medium attenuation Kw (water, dissolved salts, and coloured compounds) and the biomass-dependent term ε·X. At low cell densities, Kw may dominate; at high densities the biomass term dominates. Useful for quantifying the contribution of each component to total light attenuation.",
    piecewise: false,
    parameters: [
      {
        symbol: "K_w",
        label: "Background Attenuation",
        unit: "m⁻¹",
        min: 1,
        max: 50,
        default: 10,
        step: 1,
      },
      {
        symbol: "\\varepsilon",
        label: "Specific Absorption Coefficient",
        unit: "m²/kg",
        min: 100,
        max: 500,
        default: 150,
        step: 10,
      },
      {
        symbol: "X",
        label: "Biomass Density",
        unit: "g/L",
        min: 0.1,
        max: 10,
        default: 2,
        step: 0.1,
      },
    ],
  },
];
