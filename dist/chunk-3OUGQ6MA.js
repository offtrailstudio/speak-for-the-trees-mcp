// src/clients/nldi/config.ts
var NLDI_BASE_URL = "https://api.water.usgs.gov/nldi";
var NLDI_DEFAULTS = {
  navigationDistanceKm: 50,
  navigationMode: "UT",
  userAgent: "SpeakForTheTrees/0.1.0",
  fetchTimeoutMs: 15e3
};

// src/validations/nldi.ts
import { z } from "zod";
var nldiPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()])
});
var nldiHydrolocationPropsSchema = z.object({
  identifier: z.string().optional(),
  name: z.string().optional(),
  comid: z.string().optional(),
  source: z.string().optional(),
  navigation: z.string().optional(),
  measure: z.string().optional(),
  reachcode: z.string().optional()
}).passthrough();
var nldiHydrolocationFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: nldiPointSchema.nullable(),
  properties: nldiHydrolocationPropsSchema
}).passthrough();
var nldiHydrolocationResponseSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(nldiHydrolocationFeatureSchema)
}).passthrough();
var nldiFlowlineGeometrySchema = z.object({
  type: z.enum(["LineString", "MultiLineString"]),
  coordinates: z.any()
});
var nldiFlowlinePropsSchema = z.object({
  nhdplus_comid: z.string().optional()
}).passthrough();
var nldiFlowlineFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: nldiFlowlineGeometrySchema,
  properties: nldiFlowlinePropsSchema
}).passthrough();
var nldiFlowlinesResponseSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(nldiFlowlineFeatureSchema)
}).passthrough();
var nldiBasinGeometrySchema = z.object({
  type: z.enum(["Polygon", "MultiPolygon"]),
  coordinates: z.any()
});
var nldiBasinFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: nldiBasinGeometrySchema,
  properties: z.record(z.string(), z.unknown()).optional()
}).passthrough();
var nldiBasinResponseSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(nldiBasinFeatureSchema)
}).passthrough();

// src/clients/nldi/client.ts
function fetchOptions() {
  return {
    headers: { "User-Agent": NLDI_DEFAULTS.userAgent },
    signal: AbortSignal.timeout(NLDI_DEFAULTS.fetchTimeoutMs)
  };
}
async function fetchHydrolocation(lat, lng) {
  const url = new URL(`${NLDI_BASE_URL}/linked-data/hydrolocation`);
  url.searchParams.set("coords", `POINT(${lng} ${lat})`);
  url.searchParams.set("f", "json");
  let response;
  try {
    response = await fetch(url.toString(), fetchOptions());
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }
  if (!response.ok) {
    return {
      success: false,
      error: `NLDI API error: ${response.status} ${response.statusText}`
    };
  }
  let json;
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
      error: `Validation error: ${parsed.error.message}`
    };
  }
  const feature = parsed.data.features.find(
    (f) => f.properties.source === "indexed"
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
      lng: coords ? coords[0] : lng
    }
  };
}
async function fetchUpstreamStations(comid, distanceKm = NLDI_DEFAULTS.navigationDistanceKm) {
  return fetchStationsByNavigation(comid, "UT", distanceKm);
}
async function fetchDownstreamStations(comid, distanceKm = NLDI_DEFAULTS.navigationDistanceKm) {
  return fetchStationsByNavigation(comid, "DM", distanceKm);
}
async function fetchStationsByNavigation(comid, navigationMode, distanceKm = NLDI_DEFAULTS.navigationDistanceKm) {
  const url = new URL(
    `${NLDI_BASE_URL}/linked-data/comid/${comid}/navigation/${navigationMode}/nwissite`
  );
  url.searchParams.set("distance", String(distanceKm));
  url.searchParams.set("f", "json");
  let response;
  try {
    response = await fetch(url.toString(), fetchOptions());
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }
  if (!response.ok) {
    return {
      success: false,
      error: `NLDI stations error: ${response.status} ${response.statusText}`
    };
  }
  let json;
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
      error: `Validation error: ${parsed.error.message}`
    };
  }
  const stations = parsed.data.features.filter((f) => f.geometry !== null && f.properties.identifier).map((f) => ({
    id: f.properties.identifier,
    name: f.properties.name || f.properties.identifier,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0]
  }));
  return { success: true, stations };
}

// src/clients/noaa-tides/config.ts
var NOAA_TIDES_BASE_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
var STATION_ID = "8518962";
var NOAA_TIDES_DEFAULTS = {
  defaultDaysBack: 2,
  maxDaysBack: 7,
  datum: "MLLW",
  units: "metric",
  timeZone: "gmt",
  application: "speak-for-the-trees",
  fetchTimeoutMs: 15e3
};

// src/validations/noaa-tides.ts
import { z as z2 } from "zod";
var noaaWaterLevelReadingSchema = z2.object({
  t: z2.string(),
  v: z2.string(),
  s: z2.string(),
  f: z2.string(),
  q: z2.string()
}).passthrough();
var noaaWaterLevelResponseSchema = z2.object({
  data: z2.array(noaaWaterLevelReadingSchema)
});
var noaaPredictionReadingSchema = z2.object({
  t: z2.string(),
  v: z2.string()
}).passthrough();
var noaaPredictionResponseSchema = z2.object({
  predictions: z2.array(noaaPredictionReadingSchema)
});
var noaaErrorResponseSchema = z2.object({
  error: z2.object({
    message: z2.string()
  })
});
var noaaStationSchema = z2.object({
  id: z2.string(),
  name: z2.string(),
  lat: z2.number(),
  lng: z2.number(),
  state: z2.string().nullable().optional(),
  tidal: z2.boolean().optional()
}).passthrough();
var noaaStationsResponseSchema = z2.object({
  count: z2.number(),
  stations: z2.array(noaaStationSchema)
});

// src/clients/noaa-tides/client.ts
function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}${month}${day} ${hours}:${minutes}`;
}
function buildUrl(product, station, beginDate, endDate) {
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
async function fetchProduct(url, label) {
  let response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(NOAA_TIDES_DEFAULTS.fetchTimeoutMs)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error fetching ${label}: ${message}` };
  }
  if (!response.ok) {
    return {
      success: false,
      error: `NOAA API error for ${label}: ${response.status} ${response.statusText}`
    };
  }
  let json;
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
      error: `NOAA API error for ${label}: ${errorParsed.data.error.message}`
    };
  }
  return { success: true, json };
}
async function fetchTidalData(params = {}) {
  const {
    daysBack = NOAA_TIDES_DEFAULTS.defaultDaysBack,
    station = STATION_ID
  } = params;
  let resolvedStart;
  let resolvedEnd;
  if (params.startDate) {
    resolvedStart = params.startDate;
    resolvedEnd = params.endDate ?? /* @__PURE__ */ new Date();
  } else {
    const clampedDays = Math.min(
      Math.max(1, daysBack),
      NOAA_TIDES_DEFAULTS.maxDaysBack
    );
    resolvedEnd = /* @__PURE__ */ new Date();
    resolvedStart = new Date(resolvedEnd);
    resolvedStart.setDate(resolvedEnd.getDate() - clampedDays);
  }
  const beginStr = formatDate(resolvedStart);
  const endStr = formatDate(resolvedEnd);
  const waterLevelUrl = buildUrl("water_level", station, beginStr, endStr);
  const predictionsUrl = buildUrl("predictions", station, beginStr, endStr);
  const [waterLevelResult, predictionsResult] = await Promise.all([
    fetchProduct(waterLevelUrl, "water_level"),
    fetchProduct(predictionsUrl, "predictions")
  ]);
  if (!waterLevelResult.success && !predictionsResult.success) {
    return {
      success: false,
      error: `${waterLevelResult.error}; ${predictionsResult.error}`
    };
  }
  let observations = [];
  if (waterLevelResult.success) {
    const parsed = noaaWaterLevelResponseSchema.safeParse(waterLevelResult.json);
    if (parsed.success) {
      observations = parsed.data.data.map((d) => ({
        time: d.t,
        value: parseFloat(d.v),
        sigma: parseFloat(d.s),
        flags: d.f,
        quality: d.q
      }));
    }
  }
  let predictions = [];
  if (predictionsResult.success) {
    const parsed = noaaPredictionResponseSchema.safeParse(predictionsResult.json);
    if (parsed.success) {
      predictions = parsed.data.predictions.map((p) => ({
        time: p.t,
        value: parseFloat(p.v)
      }));
    }
  }
  return {
    success: true,
    observations,
    predictions,
    station
  };
}
var NOAA_METADATA_BASE_URL = "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi";
async function fetchNoaaStations() {
  const url = `${NOAA_METADATA_BASE_URL}/stations.json`;
  let response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(NOAA_TIDES_DEFAULTS.fetchTimeoutMs)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }
  if (!response.ok) {
    return {
      success: false,
      error: `NOAA Metadata API error: ${response.status} ${response.statusText}`
    };
  }
  let json;
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
      error: `Validation error: ${parsed.error.message}`
    };
  }
  const stations = parsed.data.stations.map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    state: s.state ?? null,
    tidal: s.tidal ?? false
  }));
  return { success: true, stations };
}

// src/clients/usgs-water/config.ts
var USGS_WATER_BASE_URL = "https://api.waterdata.usgs.gov/ogcapi/v0";
var MONITORING_LOCATIONS = ["USGS-01372043"];
var PARAMETER_CODES = {
  "00010": "Water Temperature",
  "00060": "Streamflow/Discharge",
  "00065": "Gage Height",
  "00300": "Dissolved Oxygen",
  "00400": "pH"
};
var USGS_WATER_DEFAULTS = {
  defaultDaysBack: 7,
  limit: 1e3,
  maxLimit: 1e4,
  userAgent: "SpeakForTheTrees/0.1.0",
  fetchTimeoutMs: 15e3
};

// src/validations/usgs-water.ts
import { z as z3 } from "zod";
var usgsPointSchema = z3.object({
  type: z3.literal("Point"),
  coordinates: z3.tuple([z3.number(), z3.number()])
});
var usgsFeaturePropertiesSchema = z3.object({
  monitoring_location_id: z3.string(),
  parameter_code: z3.string(),
  parameter_name: z3.string().optional(),
  value: z3.string(),
  unit_of_measure: z3.string(),
  time: z3.string(),
  approval_status: z3.string().optional(),
  qualifier: z3.string().nullable().optional()
}).passthrough();
var usgsFeatureSchema = z3.object({
  type: z3.literal("Feature"),
  properties: usgsFeaturePropertiesSchema,
  geometry: usgsPointSchema.nullable()
}).passthrough();
var usgsResponseSchema = z3.object({
  type: z3.literal("FeatureCollection"),
  features: z3.array(usgsFeatureSchema),
  numberReturned: z3.number()
}).passthrough();
var usgsMonitoringLocationPropsSchema = z3.object({
  id: z3.string(),
  monitoring_location_name: z3.string().optional()
}).passthrough();
var usgsMonitoringLocationFeatureSchema = z3.object({
  type: z3.literal("Feature"),
  properties: usgsMonitoringLocationPropsSchema,
  geometry: usgsPointSchema.nullable()
}).passthrough();
var usgsMonitoringLocationsResponseSchema = z3.object({
  type: z3.literal("FeatureCollection"),
  features: z3.array(usgsMonitoringLocationFeatureSchema),
  numberReturned: z3.number()
}).passthrough();

// src/clients/usgs-water/client.ts
async function fetchWaterData(params = {}) {
  const {
    daysBack = USGS_WATER_DEFAULTS.defaultDaysBack,
    limit = USGS_WATER_DEFAULTS.limit,
    parameterCodes = Object.keys(PARAMETER_CODES),
    monitoringLocationIds = MONITORING_LOCATIONS
  } = params;
  const clampedLimit = Math.min(
    Math.max(1, limit),
    USGS_WATER_DEFAULTS.maxLimit
  );
  let resolvedStart;
  let resolvedEnd;
  if (params.startDate) {
    resolvedStart = params.startDate;
    resolvedEnd = params.endDate ?? /* @__PURE__ */ new Date();
  } else {
    resolvedEnd = /* @__PURE__ */ new Date();
    resolvedStart = new Date(resolvedEnd);
    resolvedStart.setDate(resolvedEnd.getDate() - daysBack);
  }
  const start = resolvedStart.toISOString();
  const end = resolvedEnd.toISOString();
  const url = new URL(
    `${USGS_WATER_BASE_URL}/collections/latest-continuous/items`
  );
  url.searchParams.set(
    "monitoring_location_id",
    monitoringLocationIds.join(",")
  );
  url.searchParams.set("parameter_code", parameterCodes.join(","));
  url.searchParams.set("datetime", `${start}/${end}`);
  url.searchParams.set("limit", String(clampedLimit));
  url.searchParams.set("f", "json");
  let response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": USGS_WATER_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(USGS_WATER_DEFAULTS.fetchTimeoutMs)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }
  if (!response.ok) {
    return {
      success: false,
      error: `USGS API error: ${response.status} ${response.statusText}`
    };
  }
  let json;
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
      error: `Validation error: ${parsed.error.message}`
    };
  }
  const readings = parsed.data.features.map((feature) => {
    const props = feature.properties;
    const code = props.parameter_code;
    return {
      parameterCode: code,
      parameterName: props.parameter_name ?? PARAMETER_CODES[code] ?? code,
      value: parseFloat(props.value),
      unit: props.unit_of_measure,
      time: props.time,
      locationId: props.monitoring_location_id
    };
  });
  return {
    success: true,
    readings,
    totalResults: parsed.data.numberReturned
  };
}
async function fetchMonitoringLocations(bounds) {
  const bbox = `${bounds.swlng},${bounds.swlat},${bounds.nelng},${bounds.nelat}`;
  const url = new URL(
    `${USGS_WATER_BASE_URL}/collections/monitoring-locations/items`
  );
  url.searchParams.set("bbox", bbox);
  url.searchParams.set("limit", "500");
  url.searchParams.set("f", "json");
  let response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": USGS_WATER_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(USGS_WATER_DEFAULTS.fetchTimeoutMs)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }
  if (!response.ok) {
    return {
      success: false,
      error: `USGS API error: ${response.status} ${response.statusText}`
    };
  }
  let json;
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
      error: `Validation error: ${parsed.error.message}`
    };
  }
  const stations = parsed.data.features.filter((f) => f.geometry !== null).map((f) => ({
    id: f.properties.id,
    name: f.properties.monitoring_location_name ?? f.properties.id,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1]
  }));
  return { success: true, stations };
}
async function filterActiveStations(stationIds) {
  if (stationIds.length === 0) return [];
  const url = new URL(
    `${USGS_WATER_BASE_URL}/collections/time-series-metadata/items`
  );
  url.searchParams.set("monitoring_location_id", stationIds.join(","));
  url.searchParams.set("computation_identifier", "Instantaneous");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("f", "json");
  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": USGS_WATER_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(USGS_WATER_DEFAULTS.fetchTimeoutMs)
    });
    if (!response.ok) return stationIds;
    const json = await response.json();
    if (typeof json !== "object" || json === null || !("features" in json) || !Array.isArray(json.features)) {
      return stationIds;
    }
    const features = json.features;
    const activeIds = new Set(
      features.map((f) => f.properties?.monitoring_location_id).filter((id) => typeof id === "string")
    );
    const filtered = stationIds.filter((id) => activeIds.has(id));
    return filtered.length > 0 ? filtered : stationIds;
  } catch {
    return stationIds;
  }
}

// src/utils/geo.ts
var EARTH_RADIUS_KM = 6371;
function haversineDistance(a, b) {
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function bboxFromCenter(center, radiusKm) {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos(center.lat * Math.PI / 180));
  return {
    swlat: center.lat - latDelta,
    swlng: center.lng - lngDelta,
    nelat: center.lat + latDelta,
    nelng: center.lng + lngDelta
  };
}
function findNearest(items, point, n) {
  return items.map((item) => ({
    item,
    distance: haversineDistance(point, { lat: item.lat, lng: item.lng })
  })).sort((a, b) => a.distance - b.distance).slice(0, n).map((entry) => entry.item);
}

// src/resolve-location.ts
var cachedNoaaStations = null;
async function resolveLocation(latitude, longitude) {
  const hydroResult = await fetchHydrolocation(latitude, longitude);
  const center = { lat: latitude, lng: longitude };
  let comid;
  let streamName = "Unknown waterway";
  if (hydroResult.success) {
    comid = hydroResult.hydrolocation.comid;
    streamName = hydroResult.hydrolocation.name ?? "Unknown waterway";
  }
  let usgsStationIds = [];
  if (comid) {
    const stationsResult = await fetchUpstreamStations(comid, 50);
    if (stationsResult.success && stationsResult.stations.length > 0) {
      const allIds = stationsResult.stations.map((s) => s.id);
      usgsStationIds = await filterActiveStations(allIds);
    }
  }
  let noaaStationId = "";
  if (!cachedNoaaStations) {
    const noaaResult = await fetchNoaaStations();
    if (noaaResult.success) {
      cachedNoaaStations = noaaResult.stations;
    }
  }
  if (cachedNoaaStations) {
    const nearest = findNearest(cachedNoaaStations, center, 1);
    if (nearest.length > 0) {
      noaaStationId = nearest[0].id;
    }
  }
  const bounds = bboxFromCenter(center, 10);
  return {
    slug: `${latitude.toFixed(2)}-${longitude.toFixed(2)}`,
    name: streamName,
    description: `area near ${latitude.toFixed(4)}\xB0N, ${Math.abs(longitude).toFixed(4)}\xB0${longitude >= 0 ? "E" : "W"}`,
    bounds,
    center,
    usgsStationIds,
    noaaStationId,
    comid
  };
}

// src/utils/time.ts
var PERIOD_DAYS = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365
};
function resolveTimeRange(input) {
  if (!input) {
    const endDate2 = /* @__PURE__ */ new Date();
    const startDate2 = /* @__PURE__ */ new Date();
    startDate2.setDate(endDate2.getDate() - 7);
    return { startDate: startDate2, endDate: endDate2, daysBack: 7 };
  }
  const endDate = input.end_date ? new Date(input.end_date) : /* @__PURE__ */ new Date();
  if (input.start_date) {
    const startDate2 = new Date(input.start_date);
    const daysBack2 = Math.ceil(
      (endDate.getTime() - startDate2.getTime()) / (1e3 * 60 * 60 * 24)
    );
    return { startDate: startDate2, endDate, daysBack: daysBack2 };
  }
  if (input.period) {
    const days = PERIOD_DAYS[input.period] ?? 7;
    const startDate2 = new Date(endDate);
    startDate2.setDate(endDate.getDate() - days);
    return { startDate: startDate2, endDate, daysBack: days };
  }
  const daysBack = input.days_back ?? 7;
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - daysBack);
  return { startDate, endDate, daysBack };
}

// src/clients/usgs-water/summarize.ts
var PARAMETER_THRESHOLDS = {
  "00010": {
    range: [0, 32],
    unit: "\xB0C",
    belowNote: "Below freezing \u2014 ice formation possible",
    aboveNote: "Above 32\xB0C is stressful for most freshwater species; above 25\xB0C reduces dissolved oxygen capacity",
    source: "EPA freshwater temperature guidance"
  },
  "00300": {
    range: [5, 14],
    unit: "mg/L",
    belowNote: "Below 5 mg/L is stressful for most aquatic life; below 2 mg/L can cause fish kills",
    aboveNote: "Supersaturation above ~14 mg/L may indicate algal bloom or measurement artifact",
    source: "EPA aquatic life criterion (freshwater)"
  },
  "00400": {
    range: [6.5, 9],
    unit: "standard units",
    belowNote: "Below 6.5 is acidic \u2014 harmful to many aquatic organisms",
    aboveNote: "Above 9.0 is alkaline \u2014 can be toxic to aquatic life",
    source: "EPA freshwater pH criterion"
  }
};
function assessParameter(code, _avg, min, max) {
  const threshold = PARAMETER_THRESHOLDS[code];
  if (!threshold) return null;
  const [lo, hi] = threshold.range;
  const notes = [];
  if (min < lo) {
    notes.push(threshold.belowNote);
  }
  if (max > hi) {
    notes.push(threshold.aboveNote);
  }
  if (notes.length === 0) {
    return `Within EPA reference range (${lo}\u2013${hi} ${threshold.unit}). ${threshold.source}.`;
  }
  return `EPA reference range: ${lo}\u2013${hi} ${threshold.unit}. ${notes.join(". ")}. ${threshold.source}.`;
}
function formatWaterDataForPrompt(readings, period) {
  if (readings.length === 0) return "";
  const grouped = /* @__PURE__ */ new Map();
  for (const reading of readings) {
    const key = reading.parameterCode;
    const existing = grouped.get(key) ?? [];
    existing.push(reading);
    grouped.set(key, existing);
  }
  const sections = [];
  for (const [code, paramReadings] of grouped) {
    const name = PARAMETER_CODES[code] ?? code;
    const sorted = paramReadings.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );
    const latest = sorted[0];
    const values = sorted.map((r) => r.value).filter((v) => !isNaN(v));
    if (values.length === 0) continue;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    let line = `- ${name} (${code}): latest ${latest.value} ${latest.unit} at ${latest.time} | range ${min.toFixed(2)}\u2013${max.toFixed(2)} | avg ${avg.toFixed(2)} | ${values.length} readings`;
    const assessment = assessParameter(code, avg, min, max);
    if (assessment) {
      line += `
  Assessment: ${assessment}`;
    }
    sections.push(line);
  }
  return `Water conditions data from the past ${period} (${readings.length} total readings). NOTE: Readings are from USGS monitoring stations and reflect conditions at the sensor location. Streamflow and gage height have no universal "good/bad" threshold \u2014 they vary by waterway, season, and historical norms for that station.
${sections.join("\n")}`;
}

// src/clients/inaturalist/config.ts
var INATURALIST_BASE_URL = "https://api.inaturalist.org/v1";
var INATURALIST_DEFAULTS = {
  perPage: 30,
  maxPerPage: 200,
  defaultDaysBack: 30,
  userAgent: "SpeakForTheTrees/0.1.0",
  fetchTimeoutMs: 15e3
};

// src/validations/inaturalist.ts
import { z as z4 } from "zod";
var iNatPhotoSchema = z4.object({
  id: z4.number(),
  url: z4.string(),
  attribution: z4.string(),
  license_code: z4.string().nullable()
}).passthrough();
var iNatTaxonSchema = z4.object({
  id: z4.number(),
  name: z4.string(),
  rank: z4.string(),
  iconic_taxon_name: z4.string().nullable(),
  preferred_common_name: z4.string().optional(),
  ancestry: z4.string().nullable(),
  wikipedia_url: z4.string().nullable(),
  threatened: z4.boolean().optional().default(false),
  native: z4.boolean().optional().default(false),
  introduced: z4.boolean().optional().default(false)
}).passthrough();
var iNatUserSchema = z4.object({
  id: z4.number(),
  login: z4.string(),
  name: z4.string().nullable()
}).passthrough();
var iNatObservationSchema = z4.object({
  id: z4.number(),
  uuid: z4.string(),
  species_guess: z4.string().nullable(),
  taxon: iNatTaxonSchema.nullable(),
  observed_on: z4.string(),
  time_observed_at: z4.string().nullable(),
  location: z4.string().nullable(),
  place_guess: z4.string().nullable(),
  quality_grade: z4.enum(["research", "needs_id", "casual"]),
  uri: z4.string(),
  photos: z4.array(iNatPhotoSchema),
  user: iNatUserSchema
}).passthrough();
var iNatResponseSchema = z4.object({
  total_results: z4.number(),
  page: z4.number(),
  per_page: z4.number(),
  results: z4.array(iNatObservationSchema)
});

// src/clients/inaturalist/client.ts
async function fetchObservations(params = {}) {
  const {
    daysBack = INATURALIST_DEFAULTS.defaultDaysBack,
    perPage = INATURALIST_DEFAULTS.perPage,
    page = 1,
    bounds
  } = params;
  if (!bounds) {
    return { success: false, error: "Bounds are required for species observations" };
  }
  const clampedPerPage = Math.min(
    Math.max(1, perPage),
    INATURALIST_DEFAULTS.maxPerPage
  );
  let resolvedStart;
  let resolvedEnd;
  if (params.startDate) {
    resolvedStart = params.startDate;
    resolvedEnd = params.endDate ?? /* @__PURE__ */ new Date();
  } else {
    resolvedEnd = /* @__PURE__ */ new Date();
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
  let response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": INATURALIST_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(INATURALIST_DEFAULTS.fetchTimeoutMs)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }
  if (!response.ok) {
    return {
      success: false,
      error: `iNaturalist API error: ${response.status} ${response.statusText}`
    };
  }
  let json;
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
    perPage: parsed.data.per_page
  };
}

// src/clients/inaturalist/summarize.ts
function formatObservationsForPrompt(observations, period) {
  if (observations.length === 0) return "";
  const lines = observations.map((obs) => {
    const name = obs.taxon ? `${obs.taxon.preferred_common_name ?? obs.taxon.name} (${obs.taxon.name})` : obs.species_guess ?? "Unidentified";
    const flags = [];
    if (obs.taxon?.threatened) flags.push("THREATENED");
    if (obs.taxon?.introduced) flags.push("INTRODUCED");
    if (obs.taxon?.native) flags.push("native");
    const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
    return `- ${name}${flagStr} | ${obs.observed_on} | ${obs.quality_grade} | ${obs.place_guess ?? "unknown location"}`;
  });
  return `Species observations from the past ${period} (${observations.length} records). NOTE: These are community science observations from iNaturalist \u2014 they indicate species presence at a point in time, not population size, abundance, or ecosystem health. Observation counts reflect observer effort, not species prevalence.
${lines.join("\n")}`;
}

// src/clients/noaa-tides/summarize.ts
function formatTidalDataForPrompt(data, period) {
  const parts = [];
  if (data.observations.length > 0) {
    const values = data.observations.map((o) => o.value).filter((v) => !isNaN(v));
    if (values.length > 0) {
      const sorted = [...data.observations].filter((o) => !isNaN(o.value)).sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      const latest = sorted[0];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;
      parts.push(
        `Tidal water levels from the past ${period} (${values.length} observations, MLLW datum, meters):`
      );
      parts.push(
        `- Latest: ${latest.value.toFixed(3)} m at ${latest.time}`
      );
      parts.push(
        `- Range: ${min.toFixed(3)} m to ${max.toFixed(3)} m (${range.toFixed(3)} m tidal range)`
      );
    }
  }
  if (data.predictions.length > 0) {
    const predValues = data.predictions.map((p) => p.value).filter((v) => !isNaN(v));
    if (predValues.length > 0) {
      const highTide = data.predictions.reduce(
        (max, p) => p.value > max.value ? p : max
      );
      const lowTide = data.predictions.reduce(
        (min, p) => p.value < min.value ? p : min
      );
      parts.push(
        `Tide predictions for the same period (${predValues.length} predictions):`
      );
      parts.push(
        `- Next high tide peak: ${highTide.value.toFixed(3)} m at ${highTide.time}`
      );
      parts.push(
        `- Next low tide trough: ${lowTide.value.toFixed(3)} m at ${lowTide.time}`
      );
    }
    if (data.observations.length > 0) {
      const latestObs = [...data.observations].filter((o) => !isNaN(o.value)).sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      )[0];
      if (latestObs) {
        const latestObsTime = new Date(latestObs.time).getTime();
        const nearest = data.predictions.reduce((closest, p) => {
          const diff = Math.abs(
            new Date(p.time).getTime() - latestObsTime
          );
          const closestDiff = Math.abs(
            new Date(closest.time).getTime() - latestObsTime
          );
          return diff < closestDiff ? p : closest;
        });
        const deviation = latestObs.value - nearest.value;
        const direction = deviation >= 0 ? "above" : "below";
        parts.push(
          `- Current deviation from predicted level: ${Math.abs(deviation).toFixed(3)} m ${direction} predicted`
        );
      }
    }
  }
  if (parts.length === 0) return "";
  return parts.join("\n");
}

// src/clients/epa-echo/config.ts
var EPA_ECHO_BASE_URL = "https://echodata.epa.gov/echo";
var EPA_ECHO_DEFAULTS = {
  searchRadiusMiles: 10,
  responseset: 100,
  userAgent: "SpeakForTheTrees/0.1.0",
  fetchTimeoutMs: 15e3
};

// src/validations/epa-echo.ts
import { z as z5 } from "zod";
var echoFacilitySchema = z5.object({
  CWPName: z5.string(),
  SourceID: z5.string(),
  CWPStreet: z5.string().nullable().optional(),
  CWPCity: z5.string().nullable().optional(),
  CWPState: z5.string().nullable().optional(),
  CWPZip: z5.string().nullable().optional(),
  CWPCounty: z5.string().nullable().optional(),
  MasterExternalPermitNmbr: z5.string().nullable().optional(),
  CWPPermitStatusDesc: z5.string().nullable().optional(),
  FacLat: z5.string().nullable().optional(),
  FacLong: z5.string().nullable().optional(),
  CWPActualAverageFlowNmbr: z5.string().nullable().optional(),
  EPASystem: z5.string().nullable().optional(),
  Statute: z5.string().nullable().optional()
}).passthrough();
var echoGetFacilitiesResponseSchema = z5.object({
  Results: z5.object({
    Message: z5.string(),
    QueryID: z5.string(),
    QueryRows: z5.string(),
    SVRows: z5.union([z5.string(), z5.number()]).optional(),
    CVRows: z5.union([z5.string(), z5.number()]).optional(),
    V3Rows: z5.union([z5.string(), z5.number()]).optional(),
    FEARows: z5.union([z5.string(), z5.number()]).optional(),
    InfFEARows: z5.union([z5.string(), z5.number()]).optional(),
    INSPRows: z5.union([z5.string(), z5.number()]).optional(),
    VioLast4QRows: z5.union([z5.string(), z5.number()]).optional(),
    TotalPenalties: z5.string().nullable().optional()
  }).passthrough()
}).passthrough();
var echoEffluentParameterSchema = z5.object({
  ParameterName: z5.string(),
  DischargePoint: z5.string().nullable().optional(),
  Qtr1Status: z5.string().nullable().optional(),
  Qtr2Status: z5.string().nullable().optional(),
  Qtr3Status: z5.string().nullable().optional(),
  Qtr4Status: z5.string().nullable().optional(),
  Qtr5Status: z5.string().nullable().optional(),
  Qtr6Status: z5.string().nullable().optional(),
  Qtr7Status: z5.string().nullable().optional(),
  Qtr8Status: z5.string().nullable().optional(),
  Qtr9Status: z5.string().nullable().optional(),
  Qtr10Status: z5.string().nullable().optional(),
  Qtr11Status: z5.string().nullable().optional(),
  Qtr12Status: z5.string().nullable().optional(),
  Qtr13Status: z5.string().nullable().optional(),
  Qtr1Value: z5.string().nullable().optional(),
  Qtr2Value: z5.string().nullable().optional(),
  Qtr3Value: z5.string().nullable().optional(),
  Qtr4Value: z5.string().nullable().optional(),
  Qtr5Value: z5.string().nullable().optional(),
  Qtr6Value: z5.string().nullable().optional(),
  Qtr7Value: z5.string().nullable().optional(),
  Qtr8Value: z5.string().nullable().optional(),
  Qtr9Value: z5.string().nullable().optional(),
  Qtr10Value: z5.string().nullable().optional(),
  Qtr11Value: z5.string().nullable().optional(),
  Qtr12Value: z5.string().nullable().optional(),
  Qtr13Value: z5.string().nullable().optional()
}).passthrough();
var echoEffluentHeaderSchema = z5.object({
  Qtr1Start: z5.string().optional(),
  Qtr1End: z5.string().optional(),
  Qtr2Start: z5.string().optional(),
  Qtr2End: z5.string().optional(),
  Qtr3Start: z5.string().optional(),
  Qtr3End: z5.string().optional(),
  Qtr4Start: z5.string().optional(),
  Qtr4End: z5.string().optional(),
  Qtr5Start: z5.string().optional(),
  Qtr5End: z5.string().optional(),
  Qtr6Start: z5.string().optional(),
  Qtr6End: z5.string().optional(),
  Qtr7Start: z5.string().optional(),
  Qtr7End: z5.string().optional(),
  Qtr8Start: z5.string().optional(),
  Qtr8End: z5.string().optional(),
  Qtr9Start: z5.string().optional(),
  Qtr9End: z5.string().optional(),
  Qtr10Start: z5.string().optional(),
  Qtr10End: z5.string().optional(),
  Qtr11Start: z5.string().optional(),
  Qtr11End: z5.string().optional(),
  Qtr12Start: z5.string().optional(),
  Qtr12End: z5.string().optional(),
  Qtr13Start: z5.string().optional(),
  Qtr13End: z5.string().optional()
}).passthrough();
var echoEffluentComplianceResponseSchema = z5.object({
  Results: z5.object({
    CWAEffluentCompliance: z5.object({
      Header: echoEffluentHeaderSchema,
      Sources: z5.array(
        z5.object({
          Parameters: z5.array(echoEffluentParameterSchema).optional()
        }).passthrough()
      ).optional()
    }).passthrough()
  }).passthrough()
}).passthrough();
var echoGetQidResponseSchema = z5.object({
  Results: z5.object({
    Message: z5.string(),
    QueryRows: z5.string(),
    QueryID: z5.string(),
    PageNo: z5.string().optional(),
    Facilities: z5.array(echoFacilitySchema)
  }).passthrough()
}).passthrough();

// src/clients/epa-echo/client.ts
function toNumber(value) {
  if (value == null) return 0;
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  return isNaN(n) ? 0 : n;
}
async function fetchEchoFacilities(params = {}) {
  const {
    radiusMiles = EPA_ECHO_DEFAULTS.searchRadiusMiles,
    center = { lat: 42.04, lng: -73.91 }
  } = params;
  const clampedRadius = Math.min(Math.max(1, radiusMiles), 100);
  const facilitiesUrl = new URL(
    `${EPA_ECHO_BASE_URL}/cwa_rest_services.get_facilities`
  );
  facilitiesUrl.searchParams.set("output", "JSON");
  facilitiesUrl.searchParams.set("p_lat", String(center.lat));
  facilitiesUrl.searchParams.set("p_long", String(center.lng));
  facilitiesUrl.searchParams.set("p_radius", String(clampedRadius));
  facilitiesUrl.searchParams.set("p_act", "Y");
  let facilitiesResponse;
  try {
    facilitiesResponse = await fetch(facilitiesUrl.toString(), {
      headers: { "User-Agent": EPA_ECHO_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(EPA_ECHO_DEFAULTS.fetchTimeoutMs)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }
  if (!facilitiesResponse.ok) {
    return {
      success: false,
      error: `EPA ECHO API error: ${facilitiesResponse.status} ${facilitiesResponse.statusText}`
    };
  }
  let facilitiesJson;
  try {
    facilitiesJson = await facilitiesResponse.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `EPA ECHO response parse error: ${message}` };
  }
  const facilitiesParsed = echoGetFacilitiesResponseSchema.safeParse(facilitiesJson);
  if (!facilitiesParsed.success) {
    return {
      success: false,
      error: `Validation error: ${facilitiesParsed.error.message}`
    };
  }
  const { Results: stats } = facilitiesParsed.data;
  const qid = stats.QueryID;
  const totalFacilities = toNumber(stats.QueryRows);
  const complianceSummary = {
    totalFacilities,
    significantViolations: toNumber(stats.SVRows),
    currentViolations: toNumber(stats.CVRows),
    violationsLast4Quarters: toNumber(stats.VioLast4QRows),
    formalEnforcementActions: toNumber(stats.FEARows),
    inspections: toNumber(stats.INSPRows),
    totalPenalties: stats.TotalPenalties ?? null
  };
  if (totalFacilities === 0) {
    return {
      success: true,
      facilities: [],
      complianceSummary,
      totalResults: 0
    };
  }
  const qidUrl = new URL(
    `${EPA_ECHO_BASE_URL}/cwa_rest_services.get_qid`
  );
  qidUrl.searchParams.set("output", "JSON");
  qidUrl.searchParams.set("qid", qid);
  qidUrl.searchParams.set("pageno", "1");
  qidUrl.searchParams.set(
    "responseset",
    String(EPA_ECHO_DEFAULTS.responseset)
  );
  qidUrl.searchParams.set("qcolumns", "24,25");
  let qidResponse;
  try {
    qidResponse = await fetch(qidUrl.toString(), {
      headers: { "User-Agent": EPA_ECHO_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(EPA_ECHO_DEFAULTS.fetchTimeoutMs)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }
  if (!qidResponse.ok) {
    return {
      success: false,
      error: `EPA ECHO API error: ${qidResponse.status} ${qidResponse.statusText}`
    };
  }
  let qidJson;
  try {
    qidJson = await qidResponse.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `EPA ECHO response parse error: ${message}` };
  }
  const qidParsed = echoGetQidResponseSchema.safeParse(qidJson);
  if (!qidParsed.success) {
    return {
      success: false,
      error: `Validation error: ${qidParsed.error.message}`
    };
  }
  const facilities = qidParsed.data.Results.Facilities.map(
    (raw) => {
      const lat = raw.FacLat ? parseFloat(raw.FacLat) : null;
      const lng = raw.FacLong ? parseFloat(raw.FacLong) : null;
      return {
        facilityName: raw.CWPName,
        sourceId: raw.SourceID,
        npdesId: raw.MasterExternalPermitNmbr ?? null,
        permitStatus: raw.CWPPermitStatusDesc ?? null,
        city: raw.CWPCity ?? null,
        state: raw.CWPState ?? null,
        county: raw.CWPCounty ?? null,
        latitude: lat !== null && !isNaN(lat) ? lat : null,
        longitude: lng !== null && !isNaN(lng) ? lng : null
      };
    }
  );
  return {
    success: true,
    facilities,
    complianceSummary,
    totalResults: totalFacilities
  };
}
async function fetchSncFacilityIds(center, radiusMiles = EPA_ECHO_DEFAULTS.searchRadiusMiles) {
  const url = new URL(
    `${EPA_ECHO_BASE_URL}/cwa_rest_services.get_facilities`
  );
  url.searchParams.set("output", "JSON");
  url.searchParams.set("p_lat", String(center.lat));
  url.searchParams.set("p_long", String(center.lng));
  url.searchParams.set("p_radius", String(radiusMiles));
  url.searchParams.set("p_act", "Y");
  url.searchParams.set("p_pccs", "SNC");
  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": EPA_ECHO_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(EPA_ECHO_DEFAULTS.fetchTimeoutMs)
    });
    if (!response.ok) return [];
    const json = await response.json();
    const parsed = echoGetFacilitiesResponseSchema.safeParse(json);
    if (!parsed.success) return [];
    const totalRows = toNumber(parsed.data.Results.QueryRows);
    if (totalRows === 0) return [];
    const qid = parsed.data.Results.QueryID;
    const qidUrl = new URL(
      `${EPA_ECHO_BASE_URL}/cwa_rest_services.get_qid`
    );
    qidUrl.searchParams.set("output", "JSON");
    qidUrl.searchParams.set("qid", qid);
    qidUrl.searchParams.set("pageno", "1");
    qidUrl.searchParams.set("responseset", String(EPA_ECHO_DEFAULTS.responseset));
    const qidResponse = await fetch(qidUrl.toString(), {
      headers: { "User-Agent": EPA_ECHO_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(EPA_ECHO_DEFAULTS.fetchTimeoutMs)
    });
    if (!qidResponse.ok) return [];
    const qidJson = await qidResponse.json();
    const qidParsed = echoGetQidResponseSchema.safeParse(qidJson);
    if (!qidParsed.success) return [];
    return qidParsed.data.Results.Facilities.map((f) => ({
      sourceId: f.SourceID,
      facilityName: f.CWPName
    }));
  } catch {
    return [];
  }
}
function parseExceedancePercent(value) {
  const match = value.match(/^(\d+(?:\.\d+)?)%$/);
  return match ? parseFloat(match[1]) : null;
}
async function fetchSingleFacilityViolations(sourceId, facilityName) {
  const url = new URL(
    `${EPA_ECHO_BASE_URL}/dfr_rest_services.get_cwa_eff_compliance`
  );
  url.searchParams.set("p_id", sourceId);
  url.searchParams.set("output", "JSON");
  let response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": EPA_ECHO_DEFAULTS.userAgent }
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const json = await response.json();
  const parsed = echoEffluentComplianceResponseSchema.safeParse(json);
  if (!parsed.success) return null;
  const compliance = parsed.data.Results.CWAEffluentCompliance;
  const sources = compliance.Sources;
  if (!sources || sources.length === 0) return null;
  const header = compliance.Header;
  const parameters = sources[0].Parameters ?? [];
  const violations = [];
  for (const param of parameters) {
    for (let q = 1; q <= 13; q++) {
      const statusKey = `Qtr${q}Status`;
      const valueKey = `Qtr${q}Value`;
      const status = param[statusKey];
      const value = param[valueKey];
      if (!status || !value) continue;
      if (status !== "S" && status !== "V") continue;
      const exceedance = parseExceedancePercent(value);
      if (exceedance === null) continue;
      const startKey = `Qtr${q}Start`;
      const endKey = `Qtr${q}End`;
      const qtrStart = header[startKey];
      const qtrEnd = header[endKey];
      const quarterDate = qtrEnd ?? qtrStart ?? `Q${q}`;
      violations.push({
        parameterName: param.ParameterName,
        dischargePoint: param.DischargePoint ?? "unknown",
        quarterDate,
        exceedancePercent: exceedance,
        status
      });
    }
  }
  if (violations.length === 0) return null;
  return { sourceId, facilityName, violations };
}
async function fetchViolationDetails(facilities) {
  if (facilities.length === 0) {
    return { success: true, details: [] };
  }
  try {
    const results = await Promise.allSettled(
      facilities.map(
        (f) => fetchSingleFacilityViolations(f.sourceId, f.facilityName)
      )
    );
    const details = results.filter(
      (r) => r.status === "fulfilled" && r.value !== null
    ).map((r) => r.value);
    return { success: true, details };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `DFR fetch error: ${message}` };
  }
}

// src/clients/epa-echo/summarize.ts
var MAX_FACILITIES_PER_GROUP = 10;
var MAX_VIOLATIONS_PER_FACILITY = 5;
function formatEchoDataForPrompt(data) {
  const { facilities, complianceSummary: cs } = data;
  if (facilities.length === 0 && cs.totalFacilities === 0) return "";
  const parts = [];
  parts.push(
    `Permitted dischargers within search radius (${cs.totalFacilities} facilities with active Clean Water Act permits):`
  );
  const stats = [];
  if (cs.significantViolations > 0)
    stats.push(`${cs.significantViolations} with significant violations`);
  if (cs.currentViolations > 0)
    stats.push(`${cs.currentViolations} with current violations`);
  if (cs.violationsLast4Quarters > 0)
    stats.push(
      `${cs.violationsLast4Quarters} with violations in the last 4 quarters`
    );
  if (cs.formalEnforcementActions > 0)
    stats.push(
      `${cs.formalEnforcementActions} subject to formal enforcement actions`
    );
  if (cs.inspections > 0) stats.push(`${cs.inspections} inspected`);
  if (cs.totalPenalties)
    stats.push(`${cs.totalPenalties} in total penalties assessed`);
  if (stats.length > 0) {
    parts.push(`Compliance overview: ${stats.join("; ")}.`);
  }
  if (facilities.length > 0) {
    const expired = facilities.filter((f) => f.permitStatus === "Expired");
    const effective = facilities.filter((f) => f.permitStatus === "Effective");
    const other = facilities.filter(
      (f) => f.permitStatus !== "Expired" && f.permitStatus !== "Effective"
    );
    if (expired.length > 0) {
      parts.push(`Facilities with expired permits (${expired.length}):`);
      for (const f of expired.slice(0, MAX_FACILITIES_PER_GROUP)) {
        parts.push(formatFacilityLine(f));
      }
      if (expired.length > MAX_FACILITIES_PER_GROUP) {
        parts.push(
          `  ...and ${expired.length - MAX_FACILITIES_PER_GROUP} more`
        );
      }
    }
    if (other.length > 0) {
      parts.push(
        `Facilities with non-standard permit status (${other.length}):`
      );
      for (const f of other.slice(0, MAX_FACILITIES_PER_GROUP)) {
        parts.push(formatFacilityLine(f));
      }
      if (other.length > MAX_FACILITIES_PER_GROUP) {
        parts.push(`  ...and ${other.length - MAX_FACILITIES_PER_GROUP} more`);
      }
    }
    if (effective.length > 0) {
      parts.push(
        `${effective.length} nearby facilities hold effective permits.`
      );
    }
  }
  if (data.violationDetails && data.violationDetails.length > 0) {
    parts.push(
      `
Specific effluent violations by significant noncompliance facilities:`
    );
    for (const detail of data.violationDetails) {
      const sorted = [...detail.violations].sort(
        (a, b) => b.exceedancePercent - a.exceedancePercent
      );
      const top = sorted.slice(0, MAX_VIOLATIONS_PER_FACILITY);
      const violationList = top.map(
        (v) => `${v.parameterName} ${v.exceedancePercent}% over limit (${v.quarterDate})`
      ).join(", ");
      const more = sorted.length > MAX_VIOLATIONS_PER_FACILITY ? ` and ${sorted.length - MAX_VIOLATIONS_PER_FACILITY} more` : "";
      parts.push(
        `- ${detail.facilityName} (${detail.sourceId}): ${violationList}${more}`
      );
    }
  }
  return parts.join("\n");
}
function formatViolationDetailsAsText(details) {
  if (details.length === 0) return "No violation details found.";
  const parts = [
    `Effluent violation details for ${details.length} facility(ies). NOTE: These are permit limit exceedances reported to the EPA. A violation means the facility exceeded its permitted discharge level \u2014 it does not by itself indicate downstream ecological impact. Assessing actual impact would require water quality monitoring data from downstream stations during and after the discharge event.`
  ];
  for (const detail of details) {
    const sorted = [...detail.violations].sort(
      (a, b) => b.exceedancePercent - a.exceedancePercent
    );
    const lines = sorted.map(
      (v) => `  - ${v.parameterName}: ${v.exceedancePercent}% over permit limit at discharge point ${v.dischargePoint} (${v.quarterDate})`
    );
    parts.push(`${detail.facilityName} (${detail.sourceId}):`);
    parts.push(...lines);
  }
  return parts.join("\n");
}
function formatFacilityLine(f) {
  const location = [f.city, f.county ? `${f.county} County` : null, f.state].filter(Boolean).join(", ");
  const permit = f.npdesId ? ` | permit ${f.npdesId}` : "";
  const status = f.permitStatus ? ` | ${f.permitStatus}` : "";
  return `- ${f.facilityName}${permit}${status} | ${location || "location unknown"}`;
}

// src/clients/attains/config.ts
var ATTAINS_MAPSERVER_URL = "https://gispub.epa.gov/arcgis/rest/services/OW/ATTAINS_Assessment/MapServer";
var ATTAINS_DEFAULTS = {
  searchRadiusMiles: 5,
  maxResults: 25,
  userAgent: "SpeakForTheTrees/0.1.0",
  fetchTimeoutMs: 15e3
};
var ATTAINS_LAYERS = {
  points: 0,
  lines: 1,
  areas: 2
};
var IR_CATEGORIES = {
  "1": "All designated uses attained \u2014 not impaired",
  "2": "Some uses attained; insufficient data for others",
  "3": "Insufficient data to determine impairment",
  "4A": "Impaired \u2014 TMDL completed",
  "4B": "Impaired \u2014 other controls expected to address impairment",
  "4C": "Impaired \u2014 not caused by a pollutant",
  "5": "Impaired \u2014 requires TMDL (303(d) listed)",
  "5A": "Impaired \u2014 requires TMDL, new listing",
  "5M": "Impaired \u2014 requires TMDL, monitoring scheduled"
};

// src/validations/attains.ts
import { z as z6 } from "zod";
var attainsFeatureAttributesSchema = z6.object({
  assessmentunitidentifier: z6.string().nullish(),
  assessmentunitname: z6.string().nullish(),
  reportingcycle: z6.string().nullish(),
  ircategory: z6.string().nullish(),
  overallstatus: z6.string().nullish(),
  isassessed: z6.string().nullish(),
  isimpaired: z6.string().nullish(),
  isthreatened: z6.string().nullish(),
  on303dlist: z6.string().nullish(),
  hastmdl: z6.string().nullish(),
  has4bplan: z6.string().nullish(),
  causegrouppathogens: z6.string().nullish(),
  causegroupnutrients: z6.string().nullish(),
  causegroupmetals: z6.string().nullish(),
  causegroupmercury: z6.string().nullish(),
  causegrouporganicdepletionoxygendepletion: z6.string().nullish(),
  causegrouppesticides: z6.string().nullish(),
  causegroupsediment: z6.string().nullish(),
  causegrouptemperature: z6.string().nullish(),
  causegrouphabitat: z6.string().nullish(),
  causegroupflow: z6.string().nullish(),
  causegroupph: z6.string().nullish(),
  causegroupturbidity: z6.string().nullish(),
  causegroupother: z6.string().nullish()
});
var attainsFeatureSchema = z6.object({
  attributes: attainsFeatureAttributesSchema
});
var attainsQueryResponseSchema = z6.object({
  features: z6.array(attainsFeatureSchema)
});

// src/clients/attains/client.ts
var CAUSE_GROUP_FIELDS = {
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
  causegroupother: "Other causes"
};
async function fetchImpairedWaters(center, radiusMiles = ATTAINS_DEFAULTS.searchRadiusMiles) {
  const [linesResult, areasResult] = await Promise.all([
    queryLayer(ATTAINS_LAYERS.lines, center, radiusMiles),
    queryLayer(ATTAINS_LAYERS.areas, center, radiusMiles)
  ]);
  if (!linesResult.success && !areasResult.success) {
    return {
      success: false,
      error: `ATTAINS query failed: ${linesResult.success ? "" : linesResult.error}${areasResult.success ? "" : "; " + areasResult.error}`
    };
  }
  const allWaters = [
    ...linesResult.success ? linesResult.waters : [],
    ...areasResult.success ? areasResult.waters : []
  ];
  const seen = /* @__PURE__ */ new Set();
  const unique = allWaters.filter((w) => {
    if (seen.has(w.assessmentUnitId)) return false;
    seen.add(w.assessmentUnitId);
    return true;
  });
  return { success: true, waters: unique };
}
async function queryLayer(layerId, center, radiusMiles) {
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
  let response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": ATTAINS_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(ATTAINS_DEFAULTS.fetchTimeoutMs)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }
  if (!response.ok) {
    return {
      success: false,
      error: `ATTAINS API error: ${response.status} ${response.statusText}`
    };
  }
  let json;
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
      error: `Validation error: ${parsed.error.message}`
    };
  }
  const waters = parsed.data.features.map((f) => {
    const a = f.attributes;
    const irCat = a.ircategory ?? "";
    const causes = [];
    for (const [field, label] of Object.entries(CAUSE_GROUP_FIELDS)) {
      if (a[field] === "Y") {
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
      causes
    };
  });
  return { success: true, waters };
}

// src/clients/attains/summarize.ts
function formatImpairedWatersForPrompt(waters, radiusMiles) {
  if (waters.length === 0) {
    return `No assessed water bodies found within ${radiusMiles} miles. This may mean the area has not been assessed, not that the waters are unimpaired.`;
  }
  const impaired = waters.filter((w) => w.isImpaired);
  const on303d = waters.filter((w) => w.on303dList);
  const supporting = waters.filter(
    (w) => w.overallStatus === "Fully Supporting"
  );
  const parts = [];
  parts.push(
    `EPA 303(d) impaired waters assessment within ${radiusMiles} miles (${waters.length} assessed water bodies). Source: EPA ATTAINS database. NOTE: These are official regulatory designations based on state water quality assessments submitted to the EPA, typically updated every 2 years. The reporting cycle year indicates when the assessment was last updated, not necessarily when monitoring occurred.`
  );
  parts.push(
    `Summary: ${impaired.length} impaired, ${on303d.length} on 303(d) list, ${supporting.length} fully supporting designated uses.`
  );
  for (const w of waters) {
    const status = w.isImpaired ? "IMPAIRED" : "not impaired";
    const listed = w.on303dList ? ", 303(d) LISTED" : "";
    const tmdl = w.hasTmdl ? ", TMDL exists" : "";
    const causes = w.causes.length > 0 ? ` | causes: ${w.causes.join(", ")}` : "";
    parts.push(
      `- ${w.assessmentUnitName} (${w.assessmentUnitId}): ${status}${listed}${tmdl} | ${w.irCategoryDescription} | cycle: ${w.reportingCycle}${causes}`
    );
  }
  return parts.join("\n");
}

export {
  fetchHydrolocation,
  fetchUpstreamStations,
  fetchDownstreamStations,
  fetchTidalData,
  fetchNoaaStations,
  fetchWaterData,
  fetchMonitoringLocations,
  filterActiveStations,
  haversineDistance,
  bboxFromCenter,
  findNearest,
  resolveLocation,
  resolveTimeRange,
  formatWaterDataForPrompt,
  fetchObservations,
  formatObservationsForPrompt,
  formatTidalDataForPrompt,
  fetchEchoFacilities,
  fetchSncFacilityIds,
  fetchViolationDetails,
  formatEchoDataForPrompt,
  formatViolationDetailsAsText,
  fetchImpairedWaters,
  formatImpairedWatersForPrompt
};
