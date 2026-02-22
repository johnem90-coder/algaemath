export interface Parameter {
  symbol: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  step: number;
}

export interface NutrientEquation {
  id: string;
  name: string;
  latexNormalized: string;
  latexFull: string;
  description: string;
  parameters: Parameter[];
  piecewise: boolean;
}

export const nutrientEquations: NutrientEquation[] = [
  {
    id: "monod",
    name: "Monod",
    latexNormalized: String.raw`f_N = \frac{S}{K_s + S}`,
    latexFull: String.raw`\mu = \mu_{max} \cdot \frac{S}{K_s + S}`,
    description:
      "Classic hyperbolic saturation identical in form to Michaelis–Menten kinetics. Growth increases monotonically with substrate concentration and asymptotes toward maximum. The simplest and most widely used nutrient response model. The half-saturation constant Ks sets the concentration at which growth is half-maximal.",
    piecewise: false,
    parameters: [
      {
        symbol: "K_s",
        label: "Half-Saturation Constant",
        unit: "mg/L",
        min: 0.1,
        max: 10,
        default: 1,
        step: 0.1,
      },
    ],
  },
  {
    id: "haldane",
    name: "Haldane",
    latexNormalized: String.raw`f_N = \frac{S}{K_s + S + \dfrac{S^2}{K_i}}`,
    latexFull: String.raw`\mu = \mu_{max} \cdot \frac{S}{K_s + S + \dfrac{S^2}{K_i}}`,
    description:
      "Monod model extended with a substrate inhibition term in the denominator. Growth rises to a peak then declines as excess substrate becomes inhibitory. Used when ammonia, CO₂, or other nutrients suppress growth at high concentrations. The ratio Ks/Ki controls the sharpness of the optimum.",
    piecewise: false,
    parameters: [
      {
        symbol: "K_s",
        label: "Half-Saturation Constant",
        unit: "mg/L",
        min: 0.1,
        max: 5,
        default: 0.5,
        step: 0.1,
      },
      {
        symbol: "K_i",
        label: "Inhibition Constant",
        unit: "mg/L",
        min: 5,
        max: 50,
        default: 20,
        step: 0.5,
      },
    ],
  },
  {
    id: "hill",
    name: "Hill (Sigmoidal)",
    latexNormalized: String.raw`f_N = \frac{S^n}{K_s^n + S^n}`,
    latexFull: String.raw`\mu = \mu_{max} \cdot \frac{S^n}{K_s^n + S^n}`,
    description:
      "Cooperative kinetics model (Hill equation) producing a sigmoidal response. The Hill coefficient n controls sharpness: n = 1 reduces to Monod, while n > 1 produces an increasingly step-like threshold response. Used when nutrient uptake is cooperative, allosterically regulated, or when a sharp critical concentration has been observed experimentally.",
    piecewise: false,
    parameters: [
      {
        symbol: "K_s",
        label: "Half-Saturation Constant",
        unit: "mg/L",
        min: 0.1,
        max: 10,
        default: 2,
        step: 0.1,
      },
      {
        symbol: "n",
        label: "Hill Coefficient",
        unit: "-",
        min: 0.5,
        max: 4,
        default: 2,
        step: 0.1,
      },
    ],
  },
];
