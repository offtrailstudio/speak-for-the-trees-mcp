import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveLocation } from "../resolve-location.js";
import { fetchEchoFacilities } from "../clients/epa-echo/client.js";
import { formatEchoDataForPrompt } from "../clients/epa-echo/summarize.js";

export function registerEpaFacilitiesTool(server: McpServer) {
  server.tool(
    "query_epa_facilities",
    "Fetch EPA-permitted facilities (Clean Water Act NPDES permits) near a location. Returns facility names, permit status, compliance summary, and violation counts.",
    {
      latitude: z.number().describe("Latitude of the location to investigate"),
      longitude: z.number().describe("Longitude of the location to investigate"),
      radius_miles: z.number().min(1).max(100).optional().describe("Search radius in miles. Default: 10"),
    },
    async ({ latitude, longitude, radius_miles }) => {
      const location = await resolveLocation(latitude, longitude);

      const data = await fetchEchoFacilities({
        radiusMiles: radius_miles ?? 10,
        center: location.center,
      });

      if (!data.success) {
        return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };
      }

      const text = formatEchoDataForPrompt({
        facilities: data.facilities,
        complianceSummary: data.complianceSummary,
      });

      return {
        content: [{ type: "text" as const, text: text || "No permitted facilities found." }],
      };
    },
  );
}
