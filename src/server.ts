#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerWaterTool } from "./tools/water.js";
import { registerSpeciesTool } from "./tools/species.js";
import { registerTidalTool } from "./tools/tidal.js";
import { registerEpaFacilitiesTool } from "./tools/epa-facilities.js";
import { registerEpaViolationsTools } from "./tools/epa-violations.js";
import { registerImpairedWatersTool } from "./tools/impaired-waters.js";

const server = new McpServer({
  name: "speak-for-the-trees",
  version: "0.1.0",
});

registerWaterTool(server);
registerSpeciesTool(server);
registerTidalTool(server);
registerEpaFacilitiesTool(server);
registerEpaViolationsTools(server);
registerImpairedWatersTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
