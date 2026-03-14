import { GBIF_BASE_URL, GBIF_DEFAULTS } from "./config.js";
import { gbifSearchResponseSchema } from "../../validations/gbif.js";
import type { GbifOccurrence, GbifSearchResult } from "../../types/gbif.js";
import type { GeoBounds } from "../../types/location.js";

function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

type FetchGbifParams = {
  bounds: GeoBounds;
  startDate: Date;
  endDate: Date;
  limit?: number;
};

type GbifResult =
  | { success: true; occurrences: GbifOccurrence[]; totalCount: number }
  | { success: false; error: string };

export async function fetchGbifOccurrences(params: FetchGbifParams): Promise<GbifResult> {
  const { bounds, startDate, endDate, limit = GBIF_DEFAULTS.limit } = params;

  const url = new URL(`${GBIF_BASE_URL}/occurrence/search`);
  url.searchParams.set("decimalLatitude", `${bounds.swlat},${bounds.nelat}`);
  url.searchParams.set("decimalLongitude", `${bounds.swlng},${bounds.nelng}`);
  url.searchParams.set("eventDate", `${toIsoDate(startDate)},${toIsoDate(endDate)}`);
  url.searchParams.set("hasCoordinate", "true");
  url.searchParams.set("occurrenceStatus", "PRESENT");
  url.searchParams.set("limit", String(Math.min(limit, 300)));

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": GBIF_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(GBIF_DEFAULTS.fetchTimeoutMs),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `GBIF API error: ${response.status} ${response.statusText}`,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `GBIF response parse error: ${message}` };
  }

  const parsed = gbifSearchResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { success: false, error: `GBIF validation error: ${parsed.error.message}` };
  }

  const data: GbifSearchResult = {
    count: parsed.data.count,
    endOfRecords: parsed.data.endOfRecords,
    results: parsed.data.results.map((r) => ({
      key: r.key,
      species: r.species ?? null,
      genus: r.genus ?? null,
      family: r.family ?? null,
      kingdom: r.kingdom ?? null,
      scientificName: r.scientificName,
      decimalLatitude: r.decimalLatitude ?? null,
      decimalLongitude: r.decimalLongitude ?? null,
      eventDate: r.eventDate ?? null,
      year: r.year ?? null,
      occurrenceStatus: r.occurrenceStatus ?? null,
      establishmentMeans: r.establishmentMeans ?? null,
      iucnRedListCategory: r.iucnRedListCategory ?? null,
      taxonRank: r.taxonRank ?? null,
      datasetName: r.datasetName ?? null,
    })),
  };

  return { success: true, occurrences: data.results, totalCount: data.count };
}
