export interface Parameter {
  symbol: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  step: number;
}

export interface PHEquation {
  id: string;
  name: string;
  latexNormalized: string;
  latexFull: string;
  description: string;
  parameters: Parameter[];
  piecewise: boolean;
}

export const pHEquations: PHEquation[] = [
  {
    id: "gaussian-symmetric",
    name: "Gaussian Symmetric",
    latexNormalized: String.raw`f_{pH} = e^{-\alpha \cdot (pH - pH_{opt})^2}`,
    latexFull: String.raw`\mu = \mu_{max} \cdot e^{-\alpha \cdot (pH - pH_{opt})^2}`,
    description:
      "Symmetric bell curve centered at pH_opt. Growth declines equally on both sides of the optimum. Parameter α controls curve width — larger values produce a narrower peak. Never formally reaches zero at the extremes.",
    piecewise: false,
    parameters: [
      {
        symbol: "pH_{opt}",
        label: "Optimal pH",
        unit: "-",
        min: 6,
        max: 9,
        default: 7.5,
        step: 0.1,
      },
      {
        symbol: "\\alpha",
        label: "Shape Parameter",
        unit: "-",
        min: 0.05,
        max: 3,
        default: 0.5,
        step: 0.05,
      },
    ],
  },
  {
    id: "gaussian-asymmetric",
    name: "Gaussian Asymmetric",
    latexNormalized: String.raw`pH < pH_{opt}:\quad f_{pH} = e^{-\alpha \cdot (pH - pH_{opt})^2} \\[8pt] pH \geq pH_{opt}:\quad f_{pH} = e^{-\beta \cdot (pH - pH_{opt})^2}`,
    latexFull: String.raw`f_{pH} = \begin{cases} e^{-\alpha \cdot (pH - pH_{opt})^2} & pH < pH_{opt} \\[8pt] e^{-\beta \cdot (pH - pH_{opt})^2} & pH \geq pH_{opt} \end{cases}`,
    description:
      "Two-sided Gaussian with independent width parameters on each side of pH_opt. Acidic side uses α, alkaline side uses β. Peaks exactly at 1 at pH_opt. Allows asymmetric tolerance ranges — common since many organisms are more sensitive to low pH than high pH, or vice versa.",
    piecewise: true,
    parameters: [
      {
        symbol: "pH_{opt}",
        label: "Optimal pH",
        unit: "-",
        min: 6,
        max: 9,
        default: 7.5,
        step: 0.1,
      },
      {
        symbol: "\\alpha",
        label: "Acidic Shape",
        unit: "-",
        min: 0.05,
        max: 3,
        default: 0.8,
        step: 0.05,
      },
      {
        symbol: "\\beta",
        label: "Alkaline Shape",
        unit: "-",
        min: 0.05,
        max: 3,
        default: 0.2,
        step: 0.05,
      },
    ],
  },
  {
    id: "cardinal",
    name: "Cardinal pH Model",
    latexNormalized: String.raw`f_{pH} = \frac{(pH - pH_{min})(pH - pH_{max})}{(pH_{opt} - pH_{min})(pH_{opt} - pH_{max})}`,
    latexFull: String.raw`f_{pH} = \begin{cases} \dfrac{(pH - pH_{min})(pH - pH_{max})}{(pH_{opt} - pH_{min})(pH_{opt} - pH_{max})} & pH_{min} \leq pH \leq pH_{max} \\[8pt] 0 & \text{otherwise} \end{cases}`,
    description:
      "Piecewise polynomial (Rosso et al. 1993) bounded by three cardinal points: pH_min and pH_max where growth is zero, and pH_opt where growth peaks. Hard zeros outside the cardinal range. Provides a mechanistic, biologically interpretable fit to measured growth–pH profiles.",
    piecewise: true,
    parameters: [
      {
        symbol: "pH_{min}",
        label: "Minimum pH",
        unit: "-",
        min: 3,
        max: 5,
        default: 4,
        step: 0.1,
      },
      {
        symbol: "pH_{opt}",
        label: "Optimal pH",
        unit: "-",
        min: 6,
        max: 9,
        default: 8,
        step: 0.1,
      },
      {
        symbol: "pH_{max}",
        label: "Maximum pH",
        unit: "-",
        min: 10,
        max: 12,
        default: 11,
        step: 0.1,
      },
    ],
  },
];
