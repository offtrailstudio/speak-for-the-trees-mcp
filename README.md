# Speak for the Trees

If it is inevitable that we will all have agents acting on our behalf, should other living systems also have agents that represent their interests?

This project explores the potential for agentic representation of ecosystems and their diverse populations. If equipped with data about the ecosystem and capital, what actions might an agent take to protect that ecosystem?

- A wetland might choose to take legal action against an upstream polluter.
- A forest might request human intervention following a rise in invasive species sightings.
- A river might submit comments on a local proposal to build on a neighboring parcel.

There are examples around the world of ecosystems being granted legal personhood, aiming to give them equal footing in modern society. Could AI better equip environmental advocates and lawyers in their pursuit of this idea?

This MCP server is a starting point: a set of tools for investigating ecosystem health using public environmental data. Point it at any coordinates and query water quality, species observations, EPA compliance, tidal conditions, and impaired waters listings.

Most tools require no API keys — data comes from free public APIs (USGS, EPA, NOAA, iNaturalist, GBIF). The `airnow_air_quality` tool requires a free AirNow API key ([register here](https://docs.airnowapi.org/)).

## Demo

[speakforthetrees.com](https://speakforthetrees.com) — interactive map showing the data these tools return. Click anywhere on the map to run a live investigation.

## Install

```bash
claude mcp add speak-for-the-trees -- npx @offtrailstudio/speak-for-the-trees
```

Or from source:

```bash
git clone https://github.com/offtrailstudio/speak-for-the-trees-mcp.git
cd speak-for-the-trees-mcp
npm install
claude mcp add speak-for-the-trees -- npx tsx $(pwd)/src/server.ts
```

The data clients are also available as an npm library if you want to build your own tools on top of the same data sources:

```bash
npm install @offtrailstudio/speak-for-the-trees
```

```typescript
import { fetchWaterData, fetchObservations, fetchImpairedWaters } from "@offtrailstudio/speak-for-the-trees";
```

## Tools

### Read

These tools retrieve data about an ecosystem. All accept `latitude` and `longitude` — the server automatically discovers nearby USGS monitoring stations and NOAA tidal gauges using the USGS Network-Linked Data Index.

| Tool | Data source | What it returns |
|------|------------|-----------------|
| `usgs_water_conditions` | USGS NWIS | Temperature, dissolved oxygen, pH, streamflow with EPA thresholds |
| `noaa_tidal_conditions` | NOAA CO-OPS | Water levels, predictions, tidal range, deviation from predicted |
| `inaturalist_species_observations` | iNaturalist | Species presence records with taxonomy, threat status, native/introduced flags |
| `gbif_species_occurrences` | GBIF | Species occurrence records aggregated from museum collections, research, iNaturalist, eBird |
| `airnow_air_quality` | AirNow | Current AQI readings by pollutant (PM2.5, PM10, ozone) with health category ratings |
| `epa_facilities` | EPA ECHO | Permitted dischargers, compliance status, violation counts |
| `epa_violations` | EPA ECHO | Facilities in Significant Non-Compliance |
| `epa_violation_details` | EPA ECHO | Specific effluent violations (parameter, exceedance %, dates) |
| `epa_impaired_waters` | EPA ATTAINS | 303(d) listed waters, impairment causes, TMDL status |
| `tri_toxic_releases` | EPA TRI | TRI-reporting facilities and their annual chemical release obligations |
| `tri_release_details` | EPA TRI | Per-chemical release amounts by medium (air, water, land) for specific facilities |

### Act

No action tools exist yet — this is where the project gets interesting. Once an investigation surfaces a concern, an agent needs tools to do something about it. Planned additions include drafting regulatory comments, filing public records requests, and flagging violations for environmental advocacy orgs.

In the meantime, you can pair this MCP with others to take action.

## Example

```
Check the water quality and EPA compliance status near the Hudson River
at Tivoli Bays (42.04, -73.91). Compare the last week against the last 3 months.
```

## How It Works

When you provide coordinates, the server:

1. Finds the nearest stream reach via the USGS NLDI hydrolocation service
2. Discovers USGS monitoring stations on the upstream hydrologic network
3. Filters to stations with active real-time sensors
4. Finds the nearest NOAA tidal gauge
5. Queries the relevant APIs and formats results for the LLM

## Investigation Guide

See [AGENT.md](AGENT.md) for the full investigation methodology, including epistemic guardrails about what claims the data can and cannot support.

## Data Sources

| Source | API | What it provides |
|--------|-----|-----------------|
| USGS NWIS | [waterservices.usgs.gov](https://waterservices.usgs.gov/) | Real-time water quality monitoring |
| NOAA CO-OPS | [tidesandcurrents.noaa.gov](https://tidesandcurrents.noaa.gov/) | Tidal water levels |
| iNaturalist | [api.inaturalist.org](https://api.inaturalist.org/) | Community science species observations |
| GBIF | [gbif.org](https://www.gbif.org/) | Aggregated species occurrence records |
| AirNow | [docs.airnowapi.org](https://docs.airnowapi.org/) | Real-time air quality index |
| EPA ECHO | [echo.epa.gov](https://echo.epa.gov/) | Discharge permits and compliance |
| EPA ATTAINS | [epa.gov/waterdata/attains](https://www.epa.gov/waterdata/attains) | Impaired waters assessments |
| EPA TRI | [epa.gov/toxics-release-inventory-tri-program](https://www.epa.gov/toxics-release-inventory-tri-program) | Toxic chemical release reporting |
| USGS NLDI | [api.water.usgs.gov/nldi](https://api.water.usgs.gov/nldi) | Hydrologic network navigation |

## License

[MIT](LICENSE)
