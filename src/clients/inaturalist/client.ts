import {
  INATURALIST_BASE_URL,
  INATURALIST_DEFAULTS,
} from "./config.js";
import { iNatResponseSchema } from "../../validations/inaturalist.js";
import type { INatObservation, FetchObservationsParams } from "../../types/inaturalist.js";

type ObservationsResult =
  | {
      success: true;
      observations: INatObservation[];
      totalResults: number;
      page: number;
      perPage: number;
    }
  | { success: false; error: string };

export async function fetchObservations(
  params: FetchObservationsParams = {},
): Promise<ObservationsResult> {
  const {
    daysBack = INATURALIST_DEFAULTS.defaultDaysBack,
    perPage = INATURALIST_DEFAULTS.perPage,
    page = 1,
    bounds,
  } = params;

  if (!bounds) {
    return { success: false, error: "Bounds are required for species observations" };
  }

  const clampedPerPage = Math.min(
    Math.max(1, perPage),
    INATURALIST_DEFAULTS.maxPerPage,
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

  const d1 = resolvedStart.toISOString().split("T")[0];
  const d2 = resolvedEnd.toISOString().split("T")[0];

  const url = new URL(`${INATURALIST_BASE_URL}/observations`);
  url.searchParams.set("swlat", String(bounds.swlat));
  url.searchParams.set("swlng", String(bounds.swlng));
  url.searchParams.set("nelat", String(bounds.nelat));
  url.searchParams.set("nelng", String(bounds.nelng));
  url.searchParams.set("d1", d1);
  url.searchParams.set("d2", d2);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(clampedPerPage));
  url.searchParams.set("order_by", "observed_on");
  url.searchParams.set("order", "desc");
  url.searchParams.set("photos", "true");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": INATURALIST_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(INATURALIST_DEFAULTS.fetchTimeoutMs),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `iNaturalist API error: ${response.status} ${response.statusText}`,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `iNaturalist response parse error: ${message}` };
  }

  const parsed = iNatResponseSchema.safeParse(json);

  if (!parsed.success) {
    return { success: false, error: `Validation error: ${parsed.error.message}` };
  }

  return {
    success: true,
    observations: parsed.data.results,
    totalResults: parsed.data.total_results,
    page: parsed.data.page,
    perPage: parsed.data.per_page,
  };
}
