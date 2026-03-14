import type { AirNowObservation } from "../../types/airnow.js";

const AQI_DESCRIPTIONS: Record<number, string> = {
  1: "Good (0-50): Air quality is satisfactory; little or no risk.",
  2: "Moderate (51-100): Acceptable; some pollutants may be a concern for a small number of sensitive people.",
  3: "Unhealthy for Sensitive Groups (101-150): Members of sensitive groups may experience health effects.",
  4: "Unhealthy (151-200): Everyone may begin to experience health effects.",
  5: "Very Unhealthy (201-300): Health alert; everyone may experience more serious health effects.",
  6: "Hazardous (301+): Health warnings of emergency conditions.",
};

export function formatAirQualityForPrompt(observations: AirNowObservation[]): string {
  if (observations.length === 0) {
    return "No current air quality observations found near this location. This may mean no AirNow monitoring stations are within range, or the area has no active reporting.";
  }

  const parts: string[] = [
    `Current air quality observations near this location (${observations.length} reading${observations.length !== 1 ? "s" : ""}):`,
  ];

  // Group by reporting area
  const byArea = new Map<string, AirNowObservation[]>();
  for (const o of observations) {
    const area = `${o.reportingArea}, ${o.stateCode}`;
    if (!byArea.has(area)) byArea.set(area, []);
    byArea.get(area)!.push(o);
  }

  for (const [area, readings] of byArea) {
    parts.push(`\n${area}:`);
    for (const r of readings) {
      const desc = AQI_DESCRIPTIONS[r.category.number] ?? r.category.name;
      parts.push(`  - ${r.parameterName}: AQI ${r.aqi} — ${desc} (as of ${r.dateTime})`);
    }
  }

  const maxAqi = Math.max(...observations.map((o) => o.aqi));
  const worstObs = observations.find((o) => o.aqi === maxAqi);
  if (worstObs && worstObs.category.number >= 3) {
    parts.push(`\nHighest AQI reading: ${worstObs.parameterName} at ${maxAqi} (${worstObs.category.name}) in ${worstObs.reportingArea}, ${worstObs.stateCode}`);
  }

  return parts.join("\n");
}
