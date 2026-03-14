import {
  ATTAINS_MAPSERVER_URL,
  ATTAINS_DEFAULTS,
  ATTAINS_LAYERS,
  IR_CATEGORIES,
} from "./config.js";
import { attainsQueryResponseSchema } from "../../validations/attains.js";
import type { ImpairedWater } from "../../types/attains.js";
import type { GeoCenter } from "../../types/location.js";

type ImpairedWatersResult =
  | { success: true; waters: ImpairedWater[] }
  | { success: false; error: string };

const CAUSE_GROUP_FIELDS: Record<string, string> = {
  causegrouppathogens: "Pathogens",
  causegroupnutrients: "Nutrients",
  causegroupmetals: "Metals (other than mercury)",
  causegroupmercury: "Mercury",
  causegrouporganicdepletionoxygendepletion: "Organic enrichment / oxygen depletion",
  causegrouppesticides: "Pesticides",
  causegroupsediment: "Sediment",
  causegrouptemperature: "Temperature",
  causegrouphabitat: "Habitat alterations",
  causegroupflow: "Flow alterations",
  causegroupph: "pH / acidity",
  causegroupturbidity: "Turbidity",
  causegroupother: "Other causes",
};

export async function fetchImpairedWaters(
  center: GeoCenter,
  radiusMiles: number = ATTAINS_DEFAULTS.searchRadiusMiles,
): Promise<ImpairedWatersResult> {
  const [linesResult, areasResult] = await Promise.all([
    queryLayer(ATTAINS_LAYERS.lines, center, radiusMiles),
    queryLayer(ATTAINS_LAYERS.areas, center, radiusMiles),
  ]);

  if (!linesResult.success && !areasResult.success) {
    return {
      success: false,
      error: `ATTAINS query failed: ${linesResult.success ? "" : linesResult.error}${areasResult.success ? "" : "; " + areasResult.error}`,
    };
  }

  const allWaters = [
    ...(linesResult.success ? linesResult.waters : []),
    ...(areasResult.success ? areasResult.waters : []),
  ];

  const seen = new Set<string>();
  const unique = allWaters.filter((w) => {
    if (seen.has(w.assessmentUnitId)) return false;
    seen.add(w.assessmentUnitId);
    return true;
  });

  return { success: true, waters: unique };
}

async function queryLayer(
  layerId: number,
  center: GeoCenter,
  radiusMiles: number,
): Promise<ImpairedWatersResult> {
  const url = new URL(`${ATTAINS_MAPSERVER_URL}/${layerId}/query`);
  url.searchParams.set("geometry", `${center.lng},${center.lat}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("distance", String(radiusMiles));
  url.searchParams.set("units", "esriSRUnit_StatuteMile");
  url.searchParams.set("outFields", "*");
  url.searchParams.set("resultRecordCount", String(ATTAINS_DEFAULTS.maxResults));
  url.searchParams.set("f", "json");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": ATTAINS_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(ATTAINS_DEFAULTS.fetchTimeoutMs),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `ATTAINS API error: ${response.status} ${response.statusText}`,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `ATTAINS parse error: ${message}` };
  }

  const parsed = attainsQueryResponseSchema.safeParse(json);
  if (!parsed.success) {
    return {
      success: false,
      error: `Validation error: ${parsed.error.message}`,
    };
  }

  const waters: ImpairedWater[] = parsed.data.features.map((f) => {
    const a = f.attributes;
    const irCat = a.ircategory ?? "";
    const causes: string[] = [];

    for (const [field, label] of Object.entries(CAUSE_GROUP_FIELDS)) {
      if (a[field as keyof typeof a] === "Y") {
        causes.push(label);
      }
    }

    return {
      assessmentUnitId: a.assessmentunitidentifier ?? "unknown",
      assessmentUnitName: a.assessmentunitname ?? "unnamed water body",
      irCategory: irCat,
      irCategoryDescription: IR_CATEGORIES[irCat] ?? `Category ${irCat}`,
      overallStatus: a.overallstatus ?? "unknown",
      on303dList: a.on303dlist === "Y",
      isImpaired: a.isimpaired === "Y",
      hasTmdl: a.hastmdl === "Y",
      reportingCycle: a.reportingcycle ?? "unknown",
      causes,
    };
  });

  return { success: true, waters };
}
