import { AIRNOW_BASE_URL, AIRNOW_DEFAULTS } from "./config.js";
import { airNowResponseSchema } from "../../validations/airnow.js";
import type { AirNowObservation } from "../../types/airnow.js";

type AirNowResult =
  | { success: true; observations: AirNowObservation[] }
  | { success: false; error: string };

export function getAirNowApiKey(): string | null {
  return process.env["AIRNOW_API_KEY"] ?? null;
}

export async function fetchAirQuality(params: {
  latitude: number;
  longitude: number;
  radiusMiles?: number;
}): Promise<AirNowResult> {
  const apiKey = getAirNowApiKey();
  if (!apiKey) {
    return {
      success: false,
      error:
        "AirNow API key not configured. Set the AIRNOW_API_KEY environment variable. " +
        "Register for a free key at https://docs.airnowapi.org/",
    };
  }

  const { latitude, longitude, radiusMiles = AIRNOW_DEFAULTS.searchRadiusMiles } = params;

  const url = new URL(`${AIRNOW_BASE_URL}/observation/latLong/current/`);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("distance", String(radiusMiles));
  url.searchParams.set("format", "application/json");
  url.searchParams.set("API_KEY", apiKey);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": AIRNOW_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(AIRNOW_DEFAULTS.fetchTimeoutMs),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `AirNow API error: ${response.status} ${response.statusText}`,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `AirNow response parse error: ${message}` };
  }

  const parsed = airNowResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { success: false, error: `AirNow validation error: ${parsed.error.message}` };
  }

  const observations: AirNowObservation[] = parsed.data.map((o) => ({
    dateTime: `${o.DateObserved.trim()} ${String(o.HourObserved).padStart(2, "0")}:00 ${o.LocalTimeZone}`,
    reportingArea: o.ReportingArea,
    stateCode: o.StateCode,
    latitude: o.Latitude,
    longitude: o.Longitude,
    parameterName: o.ParameterName,
    aqi: o.AQI,
    category: {
      number: o.Category.Number,
      name: o.Category.Name,
    },
  }));

  return { success: true, observations };
}
