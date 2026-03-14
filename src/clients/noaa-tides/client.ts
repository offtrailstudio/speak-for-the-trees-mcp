import {
  NOAA_TIDES_BASE_URL,
  STATION_ID,
  NOAA_TIDES_DEFAULTS,
} from "./config.js";
import {
  noaaWaterLevelResponseSchema,
  noaaPredictionResponseSchema,
  noaaErrorResponseSchema,
  noaaStationsResponseSchema,
} from "../../validations/noaa-tides.js";
import type {
  FetchTidalDataParams,
  TideReading,
  TidePrediction,
  NoaaStation,
} from "../../types/noaa-tides.js";

type TidalDataResult =
  | {
      success: true;
      observations: TideReading[];
      predictions: TidePrediction[];
      station: string;
    }
  | { success: false; error: string };

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}${month}${day} ${hours}:${minutes}`;
}

function buildUrl(product: string, station: string, beginDate: string, endDate: string): string {
  const url = new URL(NOAA_TIDES_BASE_URL);
  url.searchParams.set("station", station);
  url.searchParams.set("product", product);
  url.searchParams.set("begin_date", beginDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("datum", NOAA_TIDES_DEFAULTS.datum);
  url.searchParams.set("units", NOAA_TIDES_DEFAULTS.units);
  url.searchParams.set("time_zone", NOAA_TIDES_DEFAULTS.timeZone);
  url.searchParams.set("format", "json");
  url.searchParams.set("application", NOAA_TIDES_DEFAULTS.application);
  return url.toString();
}

async function fetchProduct(
  url: string,
  label: string,
): Promise<{ success: true; json: unknown } | { success: false; error: string }> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(NOAA_TIDES_DEFAULTS.fetchTimeoutMs),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error fetching ${label}: ${message}` };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `NOAA API error for ${label}: ${response.status} ${response.statusText}`,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `NOAA response parse error for ${label}: ${message}` };
  }

  const errorParsed = noaaErrorResponseSchema.safeParse(json);
  if (errorParsed.success) {
    return {
      success: false,
      error: `NOAA API error for ${label}: ${errorParsed.data.error.message}`,
    };
  }

  return { success: true, json };
}

export async function fetchTidalData(
  params: FetchTidalDataParams = {},
): Promise<TidalDataResult> {
  const {
    daysBack = NOAA_TIDES_DEFAULTS.defaultDaysBack,
    station = STATION_ID,
  } = params;

  let resolvedStart: Date;
  let resolvedEnd: Date;
  if (params.startDate) {
    resolvedStart = params.startDate;
    resolvedEnd = params.endDate ?? new Date();
  } else {
    const clampedDays = Math.min(
      Math.max(1, daysBack),
      NOAA_TIDES_DEFAULTS.maxDaysBack,
    );
    resolvedEnd = new Date();
    resolvedStart = new Date(resolvedEnd);
    resolvedStart.setDate(resolvedEnd.getDate() - clampedDays);
  }

  const beginStr = formatDate(resolvedStart);
  const endStr = formatDate(resolvedEnd);

  const waterLevelUrl = buildUrl("water_level", station, beginStr, endStr);
  const predictionsUrl = buildUrl("predictions", station, beginStr, endStr);

  const [waterLevelResult, predictionsResult] = await Promise.all([
    fetchProduct(waterLevelUrl, "water_level"),
    fetchProduct(predictionsUrl, "predictions"),
  ]);

  if (!waterLevelResult.success && !predictionsResult.success) {
    return {
      success: false,
      error: `${waterLevelResult.error}; ${predictionsResult.error}`,
    };
  }

  let observations: TideReading[] = [];
  if (waterLevelResult.success) {
    const parsed = noaaWaterLevelResponseSchema.safeParse(waterLevelResult.json);
    if (parsed.success) {
      observations = parsed.data.data.map((d) => ({
        time: d.t,
        value: parseFloat(d.v),
        sigma: parseFloat(d.s),
        flags: d.f,
        quality: d.q,
      }));
    }
  }

  let predictions: TidePrediction[] = [];
  if (predictionsResult.success) {
    const parsed = noaaPredictionResponseSchema.safeParse(predictionsResult.json);
    if (parsed.success) {
      predictions = parsed.data.predictions.map((p) => ({
        time: p.t,
        value: parseFloat(p.v),
      }));
    }
  }

  return {
    success: true,
    observations,
    predictions,
    station,
  };
}

const NOAA_METADATA_BASE_URL =
  "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi";

type StationListResult =
  | { success: true; stations: NoaaStation[] }
  | { success: false; error: string };

export async function fetchNoaaStations(): Promise<StationListResult> {
  const url = `${NOAA_METADATA_BASE_URL}/stations.json`;

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(NOAA_TIDES_DEFAULTS.fetchTimeoutMs),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `NOAA Metadata API error: ${response.status} ${response.statusText}`,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `NOAA response parse error: ${message}` };
  }

  const parsed = noaaStationsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return {
      success: false,
      error: `Validation error: ${parsed.error.message}`,
    };
  }

  const stations: NoaaStation[] = parsed.data.stations.map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    state: s.state ?? null,
    tidal: s.tidal ?? false,
  }));

  return { success: true, stations };
}
