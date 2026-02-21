export interface Parameter {
  symbol: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  step: number;
}

export interface TemperatureEquation {
  id: string;
  name: string;
  latexNormalized: string;
  latexFull: string;
  description: string;
  parameters: Parameter[];
  piecewise: boolean;
}

export const temperatureEquations: TemperatureEquation[] = [
  {
    id: "gaussian-symmetric",
    name: "Gaussian Symmetric",
    latexNormalized: String.raw`\mu_T = e^{-\alpha \cdot (T - T_{opt})^2}`,
    latexFull: String.raw`\mu = \mu_{max} \cdot e^{-\alpha \cdot (T - T_{opt})^2}`,
    description:
      "Symmetric bell curve centered at Topt. Growth declines equally on both sides of the optimum. Parameter \u03B1 controls curve width \u2014 larger values produce a narrower peak. Never formally reaches zero at the extremes.",
    piecewise: false,
    parameters: [
      {
        symbol: "T_{opt}",
        label: "Optimal Temperature",
        unit: "\u00B0C",
        min: 15,
        max: 40,
        default: 30,
        step: 0.5,
      },
      {
        symbol: "\\alpha",
        label: "Shape Parameter",
        unit: "-",
        min: 0.005,
        max: 0.01,
        default: 0.008,
        step: 0.0005,
      },
    ],
  },
  {
    id: "gaussian-asymmetric",
    name: "Gaussian Asymmetric",
    latexNormalized: String.raw`T < T_{opt}:\quad \mu_T = e^{-\alpha \cdot (T - T_{opt})^2} \\[8pt] T \geq T_{opt}:\quad \mu_T = e^{-\beta \cdot (T - T_{opt})^2}`,
    latexFull: String.raw`\mu_T = \begin{cases} e^{-\alpha \cdot (T - T_{opt})^2} & T < T_{opt} \\[8pt] e^{-\beta \cdot (T - T_{opt})^2} & T \geq T_{opt} \end{cases}`,
    description:
      "Two-sided Gaussian with independent width parameters on each side of Topt. Sub-optimal side uses \u03B1, super-optimal side uses \u03B2. Peaks exactly at 1 at Topt.",
    piecewise: true,
    parameters: [
      {
        symbol: "T_{opt}",
        label: "Optimal Temperature",
        unit: "\u00B0C",
        min: 20,
        max: 40,
        default: 30,
        step: 0.5,
      },
      {
        symbol: "\\alpha",
        label: "Sub-optimal Shape",
        unit: "-",
        min: 0.005,
        max: 0.05,
        default: 0.008,
        step: 0.0005,
      },
      {
        symbol: "\\beta",
        label: "Super-optimal Shape",
        unit: "-",
        min: 0.005,
        max: 0.05,
        default: 0.02,
        step: 0.0005,
      },
    ],
  },
  {
    id: "quadratic-exponential",
    name: "Quadratic Exponential",
    latexNormalized: String.raw`T < T_{opt}:\quad \mu_T = e^{-\left(\frac{T - T_{opt}}{T_{opt} - T_{min}}\right)^2 \cdot \alpha} \\[8pt] T \geq T_{opt}:\quad \mu_T = e^{-\left(\frac{T - T_{opt}}{T_{max} - T_{opt}}\right)^2 \cdot \beta}`,
    latexFull: String.raw`\mu_T = \begin{cases} e^{-\left(\dfrac{T - T_{opt}}{T_{opt} - T_{min}}\right)^2 \cdot \alpha} & T < T_{opt} \\[8pt] e^{-\left(\dfrac{T - T_{opt}}{T_{max} - T_{opt}}\right)^2 \cdot \beta} & T \geq T_{opt} \end{cases}`,
    description:
      "Piecewise exponential with quadratic terms normalized by the distance from Topt to each cardinal point. Smooth at Topt, soft-bounded near Tmin and Tmax. Parameters \u03B1 and \u03B2 independently control curvature on each side.",
    piecewise: true,
    parameters: [
      {
        symbol: "T_{opt}",
        label: "Optimal Temperature",
        unit: "\u00B0C",
        min: 20,
        max: 40,
        default: 30,
        step: 0.5,
      },
      {
        symbol: "T_{min}",
        label: "Minimum Temperature",
        unit: "\u00B0C",
        min: 5,
        max: 15,
        default: 10,
        step: 0.5,
      },
      {
        symbol: "T_{max}",
        label: "Maximum Temperature",
        unit: "\u00B0C",
        min: 45,
        max: 55,
        default: 50,
        step: 0.5,
      },
      {
        symbol: "\\alpha",
        label: "Sub-optimal Shape",
        unit: "-",
        min: 2,
        max: 10,
        default: 4,
        step: 0.1,
      },
      {
        symbol: "\\beta",
        label: "Super-optimal Shape",
        unit: "-",
        min: 3,
        max: 10,
        default: 5,
        step: 0.1,
      },
    ],
  },
  {
    id: "beta-function",
    name: "Beta Function",
    latexNormalized: String.raw`T < T_{opt}:\quad \mu_T = \left(\frac{T - T_{min}}{T_{opt} - T_{min}}\right)^{\alpha} \cdot e^{-\alpha\left(\frac{T - T_{min}}{T_{opt} - T_{min}} - 1\right)} \\[8pt] T \geq T_{opt}:\quad \mu_T = \left(\frac{T_{max} - T}{T_{max} - T_{opt}}\right)^{\beta} \cdot e^{-\beta\left(\frac{T_{max} - T}{T_{max} - T_{opt}} - 1\right)}`,
    latexFull: String.raw`\mu_T = \begin{cases} \left(\dfrac{T - T_{min}}{T_{opt} - T_{min}}\right)^{\alpha} \cdot e^{-\alpha\left(\dfrac{T - T_{min}}{T_{opt} - T_{min}} - 1\right)} & T < T_{opt} \\[8pt] \left(\dfrac{T_{max} - T}{T_{max} - T_{opt}}\right)^{\beta} \cdot e^{-\beta\left(\dfrac{T_{max} - T}{T_{max} - T_{opt}} - 1\right)} & T \geq T_{opt} \end{cases}`,
    description:
      "Piecewise model with Steele-exponential correction on each side. Hard-bounded \u2014 returns exactly 0 at Tmin and Tmax, exactly 1 at Topt. Parameters \u03B1 and \u03B2 independently control curvature on the sub-optimal and super-optimal sides respectively.",
    piecewise: true,
    parameters: [
      {
        symbol: "T_{opt}",
        label: "Optimal Temperature",
        unit: "\u00B0C",
        min: 20,
        max: 40,
        default: 30,
        step: 0.5,
      },
      {
        symbol: "T_{min}",
        label: "Minimum Temperature",
        unit: "\u00B0C",
        min: 5,
        max: 15,
        default: 10,
        step: 0.5,
      },
      {
        symbol: "T_{max}",
        label: "Maximum Temperature",
        unit: "\u00B0C",
        min: 45,
        max: 55,
        default: 50,
        step: 0.5,
      },
      {
        symbol: "\\alpha",
        label: "Sub-optimal Shape",
        unit: "-",
        min: 1,
        max: 10,
        default: 1,
        step: 0.1,
      },
      {
        symbol: "\\beta",
        label: "Super-optimal Shape",
        unit: "-",
        min: 1,
        max: 10,
        default: 2,
        step: 0.1,
      },
    ],
  },
];
