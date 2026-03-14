import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveLocation } from "../../resolve-location.js";
import { resolveTimeRange } from "../../utils/time.js";
import { fetchObservations } from "../../clients/inaturalist/client.js";
import { formatObservationsForPrompt } from "../../clients/inaturalist/summarize.js";
import { fetchGbifOccurrences } from "../../clients/gbif/client.js";
import { formatGbifOccurrencesForPrompt } from "../../clients/gbif/summarize.js";

export function registerBiodiversityTools(server: McpServer) {
  server.tool(
    "inaturalist_species_observations",
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

  server.tool(
    "gbif_species_occurrences",
    "Fetch species occurrence records from GBIF (Global Biodiversity Information Facility) near a location. Aggregates records from museum collections, research expeditions, iNaturalist, eBird, and other datasets. Broader coverage than iNaturalist alone. Occurrences indicate documented presence, not population health.",
    {
      latitude: z.number().describe("Latitude of the location to investigate"),
      longitude: z.number().describe("Longitude of the location to investigate"),
      days_back: z.number().min(1).max(365).optional().describe("Days of history. Default: 90"),
      limit: z.number().min(1).max(300).optional().describe("Maximum records to return. Default: 300"),
    },
    async ({ latitude, longitude, days_back, limit }) => {
      const location = await resolveLocation(latitude, longitude);
      const time = resolveTimeRange({ days_back: days_back ?? 90 });

      const data = await fetchGbifOccurrences({
        bounds: location.bounds,
        startDate: time.startDate,
        endDate: time.endDate,
        limit: limit ?? 300,
      });

      if (!data.success) {
        return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };
      }

      return {
        content: [{
          type: "text" as const,
          text: formatGbifOccurrencesForPrompt(data.occurrences, data.totalCount, `${days_back ?? 90} days`),
        }],
      };
    },
  );
}
