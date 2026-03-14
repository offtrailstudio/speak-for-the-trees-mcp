import { fetchHydrolocation, fetchUpstreamStations } from "./clients/nldi/client.js";
import { fetchNoaaStations } from "./clients/noaa-tides/client.js";
import { filterActiveStations } from "./clients/usgs-water/client.js";
import { bboxFromCenter, findNearest } from "./utils/geo.js";
import type { LocationConfig } from "./types/location.js";
import type { NoaaStation } from "./types/noaa-tides.js";

// Cache NOAA station list — ~3000 stations, fetched once per process
let cachedNoaaStations: NoaaStation[] | null = null;

export async function resolveLocation(
  latitude: number,
  longitude: number,
): Promise<LocationConfig> {
  // Step 1: Find the nearest stream reach
  const hydroResult = await fetchHydrolocation(latitude, longitude);

  const center = { lat: latitude, lng: longitude };
  let comid: string | undefined;
  let streamName = "Unknown waterway";

  if (hydroResult.success) {
    comid = hydroResult.hydrolocation.comid;
    streamName = hydroResult.hydrolocation.name ?? "Unknown waterway";
  }

  // Step 2: Discover USGS monitoring stations on the hydrologic network
  let usgsStationIds: string[] = [];
  if (comid) {
    const stationsResult = await fetchUpstreamStations(comid, 50);
    if (stationsResult.success && stationsResult.stations.length > 0) {
      // Filter to only stations with active real-time data
      const allIds = stationsResult.stations.map((s) => s.id);
      usgsStationIds = await filterActiveStations(allIds);
    }
  }

  // Step 3: Find the nearest NOAA tidal gauge
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

  // Step 4: Generate bounding box
  const bounds = bboxFromCenter(center, 10);

  return {
    slug: `${latitude.toFixed(2)}-${longitude.toFixed(2)}`,
    name: streamName,
    description: `area near ${latitude.toFixed(4)}°N, ${Math.abs(longitude).toFixed(4)}°${longitude >= 0 ? "E" : "W"}`,
    bounds,
    center,
    usgsStationIds,
    noaaStationId,
    comid,
  };
}
