import { NLDI_BASE_URL, NLDI_DEFAULTS } from "./config.js";
import {
  nldiHydrolocationResponseSchema,
} from "../../validations/nldi.js";
import type { Hydrolocation } from "../../types/nldi.js";
import type { UsgsStation } from "../../types/usgs-water.js";

type HydrolocationResult =
  | { success: true; hydrolocation: Hydrolocation }
  | { success: false; error: string };

type UpstreamStationsResult =
  | { success: true; stations: UsgsStation[] }
  | { success: false; error: string };

function fetchOptions(): RequestInit {
  return {
    headers: { "User-Agent": NLDI_DEFAULTS.userAgent },
    signal: AbortSignal.timeout(NLDI_DEFAULTS.fetchTimeoutMs),
  };
}

export async function fetchHydrolocation(
  lat: number,
  lng: number,
): Promise<HydrolocationResult> {
  const url = new URL(`${NLDI_BASE_URL}/linked-data/hydrolocation`);
  url.searchParams.set("coords", `POINT(${lng} ${lat})`);
  url.searchParams.set("f", "json");

  let response: Response;
  try {
    response = await fetch(url.toString(), fetchOptions());
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `NLDI API error: ${response.status} ${response.statusText}`,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `NLDI response parse error: ${message}` };
  }

  const parsed = nldiHydrolocationResponseSchema.safeParse(json);
  if (!parsed.success) {
    return {
      success: false,
      error: `Validation error: ${parsed.error.message}`,
    };
  }

  const feature = parsed.data.features.find(
    (f) => f.properties.source === "indexed",
  ) ?? parsed.data.features[0];
  if (!feature) {
    return { success: false, error: "No hydrolocation found for coordinates" };
  }

  const props = feature.properties;
  const coords = feature.geometry?.coordinates;
  const measure = props.measure ? parseFloat(props.measure) : null;

  return {
    success: true,
    hydrolocation: {
      comid: props.comid ?? props.identifier ?? "",
      name: props.name || null,
      reachcode: props.reachcode || null,
      measure: measure !== null && !isNaN(measure) ? measure : null,
      lat: coords ? coords[1] : lat,
      lng: coords ? coords[0] : lng,
    },
  };
}

export async function fetchUpstreamStations(
  comid: string,
  distanceKm: number = NLDI_DEFAULTS.navigationDistanceKm,
): Promise<UpstreamStationsResult> {
  return fetchStationsByNavigation(comid, "UT", distanceKm);
}

export async function fetchDownstreamStations(
  comid: string,
  distanceKm: number = NLDI_DEFAULTS.navigationDistanceKm,
): Promise<UpstreamStationsResult> {
  return fetchStationsByNavigation(comid, "DM", distanceKm);
}

async function fetchStationsByNavigation(
  comid: string,
  navigationMode: string,
  distanceKm: number = NLDI_DEFAULTS.navigationDistanceKm,
): Promise<UpstreamStationsResult> {
  const url = new URL(
    `${NLDI_BASE_URL}/linked-data/comid/${comid}/navigation/${navigationMode}/nwissite`,
  );
  url.searchParams.set("distance", String(distanceKm));
  url.searchParams.set("f", "json");

  let response: Response;
  try {
    response = await fetch(url.toString(), fetchOptions());
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `NLDI stations error: ${response.status} ${response.statusText}`,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Stations parse error: ${message}` };
  }

  const parsed = nldiHydrolocationResponseSchema.safeParse(json);
  if (!parsed.success) {
    return {
      success: false,
      error: `Validation error: ${parsed.error.message}`,
    };
  }

  const stations: UsgsStation[] = parsed.data.features
    .filter((f) => f.geometry !== null && f.properties.identifier)
    .map((f) => ({
      id: f.properties.identifier!,
      name: f.properties.name || f.properties.identifier!,
      lat: f.geometry!.coordinates[1],
      lng: f.geometry!.coordinates[0],
    }));

  return { success: true, stations };
}
