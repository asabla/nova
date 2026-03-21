import { useState, useMemo, useCallback } from "react";
import { ArrowLeftRight } from "lucide-react";
import clsx from "clsx";

type Category = "length" | "weight" | "temperature" | "volume" | "speed";

const UNIT_FACTORS: Record<string, Record<string, number>> = {
  length: { m: 1, km: 1000, mi: 1609.344, ft: 0.3048, in: 0.0254, cm: 0.01, mm: 0.001, yd: 0.9144 },
  weight: { kg: 1, g: 0.001, lb: 0.453592, oz: 0.0283495, mg: 0.000001, ton: 1000 },
  volume: { L: 1, mL: 0.001, gal: 3.78541, cup: 0.236588, fl_oz: 0.0295735, tbsp: 0.0147868 },
  speed: { m_s: 1, km_h: 0.277778, mph: 0.44704, knots: 0.514444, ft_s: 0.3048 },
};

const UNIT_LABELS: Record<string, string> = {
  m: "Meters", km: "Kilometers", mi: "Miles", ft: "Feet", in: "Inches", cm: "Centimeters", mm: "Millimeters", yd: "Yards",
  kg: "Kilograms", g: "Grams", lb: "Pounds", oz: "Ounces", mg: "Milligrams", ton: "Metric tons",
  C: "Celsius", F: "Fahrenheit", K: "Kelvin",
  L: "Liters", mL: "Milliliters", gal: "Gallons", cup: "Cups", fl_oz: "Fluid oz", tbsp: "Tablespoons",
  m_s: "m/s", km_h: "km/h", mph: "mph", knots: "Knots", ft_s: "ft/s",
};

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "length", label: "Length" },
  { value: "weight", label: "Weight" },
  { value: "temperature", label: "Temperature" },
  { value: "volume", label: "Volume" },
  { value: "speed", label: "Speed" },
];

function getUnitsForCategory(category: Category): string[] {
  if (category === "temperature") return ["C", "F", "K"];
  return Object.keys(UNIT_FACTORS[category] ?? {});
}

function convert(category: Category, from: string, to: string, value: number): number {
  if (category === "temperature") {
    let celsius: number;
    if (from === "C") celsius = value;
    else if (from === "F") celsius = (value - 32) * (5 / 9);
    else celsius = value - 273.15;

    if (to === "C") return celsius;
    if (to === "F") return celsius * (9 / 5) + 32;
    return celsius + 273.15;
  }

  const factors = UNIT_FACTORS[category];
  if (!factors || !factors[from] || !factors[to]) return NaN;
  const base = value * factors[from];
  return base / factors[to];
}

export function UnitConverterWidget({ params }: { params?: Record<string, string> }) {
  const initialCategory = (params?.category as Category) ?? "length";
  const [category, setCategory] = useState<Category>(initialCategory);

  const units = useMemo(() => getUnitsForCategory(category), [category]);

  const [fromUnit, setFromUnit] = useState(() => params?.from ?? units[0]);
  const [toUnit, setToUnit] = useState(() => params?.to ?? units[1]);
  const [leftValue, setLeftValue] = useState(() => params?.value ?? "1");
  const [rightValue, setRightValue] = useState(() => {
    const v = parseFloat(params?.value ?? "1");
    const f = params?.from ?? units[0];
    const t = params?.to ?? units[1];
    const result = convert(initialCategory, f, t, isNaN(v) ? 1 : v);
    return isNaN(result) ? "" : formatResult(result);
  });
  const [activeField, setActiveField] = useState<"left" | "right">("left");

  const handleCategoryChange = useCallback((newCategory: Category) => {
    setCategory(newCategory);
    const newUnits = getUnitsForCategory(newCategory);
    setFromUnit(newUnits[0]);
    setToUnit(newUnits[1]);
    setLeftValue("1");
    const result = convert(newCategory, newUnits[0], newUnits[1], 1);
    setRightValue(isNaN(result) ? "" : formatResult(result));
    setActiveField("left");
  }, []);

  const handleLeftChange = useCallback(
    (val: string) => {
      setLeftValue(val);
      setActiveField("left");
      const num = parseFloat(val);
      if (val === "" || isNaN(num)) {
        setRightValue("");
        return;
      }
      const result = convert(category, fromUnit, toUnit, num);
      setRightValue(isNaN(result) ? "" : formatResult(result));
    },
    [category, fromUnit, toUnit],
  );

  const handleRightChange = useCallback(
    (val: string) => {
      setRightValue(val);
      setActiveField("right");
      const num = parseFloat(val);
      if (val === "" || isNaN(num)) {
        setLeftValue("");
        return;
      }
      const result = convert(category, toUnit, fromUnit, num);
      setLeftValue(isNaN(result) ? "" : formatResult(result));
    },
    [category, fromUnit, toUnit],
  );

  const handleFromUnitChange = useCallback(
    (unit: string) => {
      setFromUnit(unit);
      if (activeField === "left") {
        const num = parseFloat(leftValue);
        if (!isNaN(num)) {
          const result = convert(category, unit, toUnit, num);
          setRightValue(isNaN(result) ? "" : formatResult(result));
        }
      } else {
        const num = parseFloat(rightValue);
        if (!isNaN(num)) {
          const result = convert(category, toUnit, unit, num);
          setLeftValue(isNaN(result) ? "" : formatResult(result));
        }
      }
    },
    [category, toUnit, leftValue, rightValue, activeField],
  );

  const handleToUnitChange = useCallback(
    (unit: string) => {
      setToUnit(unit);
      if (activeField === "left") {
        const num = parseFloat(leftValue);
        if (!isNaN(num)) {
          const result = convert(category, fromUnit, unit, num);
          setRightValue(isNaN(result) ? "" : formatResult(result));
        }
      } else {
        const num = parseFloat(rightValue);
        if (!isNaN(num)) {
          const result = convert(category, unit, fromUnit, num);
          setLeftValue(isNaN(result) ? "" : formatResult(result));
        }
      }
    },
    [category, fromUnit, leftValue, rightValue, activeField],
  );

  return (
    <div className="px-4 py-3">
      {!params?.category && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => handleCategoryChange(cat.value)}
              className={clsx(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                category === cat.value
                  ? "bg-primary/10 text-primary"
                  : "bg-surface-tertiary text-text-secondary hover:text-text",
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 space-y-1.5">
          <select
            value={fromUnit}
            onChange={(e) => handleFromUnitChange(e.target.value)}
            className="w-full px-2 py-1 rounded-lg bg-surface-tertiary border border-border text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u] ?? u}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={leftValue}
            onChange={(e) => handleLeftChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm text-text font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="0"
          />
        </div>

        <ArrowLeftRight className="h-4 w-4 text-text-tertiary shrink-0 mt-5" />

        <div className="flex-1 space-y-1.5">
          <select
            value={toUnit}
            onChange={(e) => handleToUnitChange(e.target.value)}
            className="w-full px-2 py-1 rounded-lg bg-surface-tertiary border border-border text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u] ?? u}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={rightValue}
            onChange={(e) => handleRightChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border text-sm text-text font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="0"
          />
        </div>
      </div>
    </div>
  );
}

function formatResult(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const s = n.toPrecision(10);
  return parseFloat(s).toString();
}
