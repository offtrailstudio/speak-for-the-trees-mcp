import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveLocation } from "../resolve-location.js";
import { resolveTimeRange } from "../utils/time.js";
import { fetchTidalData } from "../clients/noaa-tides/client.js";
import { formatTidalDataForPrompt } from "../clients/noaa-tides/summarize.js";

export function registerTidalTool(server: McpServer) {
  server.tool(
    "query_tidal_conditions",
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
