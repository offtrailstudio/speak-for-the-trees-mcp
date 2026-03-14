import {
  USGS_WATER_BASE_URL,
  MONITORING_LOCATIONS,
  PARAMETER_CODES,
  USGS_WATER_DEFAULTS,
} from "./config.js";
import {
  usgsResponseSchema,
  usgsMonitoringLocationsResponseSchema,
} from "../../validations/usgs-water.js";
import type { FetchWaterDataParams, WaterReading, UsgsStation } from "../../types/usgs-water.js";
import type { GeoBounds } from "../../types/location.js";

type WaterDataResult =
  | {
      success: true;
      readings: WaterReading[];
      totalResults: number;
    }
  | { success: false; error: string };

export async function fetchWaterData(
  params: FetchWaterDataParams = {},
): Promise<WaterDataResult> {
  const {
    daysBack = USGS_WATER_DEFAULTS.defaultDaysBack,
    limit = USGS_WATER_DEFAULTS.limit,
    parameterCodes = Object.keys(PARAMETER_CODES),
    monitoringLocationIds = MONITORING_LOCATIONS as unknown as string[],
  } = params;

  const clampedLimit = Math.min(
    Math.max(1, limit),
    USGS_WATER_DEFAULTS.maxLimit,
  );

  let resolvedStart: Date;
  let resolvedEnd: Date;
  if (params.startDate) {
    resolvedStart = params.startDate;
    resolvedEnd = params.endDate ?? new Date();
  } else {
    resolvedEnd = new Date();
    resolvedStart = new Date(resolvedEnd);
    resolvedStart.setDate(resolvedEnd.getDate() - daysBack);
  }

  const start = resolvedStart.toISOString();
  const end = resolvedEnd.toISOString();

  const url = new URL(
    `${USGS_WATER_BASE_URL}/collections/latest-continuous/items`,
  );
  url.searchParams.set(
    "monitoring_location_id",
    monitoringLocationIds.join(","),
  );
  url.searchParams.set("parameter_code", parameterCodes.join(","));
  url.searchParams.set("datetime", `${start}/${end}`);
  url.searchParams.set("limit", String(clampedLimit));
  url.searchParams.set("f", "json");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": USGS_WATER_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(USGS_WATER_DEFAULTS.fetchTimeoutMs),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `USGS API error: ${response.status} ${response.statusText}`,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `USGS response parse error: ${message}` };
  }

  const parsed = usgsResponseSchema.safeParse(json);

  if (!parsed.success) {
    return {
      success: false,
      error: `Validation error: ${parsed.error.message}`,
    };
  }

  const readings: WaterReading[] = parsed.data.features.map((feature) => {
    const props = feature.properties;
    const code = props.parameter_code;
    return {
      parameterCode: code,
      parameterName:
        props.parameter_name ??
        PARAMETER_CODES[code as keyof typeof PARAMETER_CODES] ??
        code,
      value: parseFloat(props.value),
      unit: props.unit_of_measure,
      time: props.time,
      locationId: props.monitoring_location_id,
    };
  });

  return {
    success: true,
    readings,
    totalResults: parsed.data.numberReturned,
  };
}

type StationDiscoveryResult =
  | { success: true; stations: UsgsStation[] }
  | { success: false; error: string };

export async function fetchMonitoringLocations(
  bounds: GeoBounds,
): Promise<StationDiscoveryResult> {
  const bbox = `${bounds.swlng},${bounds.swlat},${bounds.nelng},${bounds.nelat}`;

  const url = new URL(
    `${USGS_WATER_BASE_URL}/collections/monitoring-locations/items`,
  );
  url.searchParams.set("bbox", bbox);
  url.searchParams.set("limit", "500");
  url.searchParams.set("f", "json");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": USGS_WATER_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(USGS_WATER_DEFAULTS.fetchTimeoutMs),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `USGS API error: ${response.status} ${response.statusText}`,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `USGS response parse error: ${message}` };
  }

  const parsed = usgsMonitoringLocationsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return {
      success: false,
      error: `Validation error: ${parsed.error.message}`,
    };
  }

  const stations: UsgsStation[] = parsed.data.features
    .filter((f) => f.geometry !== null)
    .map((f) => ({
      id: f.properties.id,
      name: f.properties.monitoring_location_name ?? f.properties.id,
      lng: f.geometry!.coordinates[0],
      lat: f.geometry!.coordinates[1],
    }));

  return { success: true, stations };
}

export async function filterActiveStations(
  stationIds: string[],
): Promise<string[]> {
  if (stationIds.length === 0) return [];

  const url = new URL(
    `${USGS_WATER_BASE_URL}/collections/time-series-metadata/items`,
  );
  url.searchParams.set("monitoring_location_id", stationIds.join(","));
  url.searchParams.set("computation_identifier", "Instantaneous");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("f", "json");

  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": USGS_WATER_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(USGS_WATER_DEFAULTS.fetchTimeoutMs),
    });
    if (!response.ok) return stationIds;

    const json: unknown = await response.json();
    if (
      typeof json !== "object" ||
      json === null ||
      !("features" in json) ||
      !Array.isArray((json as Record<string, unknown>).features)
    ) {
      return stationIds;
    }

    const features = (json as { features: Array<{ properties?: { monitoring_location_id?: string } }> }).features;
    const activeIds = new Set(
      features
        .map((f) => f.properties?.monitoring_location_id)
        .filter((id): id is string => typeof id === "string"),
    );

    const filtered = stationIds.filter((id) => activeIds.has(id));
    return filtered.length > 0 ? filtered : stationIds;
  } catch {
    return stationIds;
  }
}
