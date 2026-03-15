// NLDI
export { fetchHydrolocation, fetchUpstreamStations, fetchDownstreamStations } from "./nldi/client.js";

// USGS Water
export { fetchWaterData, fetchMonitoringLocations, filterActiveStations } from "./usgs-water/client.js";
export { formatWaterDataForPrompt } from "./usgs-water/summarize.js";

// EPA ECHO
export { fetchEchoFacilities, fetchSncFacilityIds, fetchViolationDetails } from "./epa-echo/client.js";
export { formatEchoDataForPrompt, formatViolationDetailsAsText } from "./epa-echo/summarize.js";

// NOAA Tides
export { fetchTidalData, fetchNoaaStations } from "./noaa-tides/client.js";
export { formatTidalDataForPrompt } from "./noaa-tides/summarize.js";

// iNaturalist
export { fetchObservations } from "./inaturalist/client.js";
export { formatObservationsForPrompt } from "./inaturalist/summarize.js";

// ATTAINS (Impaired Waters)
export { fetchImpairedWaters } from "./attains/client.js";
export { formatImpairedWatersForPrompt } from "./attains/summarize.js";

// GBIF
export { fetchGbifOccurrences } from "./gbif/client.js";
export { formatGbifOccurrencesForPrompt } from "./gbif/summarize.js";

// AirNow
export { fetchAirQuality } from "./airnow/client.js";
export { formatAirQualityForPrompt } from "./airnow/summarize.js";

// TRI (Toxics Release Inventory)
export { fetchTriFacilities, fetchTriReleases } from "./tri/client.js";
export { formatTriFacilitiesForPrompt, formatTriReleasesForPrompt } from "./tri/summarize.js";

// Location resolution
export { resolveLocation } from "../resolve-location.js";

// Utilities
export { resolveTimeRange } from "../utils/time.js";
export { haversineDistance, bboxFromCenter, findNearest } from "../utils/geo.js";
