import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveLocation } from "../resolve-location.js";
import { resolveTimeRange } from "../utils/time.js";
import { fetchObservations } from "../clients/inaturalist/client.js";
import { formatObservationsForPrompt } from "../clients/inaturalist/summarize.js";

export function registerSpeciesTool(server: McpServer) {
  server.tool(
    "query_species_observations",
    "Fetch species observations from iNaturalist near a location. Returns community science records with taxonomy, threat status, and native/introduced flags. Observations indicate presence, not population health.",
    {
      latitude: z.number().describe("Latitude of the location to investigate"),
      longitude: z.number().describe("Longitude of the location to investigate"),
      days_back: z.number().min(1).max(365).optional().describe("Days of history. Default: 30"),
      per_page: z.number().min(1).max(200).optional().describe("Maximum observations to return. Default: 200"),
    },
    async ({ latitude, longitude, days_back, per_page }) => {
      const location = await resolveLocation(latitude, longitude);
      const time = resolveTimeRange({ days_back: days_back ?? 30 });

      const data = await fetchObservations({
        startDate: time.startDate,
        endDate: time.endDate,
        perPage: per_page ?? 200,
        bounds: location.bounds,
      });

      if (!data.success) {
        return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };
      }

      if (data.observations.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No species observations found in the past ${days_back ?? 30} days near ${location.name}.` }],
        };
      }

      return {
        content: [{ type: "text" as const, text: formatObservationsForPrompt(data.observations, `${days_back ?? 30} days`) }],
      };
    },
  );
}
