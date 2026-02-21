export interface Parameter {
  symbol: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  step: number;
}

export interface LightEquation {
  id: string;
  name: string;
  latexNormalized: string;
  latexFull: string;
  description: string;
  parameters: Parameter[];
  piecewise: boolean;
}

export const lightEquations: LightEquation[] = [
  {
    id: "monod",
    name: "Monod",
    latexNormalized: String.raw`f_L = \frac{I}{K_s + I}`,
    latexFull: String.raw`\mu = \mu_{max} \cdot \frac{I}{K_s + I}`,
    description:
      "Simple hyperbolic saturation. Growth increases monotonically with light intensity and asymptotes toward maximum. No photoinhibition at high intensities. The simplest possible light response model.",
    piecewise: false,
    parameters: [
      {
        symbol: "K_s",
        label: "Half-Saturation Constant",
        unit: "µE/m²/s",
        min: 5,
        max: 200,
        default: 20,
        step: 1,
      },
    ],
  },
  {
    id: "haldane",
    name: "Haldane",
    latexNormalized: String.raw`f_L = \frac{I}{K_s + I + \frac{I^2}{K_i}}`,
    latexFull: String.raw`\mu = \mu_{max} \cdot \frac{I}{K_s + I + \frac{I^2}{K_i}}`,
    description:
      "Hyperbolic saturation with an added quadratic inhibition term in the denominator. Growth rises to a peak then declines at high intensities. The ratio Ks/Ki controls the sharpness of the optimum.",
    piecewise: false,
    parameters: [
      {
        symbol: "K_s",
        label: "Half-Saturation Constant",
        unit: "µE/m²/s",
        min: 10,
        max: 100,
        default: 50,
        step: 1,
      },
      {
        symbol: "K_i",
        label: "Inhibition Constant",
        unit: "µE/m²/s",
        min: 300,
        max: 2000,
        default: 1000,
        step: 10,
      },
    ],
  },
  {
    id: "webb",
    name: "Webb",
    latexNormalized: String.raw`f_L = 1 - e^{-\alpha \cdot I / I_{opt}}`,
    latexFull: String.raw`\mu = \mu_{max} \cdot \left(1 - e^{-\alpha \cdot I / I_{opt}}\right)`,
    description:
      "Exponential saturation form that rises from zero and approaches a maximum asymptotically. The alpha parameter controls how steeply the curve rises. No inhibition at high intensities.",
    piecewise: false,
    parameters: [
      {
        symbol: "I_{opt}",
        label: "Optimal Intensity",
        unit: "µE/m²/s",
        min: 10,
        max: 200,
        default: 100,
        step: 1,
      },
      {
        symbol: "\\alpha",
        label: "Shape Parameter",
        unit: "-",
        min: 1,
        max: 10,
        default: 2,
        step: 0.1,
      },
    ],
  },
  {
    id: "steele",
    name: "Steele",
    latexNormalized: String.raw`f_L = \frac{I}{I_{opt}} \cdot e^{1 - \frac{I}{I_{opt}}}`,
    latexFull: String.raw`\mu = \mu_{max} \cdot \frac{I}{I_{opt}} \cdot e^{1 - \frac{I}{I_{opt}}}`,
    description:
      "Exponential form with a single optimal intensity. Rises to a peak at Iopt then declines symmetrically at higher intensities. The curve shape is fully determined by Iopt alone.",
    piecewise: false,
    parameters: [
      {
        symbol: "I_{opt}",
        label: "Optimal Intensity",
        unit: "µE/m²/s",
        min: 100,
        max: 500,
        default: 200,
        step: 1,
      },
    ],
  },
  {
    id: "beta-function",
    name: "Beta Function",
    latexNormalized: String.raw`I < I_{opt}:\quad f_L = \left(\frac{I - I_{min}}{I_{opt} - I_{min}}\right)^{\alpha} \cdot e^{-\alpha\left(\frac{I - I_{min}}{I_{opt} - I_{min}} - 1\right)} \\[8pt] I \geq I_{opt}:\quad f_L = \left(\frac{I_{max} - I}{I_{max} - I_{opt}}\right)^{\beta} \cdot e^{-\beta\left(\frac{I_{max} - I}{I_{max} - I_{opt}} - 1\right)}`,
    latexFull: String.raw`f_L = \begin{cases} \left(\dfrac{I - I_{min}}{I_{opt} - I_{min}}\right)^{\alpha} \cdot e^{-\alpha\left(\dfrac{I - I_{min}}{I_{opt} - I_{min}} - 1\right)} & I < I_{opt} \\[8pt] \left(\dfrac{I_{max} - I}{I_{max} - I_{opt}}\right)^{\beta} \cdot e^{-\beta\left(\dfrac{I_{max} - I}{I_{max} - I_{opt}} - 1\right)} & I \geq I_{opt} \end{cases}`,
    description:
      "Piecewise model with independent shape control on the sub-optimal and super-optimal sides. Hard-bounded by Imin and Imax where growth is exactly zero. The \u03B1 and \u03B2 exponents independently control curvature on each side.",
    piecewise: true,
    parameters: [
      {
        symbol: "I_{opt}",
        label: "Optimal Intensity",
        unit: "µE/m²/s",
        min: 100,
        max: 500,
        default: 200,
        step: 1,
      },
      {
        symbol: "I_{min}",
        label: "Minimum Intensity",
        unit: "µE/m²/s",
        min: 1,
        max: 10,
        default: 1,
        step: 0.5,
      },
      {
        symbol: "I_{max}",
        label: "Maximum Intensity",
        unit: "µE/m²/s",
        min: 1000,
        max: 2000,
        default: 1500,
        step: 10,
      },
      {
        symbol: "\\alpha",
        label: "Sub-optimal Shape",
        unit: "-",
        min: 0.3,
        max: 3,
        default: 1,
        step: 0.1,
      },
      {
        symbol: "\\beta",
        label: "Super-optimal Shape",
        unit: "-",
        min: 1,
        max: 10,
        default: 5,
        step: 0.1,
      },
    ],
  },
];
