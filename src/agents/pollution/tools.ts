import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveLocation } from "../../resolve-location.js";
import { fetchEchoFacilities, fetchSncFacilityIds, fetchViolationDetails } from "../../clients/epa-echo/client.js";
import { formatEchoDataForPrompt, formatViolationDetailsAsText } from "../../clients/epa-echo/summarize.js";
import { fetchImpairedWaters } from "../../clients/attains/client.js";
import { formatImpairedWatersForPrompt } from "../../clients/attains/summarize.js";
import { fetchTriFacilities, fetchTriReleases } from "../../clients/tri/client.js";
import { formatTriFacilitiesForPrompt, formatTriReleasesForPrompt } from "../../clients/tri/summarize.js";

export function registerPollutionTools(server: McpServer) {
  server.tool(
    "epa_facilities",
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

  server.tool(
    "epa_violations",
    "Find facilities currently in Significant Non-Compliance (SNC) with their EPA discharge permits near a location. Returns facility names and IDs that can be passed to epa_violation_details.",
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
    "epa_violation_details",
    "Get detailed effluent violation data for specific facilities. Shows which parameters were violated, by how much, and when. Use after epa_violations to investigate specific facilities.",
    {
      facilities: z.array(z.object({
        source_id: z.string().describe("EPA source ID of the facility"),
        facility_name: z.string().describe("Name of the facility"),
      })).describe("Facilities to look up (from epa_violations results)"),
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

  server.tool(
    "epa_impaired_waters",
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

  server.tool(
    "tri_toxic_releases",
    "Fetch TRI (Toxics Release Inventory) facilities near a location. Returns facilities required to report annual chemical releases to the EPA under EPCRA. Use tri_release_details to get per-chemical release amounts.",
    {
      latitude: z.number().describe("Latitude of the location to investigate"),
      longitude: z.number().describe("Longitude of the location to investigate"),
      radius_miles: z.number().min(1).max(100).optional().describe("Search radius in miles. Default: 10"),
    },
    async ({ latitude, longitude, radius_miles }) => {
      const location = await resolveLocation(latitude, longitude);

      const data = await fetchTriFacilities({
        center: location.center,
        radiusMiles: radius_miles ?? 10,
      });

      if (!data.success) {
        return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };
      }

      return {
        content: [{ type: "text" as const, text: formatTriFacilitiesForPrompt(data.facilities, data.countyName, data.stateAbbr) }],
      };
    },
  );

  server.tool(
    "tri_release_details",
    "Get chemical release details for specific TRI-reporting facilities. Returns the most recent year's self-reported release amounts by chemical and release medium (air, water, land). Use after tri_toxic_releases.",
    {
      facilities: z.array(z.object({
        tri_id: z.string().describe("TRI facility ID (from tri_toxic_releases results)"),
        facility_name: z.string().describe("Name of the facility"),
      })).describe("TRI facilities to look up"),
    },
    async ({ facilities }) => {
      const mapped = facilities.map((f) => ({
        triId: f.tri_id,
        facilityName: f.facility_name,
      }));

      const data = await fetchTriReleases(mapped);

      if (!data.success) {
        return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };
      }

      return {
        content: [{ type: "text" as const, text: formatTriReleasesForPrompt(data.details) }],
      };
    },
  );
}
