import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAirQuality } from "../../clients/airnow/client.js";
import { formatAirQualityForPrompt } from "../../clients/airnow/summarize.js";

export function registerAirTools(server: McpServer) {
  server.tool(
    "airnow_air_quality",
    "Fetch current air quality index (AQI) readings from AirNow near a location. Returns AQI by pollutant (PM2.5, PM10, ozone, etc.) with health category ratings. Requires AIRNOW_API_KEY environment variable (free registration at https://docs.airnowapi.org/).",
    {
      latitude: z.number().describe("Latitude of the location to investigate"),
      longitude: z.number().describe("Longitude of the location to investigate"),
      radius_miles: z.number().min(1).max(100).optional().describe("Search radius in miles. Default: 25"),
    },
    async ({ latitude, longitude, radius_miles }) => {
      const data = await fetchAirQuality({
        latitude,
        longitude,
        radiusMiles: radius_miles ?? 25,
      });

      if (!data.success) {
        return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };
      }

      return {
        content: [{ type: "text" as const, text: formatAirQualityForPrompt(data.observations) }],
      };
    },
  );
}
