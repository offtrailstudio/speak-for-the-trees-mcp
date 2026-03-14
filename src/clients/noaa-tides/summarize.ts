import type { TideReading, TidePrediction } from "../../types/noaa-tides.js";

export type TidalData = {
  observations: TideReading[];
  predictions: TidePrediction[];
  station: string;
};

export function formatTidalDataForPrompt(
  data: TidalData,
  period: string,
): string {
  const parts: string[] = [];

  if (data.observations.length > 0) {
    const values = data.observations
      .map((o) => o.value)
      .filter((v) => !isNaN(v));

    if (values.length > 0) {
      const sorted = [...data.observations]
        .filter((o) => !isNaN(o.value))
        .sort(
          (a, b) =>
            new Date(b.time).getTime() - new Date(a.time).getTime(),
        );

      const latest = sorted[0];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;

      parts.push(
        `Tidal water levels from the past ${period} (${values.length} observations, MLLW datum, meters):`,
      );
      parts.push(
        `- Latest: ${latest.value.toFixed(3)} m at ${latest.time}`,
      );
      parts.push(
        `- Range: ${min.toFixed(3)} m to ${max.toFixed(3)} m (${range.toFixed(3)} m tidal range)`,
      );
    }
  }

  if (data.predictions.length > 0) {
    const predValues = data.predictions
      .map((p) => p.value)
      .filter((v) => !isNaN(v));

    if (predValues.length > 0) {
      const highTide = data.predictions.reduce((max, p) =>
        p.value > max.value ? p : max,
      );
      const lowTide = data.predictions.reduce((min, p) =>
        p.value < min.value ? p : min,
      );

      parts.push(
        `Tide predictions for the same period (${predValues.length} predictions):`,
      );
      parts.push(
        `- Next high tide peak: ${highTide.value.toFixed(3)} m at ${highTide.time}`,
      );
      parts.push(
        `- Next low tide trough: ${lowTide.value.toFixed(3)} m at ${lowTide.time}`,
      );
    }

    if (data.observations.length > 0) {
      const latestObs = [...data.observations]
        .filter((o) => !isNaN(o.value))
        .sort(
          (a, b) =>
            new Date(b.time).getTime() - new Date(a.time).getTime(),
        )[0];

      if (latestObs) {
        const latestObsTime = new Date(latestObs.time).getTime();
        const nearest = data.predictions.reduce((closest, p) => {
          const diff = Math.abs(
            new Date(p.time).getTime() - latestObsTime,
          );
          const closestDiff = Math.abs(
            new Date(closest.time).getTime() - latestObsTime,
          );
          return diff < closestDiff ? p : closest;
        });

        const deviation = latestObs.value - nearest.value;
        const direction = deviation >= 0 ? "above" : "below";
        parts.push(
          `- Current deviation from predicted level: ${Math.abs(deviation).toFixed(3)} m ${direction} predicted`,
        );
      }
    }
  }

  if (parts.length === 0) return "";
  return parts.join("\n");
}
