import { PARAMETER_CODES } from "./config.js";
import type { WaterReading } from "../../types/usgs-water.js";

type ParameterThreshold = {
  range: [number, number];
  unit: string;
  belowNote: string;
  aboveNote: string;
  source: string;
};

const PARAMETER_THRESHOLDS: Record<string, ParameterThreshold> = {
  "00010": {
    range: [0, 32],
    unit: "°C",
    belowNote: "Below freezing — ice formation possible",
    aboveNote: "Above 32°C is stressful for most freshwater species; above 25°C reduces dissolved oxygen capacity",
    source: "EPA freshwater temperature guidance",
  },
  "00300": {
    range: [5, 14],
    unit: "mg/L",
    belowNote: "Below 5 mg/L is stressful for most aquatic life; below 2 mg/L can cause fish kills",
    aboveNote: "Supersaturation above ~14 mg/L may indicate algal bloom or measurement artifact",
    source: "EPA aquatic life criterion (freshwater)",
  },
  "00400": {
    range: [6.5, 9.0],
    unit: "standard units",
    belowNote: "Below 6.5 is acidic — harmful to many aquatic organisms",
    aboveNote: "Above 9.0 is alkaline — can be toxic to aquatic life",
    source: "EPA freshwater pH criterion",
  },
};

function assessParameter(code: string, _avg: number, min: number, max: number): string | null {
  const threshold = PARAMETER_THRESHOLDS[code];
  if (!threshold) return null;

  const [lo, hi] = threshold.range;
  const notes: string[] = [];

  if (min < lo) {
    notes.push(threshold.belowNote);
  }
  if (max > hi) {
    notes.push(threshold.aboveNote);
  }

  if (notes.length === 0) {
    return `Within EPA reference range (${lo}–${hi} ${threshold.unit}). ${threshold.source}.`;
  }

  return `EPA reference range: ${lo}–${hi} ${threshold.unit}. ${notes.join(". ")}. ${threshold.source}.`;
}

export function formatWaterDataForPrompt(
  readings: WaterReading[],
  period: string,
): string {
  if (readings.length === 0) return "";

  const grouped = new Map<string, WaterReading[]>();
  for (const reading of readings) {
    const key = reading.parameterCode;
    const existing = grouped.get(key) ?? [];
    existing.push(reading);
    grouped.set(key, existing);
  }

  const sections: string[] = [];
  for (const [code, paramReadings] of grouped) {
    const name =
      PARAMETER_CODES[code as keyof typeof PARAMETER_CODES] ?? code;
    const sorted = paramReadings.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
    );
    const latest = sorted[0];
    const values = sorted.map((r) => r.value).filter((v) => !isNaN(v));

    if (values.length === 0) continue;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

    let line = `- ${name} (${code}): latest ${latest.value} ${latest.unit} at ${latest.time} | range ${min.toFixed(2)}–${max.toFixed(2)} | avg ${avg.toFixed(2)} | ${values.length} readings`;

    const assessment = assessParameter(code, avg, min, max);
    if (assessment) {
      line += `\n  Assessment: ${assessment}`;
    }

    sections.push(line);
  }

  return `Water conditions data from the past ${period} (${readings.length} total readings). NOTE: Readings are from USGS monitoring stations and reflect conditions at the sensor location. Streamflow and gage height have no universal "good/bad" threshold — they vary by waterway, season, and historical norms for that station.\n${sections.join("\n")}`;
}
