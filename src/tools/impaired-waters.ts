import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveLocation } from "../resolve-location.js";
import { fetchImpairedWaters } from "../clients/attains/client.js";
import { formatImpairedWatersForPrompt } from "../clients/attains/summarize.js";

export function registerImpairedWatersTool(server: McpServer) {
  server.tool(
    "query_impaired_waters",
    "Check EPA 303(d) impaired waters listings near a location. Returns water bodies assessed as impaired, their causes (nutrients, pathogens, metals, etc.), and whether a cleanup plan (TMDL) exists.",
    {
      latitude: z.number().describe("Latitude of the location to investigate"),
      longitude: z.number().describe("Longitude of the location to investigate"),
      radius_miles: z.number().min(1).max(25).optional().describe("Search radius in miles. Default: 5"),
    },
    async ({ latitude, longitude, radius_miles }) => {
      const location = await resolveLocation(latitude, longitude);
      const radius = radius_miles ?? 5;

      const data = await fetchImpairedWaters(location.center, radius);

      if (!data.success) {
        return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };
      }

      return {
        content: [{ type: "text" as const, text: formatImpairedWatersForPrompt(data.waters, radius) }],
      };
    },
  );
}
