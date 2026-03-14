import {
  ENVIROFACTS_BASE_URL,
  FCC_GEOCODE_URL,
  STATE_FIPS_TO_ABBR,
  TRI_DEFAULTS,
} from "./config.js";
import { bboxFromCenter } from "../../utils/geo.js";
import {
  fccCountySchema,
  triFacilityArraySchema,
  triReportingFormArraySchema,
  triFormRArraySchema,
} from "../../validations/tri.js";
import type { FetchTriFacilitiesParams, TriFacility, TriChemicalRelease, FacilityTriDetail } from "../../types/tri.js";

type TriFacilitiesResult =
  | { success: true; facilities: TriFacility[]; countyName: string; stateAbbr: string }
  | { success: false; error: string };

type TriReleasesResult =
  | { success: true; details: FacilityTriDetail[] }
  | { success: false; error: string };

async function getCountyAndState(lat: number, lng: number): Promise<{ countyName: string; stateAbbr: string } | null> {
  const url = `${FCC_GEOCODE_URL}?latitude=${lat}&longitude=${lng}&format=json`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": TRI_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const json: unknown = await response.json();
    const parsed = fccCountySchema.safeParse(json);
    if (!parsed.success) return null;

    const fips = parsed.data.County.FIPS; // e.g. "25025"
    const stateFips = fips.slice(0, 2);   // e.g. "25"
    const stateAbbr = STATE_FIPS_TO_ABBR[stateFips];
    if (!stateAbbr) return null;

    // Strip "County", "Parish", "Borough", etc. and uppercase
    const raw = parsed.data.County.name;
    const countyName = raw
      .replace(/\s+(County|Parish|Borough|Census Area|Municipality|City and Borough|Municipio|District)$/i, "")
      .toUpperCase();

    return { countyName, stateAbbr };
  } catch {
    return null;
  }
}

async function envirofacts<T>(path: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } }): Promise<{ data: T } | { error: string }> {
  const url = `${ENVIROFACTS_BASE_URL}/${path}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": TRI_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(TRI_DEFAULTS.fetchTimeoutMs),
    });
    if (!response.ok) return { error: `HTTP ${response.status} from Envirofacts` };
    const json: unknown = await response.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) return { error: `Unexpected Envirofacts response format` };
    return { data: parsed.data as T };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return { error: `Envirofacts request failed: ${msg}` };
  }
}

const MILES_TO_KM = 1.60934;

export async function fetchTriFacilities(params: FetchTriFacilitiesParams): Promise<TriFacilitiesResult> {
  const { center, radiusMiles = 10 } = params;
  const bounds = bboxFromCenter(center, radiusMiles * MILES_TO_KM);

  const location = await getCountyAndState(center.lat, center.lng);
  if (!location) {
    return { success: false, error: "Could not determine county from coordinates. Try a US location." };
  }

  const { countyName, stateAbbr } = location;
  const path = `TRI_FACILITY/COUNTY_NAME/${encodeURIComponent(countyName)}/STATE_ABBR/${stateAbbr}/rows/0:${TRI_DEFAULTS.maxFacilitiesPerCounty}/JSON`;
  const facilitiesResult = await envirofacts(path, triFacilityArraySchema);

  if ("error" in facilitiesResult) {
    return { success: false, error: `TRI facility query failed for ${countyName} County, ${stateAbbr}: ${facilitiesResult.error}` };
  }

  const facilities = facilitiesResult.data;

  // Filter by bounding box. pref_longitude is stored as a positive value (no sign) in Envirofacts.
  const isWesternHemisphere = center.lng < 0;
  const filtered = facilities.filter((f) => {
    const lat = f.pref_latitude;
    const lng = f.pref_longitude;
    if (!lat || !lng || lat === 0 || lng === 0) return false;
    if (lat < bounds.swlat || lat > bounds.nelat) return false;
    if (isWesternHemisphere) {
      // pref_longitude is positive (absolute value), bounds are negative
      return lng >= Math.abs(bounds.nelng) && lng <= Math.abs(bounds.swlng);
    }
    return lng >= bounds.swlng && lng <= bounds.nelng;
  });

  const result: TriFacility[] = filtered.map((f) => ({
    triId: f.tri_facility_id,
    facilityName: f.facility_name,
    city: f.city_name ?? null,
    county: f.county_name ?? null,
    state: f.state_abbr ?? null,
    latitude: f.pref_latitude ?? null,
    longitude: isWesternHemisphere ? -(f.pref_longitude ?? 0) : (f.pref_longitude ?? null),
  }));

  return { success: true, facilities: result, countyName, stateAbbr };
}

async function fetchReleasesForFacility(triId: string, facilityName: string): Promise<FacilityTriDetail | null> {
  // Step 1: Get all reporting forms for this facility (sorted newest first)
  const formsResult = await envirofacts(
    `TRI_REPORTING_FORM/TRI_FACILITY_ID/${encodeURIComponent(triId)}/rows/0:200/JSON`,
    triReportingFormArraySchema,
  );
  if ("error" in formsResult || formsResult.data.length === 0) return null;

  const forms = formsResult.data;

  // Find most recent year
  const years = forms.map((f) => f.reporting_year ?? "").filter(Boolean).sort().reverse();
  const mostRecentYear = years[0];
  if (!mostRecentYear) return null;

  const recentForms = forms.filter((f) => f.reporting_year === mostRecentYear);

  // Step 2: Fetch TRI_FORM_R for each doc_ctrl_num to get release quantities
  const releaseResults = await Promise.allSettled(
    recentForms.map(async (form) => {
      const formRResult = await envirofacts(
        `TRI_FORM_R/DOC_CTRL_NUM/${form.doc_ctrl_num}/rows/0:1/JSON`,
        triFormRArraySchema,
      );
      const formRData = "error" in formRResult ? null : formRResult.data;
      return { form, formR: formRData?.[0] ?? null };
    }),
  );

  const chemicals: TriChemicalRelease[] = [];

  for (const result of releaseResults) {
    if (result.status !== "fulfilled" || !result.value.formR) continue;
    const { form, formR } = result.value;

    const chemName = form.cas_chem_name?.trim() ||
      form.generic_chem_name?.trim() ||
      form.tri_chem_id ||
      "Unknown chemical";

    if (chemName === "NA" || chemName === "N/A") continue;

    const airTotal = (formR.fugitive_tot_rel ?? 0) + (formR.stack_tot_rel ?? 0);
    const waterTotal = formR.water_total_release ?? 0;
    const landTotal = formR.land_total_release ?? 0;
    const totalOnSite = airTotal + waterTotal + landTotal;
    const totalOffSite = formR.off_site_total_transfers ?? 0;

    if (totalOnSite === 0 && totalOffSite === 0) continue;

    chemicals.push({
      chemicalName: chemName,
      reportingYear: mostRecentYear,
      totalAirReleases: airTotal,
      totalWaterReleases: waterTotal,
      totalLandReleases: landTotal,
      totalOnSiteReleases: totalOnSite,
      totalOffSiteTransfers: totalOffSite,
    });
  }

  if (chemicals.length === 0) return null;

  return { triId, facilityName, chemicals };
}

export async function fetchTriReleases(
  facilities: { triId: string; facilityName: string }[],
): Promise<TriReleasesResult> {
  if (facilities.length === 0) return { success: true, details: [] };

  try {
    const results = await Promise.allSettled(
      facilities.map((f) => fetchReleasesForFacility(f.triId, f.facilityName)),
    );

    const details: FacilityTriDetail[] = results
      .filter((r): r is PromiseFulfilledResult<FacilityTriDetail | null> =>
        r.status === "fulfilled" && r.value !== null)
      .map((r) => r.value!);

    return { success: true, details };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `TRI release fetch error: ${message}` };
  }
}
