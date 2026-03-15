# Speak for the Trees MCP

## Architecture

Multi-agent MCP server organized by domain under `src/agents/` (watershed, biodiversity, air, pollution). Each agent registers tools in its `tools.ts` and data clients live under `src/clients/`.

## Rules

- **Keep README.md in sync with tools.** When adding, removing, or renaming a tool, update both the Tools table and the Data Sources table in README.md. Tool names in the README must match the first argument to `server.tool()` exactly.
- **Export new data clients from the npm library.** Every client under `src/clients/` must be re-exported from `src/clients/index.ts` (both the fetch function and the summarize/format function). This is the public API for `@offtrailstudio/speak-for-the-trees`.
- Build with `npm run build`. The build output goes to `dist/`.
- Validate changes with `npm run build` before committing.
