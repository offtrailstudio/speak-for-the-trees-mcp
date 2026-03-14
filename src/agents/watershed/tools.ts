import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveLocation } from "../../resolve-location.js";
import { resolveTimeRange } from "../../utils/time.js";
import { fetchWaterData } from "../../clients/usgs-water/client.js";
import { formatWaterDataForPrompt } from "../../clients/usgs-water/summarize.js";
import { fetchTidalData } from "../../clients/noaa-tides/client.js";
import { formatTidalDataForPrompt } from "../../clients/noaa-tides/summarize.js";

export function registerWatershedTools(server: McpServer) {
  server.tool(
    "usgs_water_conditions",
    "Fetch real-time water quality data (temperature, dissolved oxygen, pH, streamflow) from USGS monitoring stations near a location. Returns readings with EPA reference thresholds for context.",
    {
      latitude: z.number().describe("Latitude of the location to investigate"),
      longitude: z.number().describe("Longitude of the location to investigate"),
      days_back: z.number().min(1).max(90).optional().describe("Days of history to fetch. Default: 7"),
      parameter_codes: z.array(z.string()).optional().describe("USGS parameter codes to filter by (e.g., ['00300'] for dissolved oxygen only)"),
    },
    async ({ latitude, longitude, days_back, parameter_codes }) => {
      const location = await resolveLocation(latitude, longitude);
      const time = resolveTimeRange({ days_back: days_back ?? 7 });

      if (location.usgsStationIds.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No active USGS monitoring stations found near ${latitude}, ${longitude}. Try a location closer to a river or stream.` }],
        };
      }

      const data = await fetchWaterData({
        startDate: time.startDate,
        endDate: time.endDate,
        parameterCodes: parameter_codes,
        monitoringLocationIds: location.usgsStationIds,
      });

      if (!data.success) {
        return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };
      }

      if (data.readings.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No water quality readings found in the past ${days_back ?? 7} days from ${location.usgsStationIds.length} station(s) near ${location.name}.` }],
        };
      }

      return {
        content: [{ type: "text" as const, text: formatWaterDataForPrompt(data.readings, `${days_back ?? 7} days`) }],
      };
    },
  );

  server.tool(
    "noaa_tidal_conditions",
    "Fetch tidal water levels and predictions from the nearest NOAA gauge. Returns observed levels, predicted levels, tidal range, and deviation from predictions.",
    {
      latitude: z.number().describe("Latitude of the location to investigate"),
      longitude: z.number().describe("Longitude of the location to investigate"),
      days_back: z.number().min(1).max(7).optional().describe("Days of history. Default: 2. Max: 7"),
    },
    async ({ latitude, longitude, days_back }) => {
      const location = await resolveLocation(latitude, longitude);
      const time = resolveTimeRange({ days_back: days_back ?? 2 });

      if (!location.noaaStationId) {
        return {
          content: [{ type: "text" as const, text: `No NOAA tidal gauge found near ${latitude}, ${longitude}.` }],
        };
      }

      const data = await fetchTidalData({
        startDate: time.startDate,
        endDate: time.endDate,
        station: location.noaaStationId,
      });

      if (!data.success) {
        return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };
      }

      if (data.observations.length === 0 && data.predictions.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No tidal data found for the past ${days_back ?? 2} days.` }],
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: formatTidalDataForPrompt(
            { observations: data.observations, predictions: data.predictions, station: data.station },
            `${days_back ?? 2} days`,
          ),
        }],
      };
    },
  );
}
