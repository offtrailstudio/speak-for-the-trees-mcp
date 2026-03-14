#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerWatershedTools } from "./agents/watershed/tools.js";
import { registerBiodiversityTools } from "./agents/biodiversity/tools.js";
import { registerPollutionTools } from "./agents/pollution/tools.js";
import { registerAirTools } from "./agents/air/tools.js";
import { registerPrompts } from "./agents/prompts.js";

const server = new McpServer({
  name: "speak-for-the-trees",
  version: "0.2.0",
});

registerWatershedTools(server);
registerBiodiversityTools(server);
registerPollutionTools(server);
registerAirTools(server);
registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
