#!/usr/bin/env node
import {
  fetchEchoFacilities,
  fetchImpairedWaters,
  fetchObservations,
  fetchSncFacilityIds,
  fetchTidalData,
  fetchViolationDetails,
  fetchWaterData,
  formatEchoDataForPrompt,
  formatImpairedWatersForPrompt,
  formatObservationsForPrompt,
  formatTidalDataForPrompt,
  formatViolationDetailsAsText,
  formatWaterDataForPrompt,
  resolveLocation,
  resolveTimeRange
} from "./chunk-3OUGQ6MA.js";

// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// src/tools/water.ts
import { z } from "zod";
function registerWaterTool(server2) {
  server2.tool(
    "query_water_conditions",
    "Fetch real-time water quality data (temperature, dissolved oxygen, pH, streamflow) from USGS monitoring stations near a location. Returns readings with EPA reference thresholds for context.",
    {
      latitude: z.number().describe("Latitude of the location to investigate"),
      longitude: z.number().describe("Longitude of the location to investigate"),
      days_back: z.number().min(1).max(90).optional().describe("Days of history to fetch. Default: 7"),
      parameter_codes: z.array(z.string()).optional().describe("USGS parameter codes to filter by (e.g., ['00300'] for dissolved oxygen only)")
    },
    async ({ latitude, longitude, days_back, parameter_codes }) => {
      const location = await resolveLocation(latitude, longitude);
      const time = resolveTimeRange({ days_back: days_back ?? 7 });
      if (location.usgsStationIds.length === 0) {
        return {
          content: [{ type: "text", text: `No active USGS monitoring stations found near ${latitude}, ${longitude}. Try a location closer to a river or stream.` }]
        };
      }
      const data = await fetchWaterData({
        startDate: time.startDate,
        endDate: time.endDate,
        parameterCodes: parameter_codes,
        monitoringLocationIds: location.usgsStationIds
      });
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      if (data.readings.length === 0) {
        return {
          content: [{ type: "text", text: `No water quality readings found in the past ${days_back ?? 7} days from ${location.usgsStationIds.length} station(s) near ${location.name}.` }]
        };
      }
      return {
        content: [{ type: "text", text: formatWaterDataForPrompt(data.readings, `${days_back ?? 7} days`) }]
      };
    }
  );
}

// src/tools/species.ts
import { z as z2 } from "zod";
function registerSpeciesTool(server2) {
  server2.tool(
    "query_species_observations",
    "Fetch species observations from iNaturalist near a location. Returns community science records with taxonomy, threat status, and native/introduced flags. Observations indicate presence, not population health.",
    {
      latitude: z2.number().describe("Latitude of the location to investigate"),
      longitude: z2.number().describe("Longitude of the location to investigate"),
      days_back: z2.number().min(1).max(365).optional().describe("Days of history. Default: 30"),
      per_page: z2.number().min(1).max(200).optional().describe("Maximum observations to return. Default: 200")
    },
    async ({ latitude, longitude, days_back, per_page }) => {
      const location = await resolveLocation(latitude, longitude);
      const time = resolveTimeRange({ days_back: days_back ?? 30 });
      const data = await fetchObservations({
        startDate: time.startDate,
        endDate: time.endDate,
        perPage: per_page ?? 200,
        bounds: location.bounds
      });
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      if (data.observations.length === 0) {
        return {
          content: [{ type: "text", text: `No species observations found in the past ${days_back ?? 30} days near ${location.name}.` }]
        };
      }
      return {
        content: [{ type: "text", text: formatObservationsForPrompt(data.observations, `${days_back ?? 30} days`) }]
      };
    }
  );
}

// src/tools/tidal.ts
import { z as z3 } from "zod";
function registerTidalTool(server2) {
  server2.tool(
    "query_tidal_conditions",
    "Fetch tidal water levels and predictions from the nearest NOAA gauge. Returns observed levels, predicted levels, tidal range, and deviation from predictions.",
    {
      latitude: z3.number().describe("Latitude of the location to investigate"),
      longitude: z3.number().describe("Longitude of the location to investigate"),
      days_back: z3.number().min(1).max(7).optional().describe("Days of history. Default: 2. Max: 7")
    },
    async ({ latitude, longitude, days_back }) => {
      const location = await resolveLocation(latitude, longitude);
      const time = resolveTimeRange({ days_back: days_back ?? 2 });
      if (!location.noaaStationId) {
        return {
          content: [{ type: "text", text: `No NOAA tidal gauge found near ${latitude}, ${longitude}.` }]
        };
      }
      const data = await fetchTidalData({
        startDate: time.startDate,
        endDate: time.endDate,
        station: location.noaaStationId
      });
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      if (data.observations.length === 0 && data.predictions.length === 0) {
        return {
          content: [{ type: "text", text: `No tidal data found for the past ${days_back ?? 2} days.` }]
        };
      }
      return {
        content: [{
          type: "text",
          text: formatTidalDataForPrompt(
            { observations: data.observations, predictions: data.predictions, station: data.station },
            `${days_back ?? 2} days`
          )
        }]
      };
    }
  );
}

// src/tools/epa-facilities.ts
import { z as z4 } from "zod";
function registerEpaFacilitiesTool(server2) {
  server2.tool(
    "query_epa_facilities",
    "Fetch EPA-permitted facilities (Clean Water Act NPDES permits) near a location. Returns facility names, permit status, compliance summary, and violation counts.",
    {
      latitude: z4.number().describe("Latitude of the location to investigate"),
      longitude: z4.number().describe("Longitude of the location to investigate"),
      radius_miles: z4.number().min(1).max(100).optional().describe("Search radius in miles. Default: 10")
    },
    async ({ latitude, longitude, radius_miles }) => {
      const location = await resolveLocation(latitude, longitude);
      const data = await fetchEchoFacilities({
        radiusMiles: radius_miles ?? 10,
        center: location.center
      });
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      const text = formatEchoDataForPrompt({
        facilities: data.facilities,
        complianceSummary: data.complianceSummary
      });
      return {
        content: [{ type: "text", text: text || "No permitted facilities found." }]
      };
    }
  );
}

// src/tools/epa-violations.ts
import { z as z5 } from "zod";
function registerEpaViolationsTools(server2) {
  server2.tool(
    "query_epa_violations",
    "Find facilities currently in Significant Non-Compliance (SNC) with their EPA discharge permits near a location. Returns facility names and IDs that can be passed to query_violation_details.",
    {
      latitude: z5.number().describe("Latitude of the location to investigate"),
      longitude: z5.number().describe("Longitude of the location to investigate"),
      radius_miles: z5.number().min(1).max(100).optional().describe("Search radius in miles. Default: 10")
    },
    async ({ latitude, longitude, radius_miles }) => {
      const location = await resolveLocation(latitude, longitude);
      const facilities = await fetchSncFacilityIds(location.center, radius_miles ?? 10);
      if (facilities.length === 0) {
        return {
          content: [{ type: "text", text: "No facilities currently in Significant Non-Compliance." }]
        };
      }
      const lines = facilities.map(
        (f) => `- ${f.facilityName} (${f.sourceId})`
      );
      return {
        content: [{
          type: "text",
          text: `Facilities in Significant Non-Compliance:
${lines.join("\n")}`
        }]
      };
    }
  );
  server2.tool(
    "query_violation_details",
    "Get detailed effluent violation data for specific facilities. Shows which parameters were violated, by how much, and when. Use after query_epa_violations to investigate specific facilities.",
    {
      facilities: z5.array(z5.object({
        source_id: z5.string().describe("EPA source ID of the facility"),
        facility_name: z5.string().describe("Name of the facility")
      })).describe("Facilities to look up (from query_epa_violations results)")
    },
    async ({ facilities }) => {
      const mapped = facilities.map((f) => ({
        sourceId: f.source_id,
        facilityName: f.facility_name
      }));
      const data = await fetchViolationDetails(mapped);
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      return {
        content: [{ type: "text", text: formatViolationDetailsAsText(data.details) }]
      };
    }
  );
}

// src/tools/impaired-waters.ts
import { z as z6 } from "zod";
function registerImpairedWatersTool(server2) {
  server2.tool(
    "query_impaired_waters",
    "Check EPA 303(d) impaired waters listings near a location. Returns water bodies assessed as impaired, their causes (nutrients, pathogens, metals, etc.), and whether a cleanup plan (TMDL) exists.",
    {
      latitude: z6.number().describe("Latitude of the location to investigate"),
      longitude: z6.number().describe("Longitude of the location to investigate"),
      radius_miles: z6.number().min(1).max(25).optional().describe("Search radius in miles. Default: 5")
    },
    async ({ latitude, longitude, radius_miles }) => {
      const location = await resolveLocation(latitude, longitude);
      const radius = radius_miles ?? 5;
      const data = await fetchImpairedWaters(location.center, radius);
      if (!data.success) {
        return { content: [{ type: "text", text: `Error: ${data.error}` }] };
      }
      return {
        content: [{ type: "text", text: formatImpairedWatersForPrompt(data.waters, radius) }]
      };
    }
  );
}

// src/server.ts
var server = new McpServer({
  name: "speak-for-the-trees",
  version: "0.1.0"
});
registerWaterTool(server);
registerSpeciesTool(server);
registerTidalTool(server);
registerEpaFacilitiesTool(server);
registerEpaViolationsTools(server);
registerImpairedWatersTool(server);
var transport = new StdioServerTransport();
await server.connect(transport);
