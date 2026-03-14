# Speak for the Trees

MCP server for investigating ecosystem health using public environmental data. Point it at any coordinates and query water quality, species observations, EPA compliance, tidal conditions, and impaired waters listings.

No API keys needed — all data comes from free public APIs (USGS, EPA, NOAA, iNaturalist).

## Install

```bash
claude mcp add speak-for-the-trees -- npx @offtrailstudio/speak-for-the-trees
```

Or from source:

```bash
git clone https://github.com/offtrailstudio/speak-for-the-trees.git
cd speak-for-the-trees
npm install
claude mcp add speak-for-the-trees -- npx tsx $(pwd)/src/server.ts
```

## Tools

| Tool | Data source | What it returns |
|------|------------|-----------------|
| `query_water_conditions` | USGS NWIS | Temperature, dissolved oxygen, pH, streamflow with EPA thresholds |
| `query_species_observations` | iNaturalist | Species presence records with taxonomy and threat status |
| `query_tidal_conditions` | NOAA CO-OPS | Water levels, predictions, tidal range, deviation from predicted |
| `query_epa_facilities` | EPA ECHO | Permitted dischargers, compliance status, violation counts |
| `query_epa_violations` | EPA ECHO | Facilities in Significant Non-Compliance |
| `query_violation_details` | EPA ECHO | Specific effluent violations (parameter, exceedance %, dates) |
| `query_impaired_waters` | EPA ATTAINS | 303(d) listed waters, impairment causes, TMDL status |

All tools accept `latitude` and `longitude`. The server automatically discovers nearby USGS monitoring stations and NOAA tidal gauges using the USGS Network-Linked Data Index.

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
| EPA ECHO | [echo.epa.gov](https://echo.epa.gov/) | Discharge permits and compliance |
| NOAA CO-OPS | [tidesandcurrents.noaa.gov](https://tidesandcurrents.noaa.gov/) | Tidal water levels |
| iNaturalist | [api.inaturalist.org](https://api.inaturalist.org/) | Community science species observations |
| EPA ATTAINS | [epa.gov/waterdata/attains](https://www.epa.gov/waterdata/attains) | Impaired waters assessments |
| USGS NLDI | [api.water.usgs.gov/nldi](https://api.water.usgs.gov/nldi) | Hydrologic network navigation |

## License

[MIT](LICENSE)
