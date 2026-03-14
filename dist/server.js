#!/usr/bin/env node
import {
  bboxFromCenter,
  fetchEchoFacilities,
  fetchImpairedWaters,
  fetchObservations,
  fetchSncFacilityIds,
  fetchTidalData,
  fetchViolationDetails,
  fetchWaterData,
  formatEchoDataForPrompt,
  formatImpairedWatersForPrompt,
  formatObservationsForPrompt,
  formatTidalDataForPrompt,
  formatViolationDetailsAsText,
  formatWaterDataForPrompt,
  resolveLocation,
  resolveTimeRange
} from "./chunk-ECY2LWN4.js";

// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// src/agents/watershed/tools.ts
import { z } from "zod";
function registerWatershedTools(server2) {
  server2.tool(
    "usgs_water_conditions",
    "Fetch real-time water quality data (temperature, dissolved oxygen, pH, streamflow) from USGS monitoring stations near a location. Returns readings with EPA reference thresholds for context.",
    {
      latitude: z.number().describe("Latitude of the location to investigate"),
      longitude: z.number().describe("Longitude of the location to investigate"),
      days_back: z.number().min(1).max(90).optional().describe("Days of history to fetch. Default: 7"),
      parameter_codes: z.array(z.string()).optional().describe("USGS parameter codes to filter by (e.g., ['00300'] for dissolved oxygen only)")
    },
    async ({ latitude, longitude, days_back, parameter_codes }) => {
      const location = await resolveLocation(latitude, longitude);
      const time = resolveTimeRange({ days_back: days_back ?? 7 });
      if (location.usgsStationIds.length === 0) {
        return {
          content: [{ type: "text", text: `No active USGS monitoring stations found near ${latitude}, ${longitude}. Try a location closer to a river or stream.` }]
        };
      }
      const data = await fetchWaterData({
        startDate: time.startDate,
        endDate: time.endDate,
        parameterCodes: parameter_codes,
        monitoringLocationIds: location.usgsStationIds
      });
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      if (data.readings.length === 0) {
        return {
          content: [{ type: "text", text: `No water quality readings found in the past ${days_back ?? 7} days from ${location.usgsStationIds.length} station(s) near ${location.name}.` }]
        };
      }
      return {
        content: [{ type: "text", text: formatWaterDataForPrompt(data.readings, `${days_back ?? 7} days`) }]
      };
    }
  );
  server2.tool(
    "noaa_tidal_conditions",
    "Fetch tidal water levels and predictions from the nearest NOAA gauge. Returns observed levels, predicted levels, tidal range, and deviation from predictions.",
    {
      latitude: z.number().describe("Latitude of the location to investigate"),
      longitude: z.number().describe("Longitude of the location to investigate"),
      days_back: z.number().min(1).max(7).optional().describe("Days of history. Default: 2. Max: 7")
    },
    async ({ latitude, longitude, days_back }) => {
      const location = await resolveLocation(latitude, longitude);
      const time = resolveTimeRange({ days_back: days_back ?? 2 });
      if (!location.noaaStationId) {
        return {
          content: [{ type: "text", text: `No NOAA tidal gauge found near ${latitude}, ${longitude}.` }]
        };
      }
      const data = await fetchTidalData({
        startDate: time.startDate,
        endDate: time.endDate,
        station: location.noaaStationId
      });
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      if (data.observations.length === 0 && data.predictions.length === 0) {
        return {
          content: [{ type: "text", text: `No tidal data found for the past ${days_back ?? 2} days.` }]
        };
      }
      return {
        content: [{
          type: "text",
          text: formatTidalDataForPrompt(
            { observations: data.observations, predictions: data.predictions, station: data.station },
            `${days_back ?? 2} days`
          )
        }]
      };
    }
  );
}

// src/agents/biodiversity/tools.ts
import { z as z3 } from "zod";

// src/clients/gbif/config.ts
var GBIF_BASE_URL = "https://api.gbif.org/v1";
var GBIF_DEFAULTS = {
  limit: 300,
  userAgent: "SpeakForTheTrees/0.2.0",
  fetchTimeoutMs: 15e3
};

// src/validations/gbif.ts
import { z as z2 } from "zod";
var gbifOccurrenceSchema = z2.object({
  key: z2.number(),
  species: z2.string().nullish(),
  genus: z2.string().nullish(),
  family: z2.string().nullish(),
  kingdom: z2.string().nullish(),
  scientificName: z2.string(),
  decimalLatitude: z2.number().nullish(),
  decimalLongitude: z2.number().nullish(),
  eventDate: z2.string().nullish(),
  year: z2.number().nullish(),
  occurrenceStatus: z2.string().nullish(),
  establishmentMeans: z2.string().nullish(),
  iucnRedListCategory: z2.string().nullish(),
  taxonRank: z2.string().nullish(),
  datasetName: z2.string().nullish()
}).passthrough();
var gbifSearchResponseSchema = z2.object({
  offset: z2.number(),
  limit: z2.number(),
  endOfRecords: z2.boolean(),
  count: z2.number(),
  results: z2.array(gbifOccurrenceSchema)
});

// src/clients/gbif/client.ts
function toIsoDate(date) {
  return date.toISOString().split("T")[0];
}
async function fetchGbifOccurrences(params) {
  const { bounds, startDate, endDate, limit = GBIF_DEFAULTS.limit } = params;
  const url = new URL(`${GBIF_BASE_URL}/occurrence/search`);
  url.searchParams.set("decimalLatitude", `${bounds.swlat},${bounds.nelat}`);
  url.searchParams.set("decimalLongitude", `${bounds.swlng},${bounds.nelng}`);
  url.searchParams.set("eventDate", `${toIsoDate(startDate)},${toIsoDate(endDate)}`);
  url.searchParams.set("hasCoordinate", "true");
  url.searchParams.set("occurrenceStatus", "PRESENT");
  url.searchParams.set("limit", String(Math.min(limit, 300)));
  let response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": GBIF_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(GBIF_DEFAULTS.fetchTimeoutMs)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }
  if (!response.ok) {
    return {
      success: false,
      error: `GBIF API error: ${response.status} ${response.statusText}`
    };
  }
  let json;
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
  const data = {
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
      datasetName: r.datasetName ?? null
    }))
  };
  return { success: true, occurrences: data.results, totalCount: data.count };
}

// src/clients/gbif/summarize.ts
var IUCN_THREAT_LEVELS = /* @__PURE__ */ new Set(["CR", "EN", "VU", "NT"]);
var IUCN_LABELS = {
  CR: "Critically Endangered",
  EN: "Endangered",
  VU: "Vulnerable",
  NT: "Near Threatened",
  LC: "Least Concern",
  DD: "Data Deficient",
  EX: "Extinct",
  EW: "Extinct in the Wild"
};
function formatGbifOccurrencesForPrompt(occurrences, totalCount, dateRange) {
  if (occurrences.length === 0) {
    return `No GBIF species occurrences found in this area for the period: ${dateRange}. This may reflect a data gap rather than absence \u2014 GBIF aggregates records from museum collections, citizen science platforms, and research datasets, and coverage varies by region.`;
  }
  const parts = [
    `GBIF species occurrences in this area \u2014 ${dateRange} (${totalCount.toLocaleString()} total records; showing ${occurrences.length}):`,
    "GBIF aggregates records from museum collections, research expeditions, iNaturalist, eBird, and other sources. Each record represents a documented occurrence, not a population estimate."
  ];
  const byKingdom = /* @__PURE__ */ new Map();
  for (const o of occurrences) {
    const kingdom = o.kingdom ?? "Unknown";
    if (!byKingdom.has(kingdom)) byKingdom.set(kingdom, []);
    byKingdom.get(kingdom).push(o);
  }
  const kingdomOrder = ["Animalia", "Plantae", "Fungi", "Chromista", "Protista", "Bacteria", "Unknown"];
  const sortedKingdoms = [...byKingdom.keys()].sort(
    (a, b) => {
      const ai = kingdomOrder.indexOf(a);
      const bi = kingdomOrder.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    }
  );
  parts.push(`
Kingdom breakdown: ${sortedKingdoms.map((k) => `${k} (${byKingdom.get(k).length})`).join(", ")}`);
  const threatened = occurrences.filter(
    (o) => o.iucnRedListCategory && IUCN_THREAT_LEVELS.has(o.iucnRedListCategory)
  );
  if (threatened.length > 0) {
    parts.push(`
Species with IUCN conservation status (${threatened.length}):`);
    for (const o of threatened.slice(0, 10)) {
      const label = o.iucnRedListCategory ? IUCN_LABELS[o.iucnRedListCategory] ?? o.iucnRedListCategory : "";
      const name = o.species ?? o.scientificName;
      parts.push(`  - ${name} (${o.family ?? o.kingdom ?? "unknown family"}) \u2014 ${label}`);
    }
    if (threatened.length > 10) parts.push(`  ...and ${threatened.length - 10} more`);
  }
  const introduced = occurrences.filter(
    (o) => o.establishmentMeans && o.establishmentMeans.toUpperCase() !== "NATIVE"
  );
  if (introduced.length > 0) {
    parts.push(`
Non-native species occurrences (${introduced.length}):`);
    const grouped = /* @__PURE__ */ new Map();
    for (const o of introduced) {
      const means = o.establishmentMeans ?? "Unknown";
      if (!grouped.has(means)) grouped.set(means, []);
      grouped.get(means).push(o);
    }
    for (const [means, group] of grouped) {
      const names = [...new Set(group.map((o) => o.species ?? o.scientificName).filter(Boolean))];
      parts.push(`  ${means}: ${names.slice(0, 5).join(", ")}${names.length > 5 ? ` ...and ${names.length - 5} more` : ""}`);
    }
  }
  const byFamily = /* @__PURE__ */ new Map();
  for (const o of occurrences) {
    if (o.family) {
      byFamily.set(o.family, (byFamily.get(o.family) ?? 0) + 1);
    }
  }
  const topFamilies = [...byFamily.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (topFamilies.length > 0) {
    parts.push(`
Most-recorded families: ${topFamilies.map(([f, n]) => `${f} (${n})`).join(", ")}`);
  }
  parts.push("\nNote: GBIF records are occurrence data \u2014 they document presence at a point in time. They are not population surveys and should not be used to infer abundance or population trends.");
  return parts.join("\n");
}

// src/agents/biodiversity/tools.ts
function registerBiodiversityTools(server2) {
  server2.tool(
    "inaturalist_species_observations",
    "Fetch species observations from iNaturalist near a location. Returns community science records with taxonomy, threat status, and native/introduced flags. Observations indicate presence, not population health.",
    {
      latitude: z3.number().describe("Latitude of the location to investigate"),
      longitude: z3.number().describe("Longitude of the location to investigate"),
      days_back: z3.number().min(1).max(365).optional().describe("Days of history. Default: 30"),
      per_page: z3.number().min(1).max(200).optional().describe("Maximum observations to return. Default: 200")
    },
    async ({ latitude, longitude, days_back, per_page }) => {
      const location = await resolveLocation(latitude, longitude);
      const time = resolveTimeRange({ days_back: days_back ?? 30 });
      const data = await fetchObservations({
        startDate: time.startDate,
        endDate: time.endDate,
        perPage: per_page ?? 200,
        bounds: location.bounds
      });
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      if (data.observations.length === 0) {
        return {
          content: [{ type: "text", text: `No species observations found in the past ${days_back ?? 30} days near ${location.name}.` }]
        };
      }
      return {
        content: [{ type: "text", text: formatObservationsForPrompt(data.observations, `${days_back ?? 30} days`) }]
      };
    }
  );
  server2.tool(
    "gbif_species_occurrences",
    "Fetch species occurrence records from GBIF (Global Biodiversity Information Facility) near a location. Aggregates records from museum collections, research expeditions, iNaturalist, eBird, and other datasets. Broader coverage than iNaturalist alone. Occurrences indicate documented presence, not population health.",
    {
      latitude: z3.number().describe("Latitude of the location to investigate"),
      longitude: z3.number().describe("Longitude of the location to investigate"),
      days_back: z3.number().min(1).max(365).optional().describe("Days of history. Default: 90"),
      limit: z3.number().min(1).max(300).optional().describe("Maximum records to return. Default: 300")
    },
    async ({ latitude, longitude, days_back, limit }) => {
      const location = await resolveLocation(latitude, longitude);
      const time = resolveTimeRange({ days_back: days_back ?? 90 });
      const data = await fetchGbifOccurrences({
        bounds: location.bounds,
        startDate: time.startDate,
        endDate: time.endDate,
        limit: limit ?? 300
      });
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      return {
        content: [{
          type: "text",
          text: formatGbifOccurrencesForPrompt(data.occurrences, data.totalCount, `${days_back ?? 90} days`)
        }]
      };
    }
  );
}

// src/agents/pollution/tools.ts
import { z as z5 } from "zod";

// src/clients/tri/config.ts
var ENVIROFACTS_BASE_URL = "https://data.epa.gov/efservice";
var FCC_GEOCODE_URL = "https://geo.fcc.gov/api/census/block/find";
var TRI_DEFAULTS = {
  userAgent: "SpeakForTheTrees/0.2.0",
  fetchTimeoutMs: 15e3,
  maxFacilitiesPerCounty: 500
};
var STATE_FIPS_TO_ABBR = {
  "01": "AL",
  "02": "AK",
  "04": "AZ",
  "05": "AR",
  "06": "CA",
  "08": "CO",
  "09": "CT",
  "10": "DE",
  "11": "DC",
  "12": "FL",
  "13": "GA",
  "15": "HI",
  "16": "ID",
  "17": "IL",
  "18": "IN",
  "19": "IA",
  "20": "KS",
  "21": "KY",
  "22": "LA",
  "23": "ME",
  "24": "MD",
  "25": "MA",
  "26": "MI",
  "27": "MN",
  "28": "MS",
  "29": "MO",
  "30": "MT",
  "31": "NE",
  "32": "NV",
  "33": "NH",
  "34": "NJ",
  "35": "NM",
  "36": "NY",
  "37": "NC",
  "38": "ND",
  "39": "OH",
  "40": "OK",
  "41": "OR",
  "42": "PA",
  "44": "RI",
  "45": "SC",
  "46": "SD",
  "47": "TN",
  "48": "TX",
  "49": "UT",
  "50": "VT",
  "51": "VA",
  "53": "WA",
  "54": "WV",
  "55": "WI",
  "56": "WY",
  "72": "PR",
  "78": "VI"
};

// src/validations/tri.ts
import { z as z4 } from "zod";
var triFacilitySchema = z4.object({
  tri_facility_id: z4.string(),
  facility_name: z4.string(),
  city_name: z4.string().nullish(),
  county_name: z4.string().nullish(),
  state_abbr: z4.string().nullish(),
  zip_code: z4.string().nullish(),
  pref_latitude: z4.number().nullish(),
  pref_longitude: z4.number().nullish()
}).passthrough();
var triFacilityArraySchema = z4.array(triFacilitySchema);
var triCountSchema = z4.array(z4.object({ TOTALQUERYRESULTS: z4.number() }));
var fccCountySchema = z4.object({
  County: z4.object({
    FIPS: z4.string(),
    name: z4.string()
  })
}).passthrough();
var triReportingFormRowSchema = z4.object({
  doc_ctrl_num: z4.string(),
  tri_facility_id: z4.string(),
  tri_chem_id: z4.string().nullish(),
  reporting_year: z4.string().nullish(),
  cas_chem_name: z4.string().nullish(),
  generic_chem_name: z4.string().nullish()
}).passthrough();
var triReportingFormArraySchema = z4.array(triReportingFormRowSchema);
var triFormRRowSchema = z4.object({
  doc_ctrl_num: z4.string(),
  air_total_release: z4.number().nullish(),
  water_total_release: z4.number().nullish(),
  land_total_release: z4.number().nullish(),
  fugitive_tot_rel: z4.number().nullish(),
  stack_tot_rel: z4.number().nullish(),
  off_site_total_transfers: z4.number().nullish()
}).passthrough();
var triFormRArraySchema = z4.array(triFormRRowSchema);

// src/clients/tri/client.ts
async function getCountyAndState(lat, lng) {
  const url = `${FCC_GEOCODE_URL}?latitude=${lat}&longitude=${lng}&format=json`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": TRI_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(5e3)
    });
    if (!response.ok) return null;
    const json = await response.json();
    const parsed = fccCountySchema.safeParse(json);
    if (!parsed.success) return null;
    const fips = parsed.data.County.FIPS;
    const stateFips = fips.slice(0, 2);
    const stateAbbr = STATE_FIPS_TO_ABBR[stateFips];
    if (!stateAbbr) return null;
    const raw = parsed.data.County.name;
    const countyName = raw.replace(/\s+(County|Parish|Borough|Census Area|Municipality|City and Borough|Municipio|District)$/i, "").toUpperCase();
    return { countyName, stateAbbr };
  } catch {
    return null;
  }
}
async function envirofacts(path, schema) {
  const url = `${ENVIROFACTS_BASE_URL}/${path}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": TRI_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(TRI_DEFAULTS.fetchTimeoutMs)
    });
    if (!response.ok) return { error: `HTTP ${response.status} from Envirofacts` };
    const json = await response.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) return { error: `Unexpected Envirofacts response format` };
    return { data: parsed.data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return { error: `Envirofacts request failed: ${msg}` };
  }
}
var MILES_TO_KM = 1.60934;
async function fetchTriFacilities(params) {
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
  const isWesternHemisphere = center.lng < 0;
  const filtered = facilities.filter((f) => {
    const lat = f.pref_latitude;
    const lng = f.pref_longitude;
    if (!lat || !lng || lat === 0 || lng === 0) return false;
    if (lat < bounds.swlat || lat > bounds.nelat) return false;
    if (isWesternHemisphere) {
      return lng >= Math.abs(bounds.nelng) && lng <= Math.abs(bounds.swlng);
    }
    return lng >= bounds.swlng && lng <= bounds.nelng;
  });
  const result = filtered.map((f) => ({
    triId: f.tri_facility_id,
    facilityName: f.facility_name,
    city: f.city_name ?? null,
    county: f.county_name ?? null,
    state: f.state_abbr ?? null,
    latitude: f.pref_latitude ?? null,
    longitude: isWesternHemisphere ? -(f.pref_longitude ?? 0) : f.pref_longitude ?? null
  }));
  return { success: true, facilities: result, countyName, stateAbbr };
}
async function fetchReleasesForFacility(triId, facilityName) {
  const formsResult = await envirofacts(
    `TRI_REPORTING_FORM/TRI_FACILITY_ID/${encodeURIComponent(triId)}/rows/0:200/JSON`,
    triReportingFormArraySchema
  );
  if ("error" in formsResult || formsResult.data.length === 0) return null;
  const forms = formsResult.data;
  const years = forms.map((f) => f.reporting_year ?? "").filter(Boolean).sort().reverse();
  const mostRecentYear = years[0];
  if (!mostRecentYear) return null;
  const recentForms = forms.filter((f) => f.reporting_year === mostRecentYear);
  const releaseResults = await Promise.allSettled(
    recentForms.map(async (form) => {
      const formRResult = await envirofacts(
        `TRI_FORM_R/DOC_CTRL_NUM/${form.doc_ctrl_num}/rows/0:1/JSON`,
        triFormRArraySchema
      );
      const formRData = "error" in formRResult ? null : formRResult.data;
      return { form, formR: formRData?.[0] ?? null };
    })
  );
  const chemicals = [];
  for (const result of releaseResults) {
    if (result.status !== "fulfilled" || !result.value.formR) continue;
    const { form, formR } = result.value;
    const chemName = form.cas_chem_name?.trim() || form.generic_chem_name?.trim() || form.tri_chem_id || "Unknown chemical";
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
      totalOffSiteTransfers: totalOffSite
    });
  }
  if (chemicals.length === 0) return null;
  return { triId, facilityName, chemicals };
}
async function fetchTriReleases(facilities) {
  if (facilities.length === 0) return { success: true, details: [] };
  try {
    const results = await Promise.allSettled(
      facilities.map((f) => fetchReleasesForFacility(f.triId, f.facilityName))
    );
    const details = results.filter((r) => r.status === "fulfilled" && r.value !== null).map((r) => r.value);
    return { success: true, details };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `TRI release fetch error: ${message}` };
  }
}

// src/clients/tri/summarize.ts
var MAX_FACILITIES = 20;
var MAX_CHEMICALS_PER_FACILITY = 5;
function formatTriFacilitiesForPrompt(facilities, countyName, stateAbbr) {
  if (facilities.length === 0) {
    return `No TRI-reporting facilities found near this location (${countyName} County, ${stateAbbr}). This means no facilities in this county reported chemical releases to the EPA Toxics Release Inventory, or none fall within the search bounds.`;
  }
  const parts = [
    `TRI-reporting facilities in ${countyName} County, ${stateAbbr} near this location (${facilities.length} found):`,
    "These facilities are required under the Emergency Planning and Community Right-to-Know Act (EPCRA) to report annual releases of listed toxic chemicals to the EPA."
  ];
  const displayed = facilities.slice(0, MAX_FACILITIES);
  for (const f of displayed) {
    const location = [f.city, f.state].filter(Boolean).join(", ");
    parts.push(`- ${f.facilityName} (tri_id: ${f.triId}) | ${location || "location unknown"}`);
  }
  if (facilities.length > MAX_FACILITIES) {
    parts.push(`...and ${facilities.length - MAX_FACILITIES} more facilities`);
  }
  return parts.join("\n");
}
function formatTriReleasesForPrompt(details) {
  if (details.length === 0) {
    return "No chemical release data found for these facilities.";
  }
  const parts = [
    `Chemical release data from TRI Detailed Facility Reports. NOTE: TRI data is self-reported by facilities and represents annual totals, not real-time monitoring. Releases are measured in pounds per year. These are legally permitted releases above reporting thresholds \u2014 presence in TRI does not indicate a violation.`
  ];
  for (const detail of details) {
    const sorted = [...detail.chemicals].sort(
      (a, b) => b.totalOnSiteReleases - a.totalOnSiteReleases
    );
    const top = sorted.slice(0, MAX_CHEMICALS_PER_FACILITY);
    parts.push(`
${detail.facilityName} (${detail.triId}):`);
    if (top.length === 0) {
      parts.push("  No release data available.");
      continue;
    }
    const yearNote = top[0]?.reportingYear ? ` (${top[0].reportingYear})` : "";
    parts.push(`  Top reported releases${yearNote}:`);
    for (const chem of top) {
      const releaseBreakdown = [
        chem.totalAirReleases > 0 ? `air: ${chem.totalAirReleases.toLocaleString()} lbs` : null,
        chem.totalWaterReleases > 0 ? `water: ${chem.totalWaterReleases.toLocaleString()} lbs` : null,
        chem.totalLandReleases > 0 ? `land: ${chem.totalLandReleases.toLocaleString()} lbs` : null
      ].filter(Boolean).join(", ");
      const total = chem.totalOnSiteReleases > 0 ? `${chem.totalOnSiteReleases.toLocaleString()} lbs total` : "amount not reported";
      parts.push(`  - ${chem.chemicalName}: ${total}${releaseBreakdown ? ` (${releaseBreakdown})` : ""}`);
    }
    if (sorted.length > MAX_CHEMICALS_PER_FACILITY) {
      parts.push(`  ...and ${sorted.length - MAX_CHEMICALS_PER_FACILITY} more chemicals`);
    }
  }
  return parts.join("\n");
}

// src/agents/pollution/tools.ts
function registerPollutionTools(server2) {
  server2.tool(
    "epa_facilities",
    "Fetch EPA-permitted facilities (Clean Water Act NPDES permits) near a location. Returns facility names, permit status, compliance summary, and violation counts.",
    {
      latitude: z5.number().describe("Latitude of the location to investigate"),
      longitude: z5.number().describe("Longitude of the location to investigate"),
      radius_miles: z5.number().min(1).max(100).optional().describe("Search radius in miles. Default: 10")
    },
    async ({ latitude, longitude, radius_miles }) => {
      const location = await resolveLocation(latitude, longitude);
      const data = await fetchEchoFacilities({
        radiusMiles: radius_miles ?? 10,
        center: location.center
      });
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      const text = formatEchoDataForPrompt({
        facilities: data.facilities,
        complianceSummary: data.complianceSummary
      });
      return {
        content: [{ type: "text", text: text || "No permitted facilities found." }]
      };
    }
  );
  server2.tool(
    "epa_violations",
    "Find facilities currently in Significant Non-Compliance (SNC) with their EPA discharge permits near a location. Returns facility names and IDs that can be passed to epa_violation_details.",
    {
      latitude: z5.number().describe("Latitude of the location to investigate"),
      longitude: z5.number().describe("Longitude of the location to investigate"),
      radius_miles: z5.number().min(1).max(100).optional().describe("Search radius in miles. Default: 10")
    },
    async ({ latitude, longitude, radius_miles }) => {
      const location = await resolveLocation(latitude, longitude);
      const facilities = await fetchSncFacilityIds(location.center, radius_miles ?? 10);
      if (facilities.length === 0) {
        return {
          content: [{ type: "text", text: "No facilities currently in Significant Non-Compliance." }]
        };
      }
      const lines = facilities.map(
        (f) => `- ${f.facilityName} (${f.sourceId})`
      );
      return {
        content: [{
          type: "text",
          text: `Facilities in Significant Non-Compliance:
${lines.join("\n")}`
        }]
      };
    }
  );
  server2.tool(
    "epa_violation_details",
    "Get detailed effluent violation data for specific facilities. Shows which parameters were violated, by how much, and when. Use after epa_violations to investigate specific facilities.",
    {
      facilities: z5.array(z5.object({
        source_id: z5.string().describe("EPA source ID of the facility"),
        facility_name: z5.string().describe("Name of the facility")
      })).describe("Facilities to look up (from epa_violations results)")
    },
    async ({ facilities }) => {
      const mapped = facilities.map((f) => ({
        sourceId: f.source_id,
        facilityName: f.facility_name
      }));
      const data = await fetchViolationDetails(mapped);
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      return {
        content: [{ type: "text", text: formatViolationDetailsAsText(data.details) }]
      };
    }
  );
  server2.tool(
    "epa_impaired_waters",
    "Check EPA 303(d) impaired waters listings near a location. Returns water bodies assessed as impaired, their causes (nutrients, pathogens, metals, etc.), and whether a cleanup plan (TMDL) exists.",
    {
      latitude: z5.number().describe("Latitude of the location to investigate"),
      longitude: z5.number().describe("Longitude of the location to investigate"),
      radius_miles: z5.number().min(1).max(25).optional().describe("Search radius in miles. Default: 5")
    },
    async ({ latitude, longitude, radius_miles }) => {
      const location = await resolveLocation(latitude, longitude);
      const radius = radius_miles ?? 5;
      const data = await fetchImpairedWaters(location.center, radius);
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      return {
        content: [{ type: "text", text: formatImpairedWatersForPrompt(data.waters, radius) }]
      };
    }
  );
  server2.tool(
    "tri_toxic_releases",
    "Fetch TRI (Toxics Release Inventory) facilities near a location. Returns facilities required to report annual chemical releases to the EPA under EPCRA. Use tri_release_details to get per-chemical release amounts.",
    {
      latitude: z5.number().describe("Latitude of the location to investigate"),
      longitude: z5.number().describe("Longitude of the location to investigate"),
      radius_miles: z5.number().min(1).max(100).optional().describe("Search radius in miles. Default: 10")
    },
    async ({ latitude, longitude, radius_miles }) => {
      const location = await resolveLocation(latitude, longitude);
      const data = await fetchTriFacilities({
        center: location.center,
        radiusMiles: radius_miles ?? 10
      });
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      return {
        content: [{ type: "text", text: formatTriFacilitiesForPrompt(data.facilities, data.countyName, data.stateAbbr) }]
      };
    }
  );
  server2.tool(
    "tri_release_details",
    "Get chemical release details for specific TRI-reporting facilities. Returns the most recent year's self-reported release amounts by chemical and release medium (air, water, land). Use after tri_toxic_releases.",
    {
      facilities: z5.array(z5.object({
        tri_id: z5.string().describe("TRI facility ID (from tri_toxic_releases results)"),
        facility_name: z5.string().describe("Name of the facility")
      })).describe("TRI facilities to look up")
    },
    async ({ facilities }) => {
      const mapped = facilities.map((f) => ({
        triId: f.tri_id,
        facilityName: f.facility_name
      }));
      const data = await fetchTriReleases(mapped);
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      return {
        content: [{ type: "text", text: formatTriReleasesForPrompt(data.details) }]
      };
    }
  );
}

// src/agents/air/tools.ts
import { z as z7 } from "zod";

// src/clients/airnow/config.ts
var AIRNOW_BASE_URL = "https://www.airnowapi.org/aq";
var AIRNOW_DEFAULTS = {
  searchRadiusMiles: 25,
  userAgent: "SpeakForTheTrees/0.2.0",
  fetchTimeoutMs: 15e3
};

// src/validations/airnow.ts
import { z as z6 } from "zod";
var airNowObservationSchema = z6.object({
  DateObserved: z6.string(),
  HourObserved: z6.number(),
  LocalTimeZone: z6.string(),
  ReportingArea: z6.string(),
  StateCode: z6.string(),
  Latitude: z6.number(),
  Longitude: z6.number(),
  ParameterName: z6.string(),
  AQI: z6.number(),
  Category: z6.object({
    Number: z6.number(),
    Name: z6.string()
  })
});
var airNowResponseSchema = z6.array(airNowObservationSchema);

// src/clients/airnow/client.ts
function getAirNowApiKey() {
  return process.env["AIRNOW_API_KEY"] ?? null;
}
async function fetchAirQuality(params) {
  const apiKey = getAirNowApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: "AirNow API key not configured. Set the AIRNOW_API_KEY environment variable. Register for a free key at https://docs.airnowapi.org/"
    };
  }
  const { latitude, longitude, radiusMiles = AIRNOW_DEFAULTS.searchRadiusMiles } = params;
  const url = new URL(`${AIRNOW_BASE_URL}/observation/latLong/current/`);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("distance", String(radiusMiles));
  url.searchParams.set("format", "application/json");
  url.searchParams.set("API_KEY", apiKey);
  let response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": AIRNOW_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(AIRNOW_DEFAULTS.fetchTimeoutMs)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }
  if (!response.ok) {
    return {
      success: false,
      error: `AirNow API error: ${response.status} ${response.statusText}`
    };
  }
  let json;
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
  const observations = parsed.data.map((o) => ({
    dateTime: `${o.DateObserved.trim()} ${String(o.HourObserved).padStart(2, "0")}:00 ${o.LocalTimeZone}`,
    reportingArea: o.ReportingArea,
    stateCode: o.StateCode,
    latitude: o.Latitude,
    longitude: o.Longitude,
    parameterName: o.ParameterName,
    aqi: o.AQI,
    category: {
      number: o.Category.Number,
      name: o.Category.Name
    }
  }));
  return { success: true, observations };
}

// src/clients/airnow/summarize.ts
var AQI_DESCRIPTIONS = {
  1: "Good (0-50): Air quality is satisfactory; little or no risk.",
  2: "Moderate (51-100): Acceptable; some pollutants may be a concern for a small number of sensitive people.",
  3: "Unhealthy for Sensitive Groups (101-150): Members of sensitive groups may experience health effects.",
  4: "Unhealthy (151-200): Everyone may begin to experience health effects.",
  5: "Very Unhealthy (201-300): Health alert; everyone may experience more serious health effects.",
  6: "Hazardous (301+): Health warnings of emergency conditions."
};
function formatAirQualityForPrompt(observations) {
  if (observations.length === 0) {
    return "No current air quality observations found near this location. This may mean no AirNow monitoring stations are within range, or the area has no active reporting.";
  }
  const parts = [
    `Current air quality observations near this location (${observations.length} reading${observations.length !== 1 ? "s" : ""}):`
  ];
  const byArea = /* @__PURE__ */ new Map();
  for (const o of observations) {
    const area = `${o.reportingArea}, ${o.stateCode}`;
    if (!byArea.has(area)) byArea.set(area, []);
    byArea.get(area).push(o);
  }
  for (const [area, readings] of byArea) {
    parts.push(`
${area}:`);
    for (const r of readings) {
      const desc = AQI_DESCRIPTIONS[r.category.number] ?? r.category.name;
      parts.push(`  - ${r.parameterName}: AQI ${r.aqi} \u2014 ${desc} (as of ${r.dateTime})`);
    }
  }
  const maxAqi = Math.max(...observations.map((o) => o.aqi));
  const worstObs = observations.find((o) => o.aqi === maxAqi);
  if (worstObs && worstObs.category.number >= 3) {
    parts.push(`
Highest AQI reading: ${worstObs.parameterName} at ${maxAqi} (${worstObs.category.name}) in ${worstObs.reportingArea}, ${worstObs.stateCode}`);
  }
  return parts.join("\n");
}

// src/agents/air/tools.ts
function registerAirTools(server2) {
  server2.tool(
    "airnow_air_quality",
    "Fetch current air quality index (AQI) readings from AirNow near a location. Returns AQI by pollutant (PM2.5, PM10, ozone, etc.) with health category ratings. Requires AIRNOW_API_KEY environment variable (free registration at https://docs.airnowapi.org/).",
    {
      latitude: z7.number().describe("Latitude of the location to investigate"),
      longitude: z7.number().describe("Longitude of the location to investigate"),
      radius_miles: z7.number().min(1).max(100).optional().describe("Search radius in miles. Default: 25")
    },
    async ({ latitude, longitude, radius_miles }) => {
      const data = await fetchAirQuality({
        latitude,
        longitude,
        radiusMiles: radius_miles ?? 25
      });
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      return {
        content: [{ type: "text", text: formatAirQualityForPrompt(data.observations) }]
      };
    }
  );
}

// src/agents/prompts.ts
import { z as z8 } from "zod";
var EPISTEMIC_GUARDRAILS = `
## Epistemic Guardrails \u2014 Critical

1. **Never claim causation without direct evidence.** Proximity or timing alone is not evidence of causation.
2. **iNaturalist observations are presence records**, not population surveys. Observation counts do not indicate population health.
3. **EPA violations are permit exceedances**, not proof of ecological harm. State the violation, its magnitude, and proximity \u2014 do not extrapolate ecological impact without water quality data showing a corresponding change.
4. **Absence of data is not evidence.** If stations have no readings, say so plainly.
5. **When you lack data, say so.** "No data available for this period" is more valuable than speculation.

## Reporting Style

- Matter-of-fact and observational. State what the data shows without editorializing.
- No dramatic language ("devastating," "alarming," "dire"). Let data speak for itself.
- Ground every claim in specific data: values, dates, station names, species names, facility names.
`;
function registerPrompts(server2) {
  server2.prompt(
    "investigate_watershed",
    "Investigation guide for water quality and hydrology. Instructs on how to use USGS and NOAA tools to establish a baseline, compare across time, and identify anomalies.",
    {
      latitude: z8.coerce.number().describe("Latitude of the location to investigate"),
      longitude: z8.coerce.number().describe("Longitude of the location to investigate")
    },
    ({ latitude, longitude }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `You are investigating watershed conditions at ${latitude}, ${longitude}.

## Tools Available
- \`usgs_water_conditions\` \u2014 USGS water quality (temperature, dissolved oxygen, pH, streamflow)
- \`noaa_tidal_conditions\` \u2014 NOAA tidal water levels and deviation from predictions

## Investigation Steps

**Step 1 \u2014 Establish a baseline**
Call \`usgs_water_conditions\` with \`days_back: 7\` to see current conditions. Note any readings that fall outside normal ranges. Call \`noaa_tidal_conditions\` with \`days_back: 2\` for recent tidal data.

**Step 2 \u2014 Compare across time**
When a value looks unusual, query the same parameter with a longer window (\`days_back: 30\` or \`days_back: 90\`) to determine whether it is anomalous or baseline. A pH of 6.8 means nothing alone \u2014 but if it was 7.4 a month ago, that is a signal.

**Step 3 \u2014 Follow anomalies**
- Water quality declining? Note the affected parameters and their trend.
- Tidal anomalies? Compare observed levels against predictions to identify storm surge or unusual deviation.
- Document which parameters are declining, over what timeframe, and at which stations.

**Step 4 \u2014 Identify what the data supports**
Summarize: what is the current state of this watershed? What trends are visible? What questions remain unanswered due to data gaps?

${EPISTEMIC_GUARDRAILS}`
        }
      }]
    })
  );
  server2.prompt(
    "investigate_biodiversity",
    "Investigation guide for species observations. Instructs on how to use iNaturalist data to assess species presence, identify threatened or invasive species, and cross-reference with ecosystem conditions.",
    {
      latitude: z8.coerce.number().describe("Latitude of the location to investigate"),
      longitude: z8.coerce.number().describe("Longitude of the location to investigate")
    },
    ({ latitude, longitude }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `You are investigating biodiversity conditions at ${latitude}, ${longitude}.

## Tools Available
- \`inaturalist_species_observations\` \u2014 Community science species presence records with taxonomy, threat status, and native/introduced flags

## Investigation Steps

**Step 1 \u2014 Establish recent presence**
Call \`inaturalist_species_observations\` with \`days_back: 30\` to see what has been observed recently. Note species with threatened or endangered status, introduced/invasive species, and any taxonomic groups that are notably absent.

**Step 2 \u2014 Look at longer trends**
Call again with \`days_back: 365\` to get a broader picture. Compare: are the same species groups appearing across time, or do recent observations differ from the annual pattern?

**Step 3 \u2014 Identify signals worth investigating**
- Threatened or endangered species present? Note their names, observation count, and dates.
- Invasive species present? Note the extent of observations.
- Notable absences for a given ecosystem type? Absence of data is not evidence of absence \u2014 flag data gaps.

**Step 4 \u2014 Connect to ecosystem context**
Biodiversity observations gain meaning when cross-referenced with watershed and pollution data. If investigating an anomaly, use the watershed or pollution investigation prompts alongside this one.

${EPISTEMIC_GUARDRAILS}`
        }
      }]
    })
  );
  server2.prompt(
    "investigate_pollution",
    "Investigation guide for EPA permit violations and impaired waters. Instructs on how to identify facilities in non-compliance, retrieve violation details, and assess regulatory status of nearby water bodies.",
    {
      latitude: z8.coerce.number().describe("Latitude of the location to investigate"),
      longitude: z8.coerce.number().describe("Longitude of the location to investigate")
    },
    ({ latitude, longitude }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `You are investigating pollution and regulatory compliance at ${latitude}, ${longitude}.

## Tools Available
- \`epa_facilities\` \u2014 All NPDES-permitted facilities with compliance summary and violation counts
- \`epa_violations\` \u2014 Facilities currently in Significant Non-Compliance (SNC)
- \`epa_violation_details\` \u2014 Specific effluent violations: parameter, exceedance amount, dates
- \`epa_impaired_waters\` \u2014 EPA 303(d) impaired waters listings with impairment causes and TMDL status

## Investigation Steps

**Step 1 \u2014 Map the regulatory landscape**
Call \`epa_facilities\` to see all permitted dischargers in the area. Note: how many facilities? What proportion are in compliance vs. violation?

**Step 2 \u2014 Identify active violations**
Call \`epa_violations\` to find facilities currently in Significant Non-Compliance. SNC means serious or repeated violations \u2014 these are the priority targets.

**Step 3 \u2014 Get violation specifics**
Pass the SNC facilities from Step 2 to \`epa_violation_details\`. This reveals: which parameters are being violated (e.g., mercury, nitrogen, pH), by what magnitude, and for how long.

**Step 4 \u2014 Check water body status**
Call \`epa_impaired_waters\` to see which water bodies are already listed under 303(d) as impaired. Note the impairment causes \u2014 if a nearby facility is discharging the same pollutant causing an impairment, that is a factual connection worth stating.

**Step 5 \u2014 Synthesize**
What facilities are violating permits? What are they discharging? Are nearby water bodies already listed as impaired for those same pollutants? State connections factually without attributing causation beyond what the data supports.

${EPISTEMIC_GUARDRAILS}`
        }
      }]
    })
  );
  server2.prompt(
    "investigate_ecosystem",
    "Full ecosystem investigation guide. Coordinates watershed, biodiversity, and pollution agents to build a complete picture of ecosystem health at a location.",
    {
      latitude: z8.coerce.number().describe("Latitude of the location to investigate"),
      longitude: z8.coerce.number().describe("Longitude of the location to investigate")
    },
    ({ latitude, longitude }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `You are conducting a full ecosystem investigation at ${latitude}, ${longitude}.

## Investigation Framework

Work through three domains in sequence, then synthesize findings across them.

---

### Domain 1: Watershed
**Tools:** \`usgs_water_conditions\`, \`noaa_tidal_conditions\`

1. Fetch \`usgs_water_conditions\` for the past 7 days. Note temperature, dissolved oxygen, pH, and streamflow readings.
2. Fetch \`noaa_tidal_conditions\` for the past 2 days if the location is near tidal water.
3. Fetch \`usgs_water_conditions\` for 90 days to identify trends.
4. Document: current conditions, any anomalies, and trends.

---

### Domain 2: Biodiversity
**Tools:** \`inaturalist_species_observations\`

1. Fetch observations for the past 30 days.
2. Note threatened or endangered species, invasive species, and dominant taxonomic groups.
3. Fetch observations for 365 days to check for seasonal or long-term patterns.
4. Document: species of note, data gaps, and any patterns worth cross-referencing.

---

### Domain 3: Pollution
**Tools:** \`epa_facilities\`, \`epa_violations\`, \`epa_violation_details\`, \`epa_impaired_waters\`

1. Fetch \`epa_facilities\` for permitted dischargers in a 10-mile radius.
2. Fetch \`epa_violations\` for facilities in Significant Non-Compliance.
3. If SNC facilities exist, fetch \`epa_violation_details\` for specifics.
4. Fetch \`epa_impaired_waters\` for the regulatory status of nearby water bodies.
5. Document: active violations, impaired waters, and any overlapping pollutants.

---

### Synthesis

After gathering data from all three domains:
- What are the current watershed conditions?
- What species are present? Any of concern?
- Are there active pollution violations? What are they discharging?
- Are nearby water bodies listed as impaired? For what causes?
- Where do findings across domains align? (e.g., a facility discharging nitrogen + a nearby water body impaired by nutrients)
- What data gaps exist that would be needed to draw stronger conclusions?

${EPISTEMIC_GUARDRAILS}`
        }
      }]
    })
  );
}

// src/server.ts
var server = new McpServer({
  name: "speak-for-the-trees",
  version: "0.2.0"
});
registerWatershedTools(server);
registerBiodiversityTools(server);
registerPollutionTools(server);
registerAirTools(server);
registerPrompts(server);
var transport = new StdioServerTransport();
await server.connect(transport);
