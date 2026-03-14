import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveLocation } from "../resolve-location.js";
import { fetchSncFacilityIds, fetchViolationDetails } from "../clients/epa-echo/client.js";
import { formatViolationDetailsAsText } from "../clients/epa-echo/summarize.js";

export function registerEpaViolationsTools(server: McpServer) {
  server.tool(
    "query_epa_violations",
    "Find facilities currently in Significant Non-Compliance (SNC) with their EPA discharge permits near a location. Returns facility names and IDs that can be passed to query_violation_details.",
    {
      latitude: z.number().describe("Latitude of the location to investigate"),
      longitude: z.number().describe("Longitude of the location to investigate"),
      radius_miles: z.number().min(1).max(100).optional().describe("Search radius in miles. Default: 10"),
    },
    async ({ latitude, longitude, radius_miles }) => {
      const location = await resolveLocation(latitude, longitude);

      const facilities = await fetchSncFacilityIds(location.center, radius_miles ?? 10);

      if (facilities.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No facilities currently in Significant Non-Compliance." }],
        };
      }

      const lines = facilities.map(
        (f) => `- ${f.facilityName} (${f.sourceId})`,
      );

      return {
        content: [{
          type: "text" as const,
          text: `Facilities in Significant Non-Compliance:\n${lines.join("\n")}`,
        }],
      };
    },
  );

  server.tool(
    "query_violation_details",
    "Get detailed effluent violation data for specific facilities. Shows which parameters were violated, by how much, and when. Use after query_epa_violations to investigate specific facilities.",
    {
      facilities: z.array(z.object({
        source_id: z.string().describe("EPA source ID of the facility"),
        facility_name: z.string().describe("Name of the facility"),
      })).describe("Facilities to look up (from query_epa_violations results)"),
    },
    async ({ facilities }) => {
      const mapped = facilities.map((f) => ({
        sourceId: f.source_id,
        facilityName: f.facility_name,
      }));

      const data = await fetchViolationDetails(mapped);

      if (!data.success) {
        return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };
      }

      return {
        content: [{ type: "text" as const, text: formatViolationDetailsAsText(data.details) }],
      };
    },
  );
}
