import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const EPISTEMIC_GUARDRAILS = `
## Epistemic Guardrails — Critical

1. **Never claim causation without direct evidence.** Proximity or timing alone is not evidence of causation.
2. **iNaturalist observations are presence records**, not population surveys. Observation counts do not indicate population health.
3. **EPA violations are permit exceedances**, not proof of ecological harm. State the violation, its magnitude, and proximity — do not extrapolate ecological impact without water quality data showing a corresponding change.
4. **Absence of data is not evidence.** If stations have no readings, say so plainly.
5. **When you lack data, say so.** "No data available for this period" is more valuable than speculation.

## Reporting Style

- Matter-of-fact and observational. State what the data shows without editorializing.
- No dramatic language ("devastating," "alarming," "dire"). Let data speak for itself.
- Ground every claim in specific data: values, dates, station names, species names, facility names.
`;

export function registerPrompts(server: McpServer) {
  server.prompt(
    "investigate_watershed",
    "Investigation guide for water quality and hydrology. Instructs on how to use USGS and NOAA tools to establish a baseline, compare across time, and identify anomalies.",
    {
      latitude: z.coerce.number().describe("Latitude of the location to investigate"),
      longitude: z.coerce.number().describe("Longitude of the location to investigate"),
    },
    ({ latitude, longitude }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `You are investigating watershed conditions at ${latitude}, ${longitude}.

## Tools Available
- \`usgs_water_conditions\` — USGS water quality (temperature, dissolved oxygen, pH, streamflow)
- \`noaa_tidal_conditions\` — NOAA tidal water levels and deviation from predictions

## Investigation Steps

**Step 1 — Establish a baseline**
Call \`usgs_water_conditions\` with \`days_back: 7\` to see current conditions. Note any readings that fall outside normal ranges. Call \`noaa_tidal_conditions\` with \`days_back: 2\` for recent tidal data.

**Step 2 — Compare across time**
When a value looks unusual, query the same parameter with a longer window (\`days_back: 30\` or \`days_back: 90\`) to determine whether it is anomalous or baseline. A pH of 6.8 means nothing alone — but if it was 7.4 a month ago, that is a signal.

**Step 3 — Follow anomalies**
- Water quality declining? Note the affected parameters and their trend.
- Tidal anomalies? Compare observed levels against predictions to identify storm surge or unusual deviation.
- Document which parameters are declining, over what timeframe, and at which stations.

**Step 4 — Identify what the data supports**
Summarize: what is the current state of this watershed? What trends are visible? What questions remain unanswered due to data gaps?

${EPISTEMIC_GUARDRAILS}`,
        },
      }],
    }),
  );

  server.prompt(
    "investigate_biodiversity",
    "Investigation guide for species observations. Instructs on how to use iNaturalist data to assess species presence, identify threatened or invasive species, and cross-reference with ecosystem conditions.",
    {
      latitude: z.coerce.number().describe("Latitude of the location to investigate"),
      longitude: z.coerce.number().describe("Longitude of the location to investigate"),
    },
    ({ latitude, longitude }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `You are investigating biodiversity conditions at ${latitude}, ${longitude}.

## Tools Available
- \`inaturalist_species_observations\` — Community science species presence records with taxonomy, threat status, and native/introduced flags

## Investigation Steps

**Step 1 — Establish recent presence**
Call \`inaturalist_species_observations\` with \`days_back: 30\` to see what has been observed recently. Note species with threatened or endangered status, introduced/invasive species, and any taxonomic groups that are notably absent.

**Step 2 — Look at longer trends**
Call again with \`days_back: 365\` to get a broader picture. Compare: are the same species groups appearing across time, or do recent observations differ from the annual pattern?

**Step 3 — Identify signals worth investigating**
- Threatened or endangered species present? Note their names, observation count, and dates.
- Invasive species present? Note the extent of observations.
- Notable absences for a given ecosystem type? Absence of data is not evidence of absence — flag data gaps.

**Step 4 — Connect to ecosystem context**
Biodiversity observations gain meaning when cross-referenced with watershed and pollution data. If investigating an anomaly, use the watershed or pollution investigation prompts alongside this one.

${EPISTEMIC_GUARDRAILS}`,
        },
      }],
    }),
  );

  server.prompt(
    "investigate_pollution",
    "Investigation guide for EPA permit violations and impaired waters. Instructs on how to identify facilities in non-compliance, retrieve violation details, and assess regulatory status of nearby water bodies.",
    {
      latitude: z.coerce.number().describe("Latitude of the location to investigate"),
      longitude: z.coerce.number().describe("Longitude of the location to investigate"),
    },
    ({ latitude, longitude }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `You are investigating pollution and regulatory compliance at ${latitude}, ${longitude}.

## Tools Available
- \`epa_facilities\` — All NPDES-permitted facilities with compliance summary and violation counts
- \`epa_violations\` — Facilities currently in Significant Non-Compliance (SNC)
- \`epa_violation_details\` — Specific effluent violations: parameter, exceedance amount, dates
- \`epa_impaired_waters\` — EPA 303(d) impaired waters listings with impairment causes and TMDL status

## Investigation Steps

**Step 1 — Map the regulatory landscape**
Call \`epa_facilities\` to see all permitted dischargers in the area. Note: how many facilities? What proportion are in compliance vs. violation?

**Step 2 — Identify active violations**
Call \`epa_violations\` to find facilities currently in Significant Non-Compliance. SNC means serious or repeated violations — these are the priority targets.

**Step 3 — Get violation specifics**
Pass the SNC facilities from Step 2 to \`epa_violation_details\`. This reveals: which parameters are being violated (e.g., mercury, nitrogen, pH), by what magnitude, and for how long.

**Step 4 — Check water body status**
Call \`epa_impaired_waters\` to see which water bodies are already listed under 303(d) as impaired. Note the impairment causes — if a nearby facility is discharging the same pollutant causing an impairment, that is a factual connection worth stating.

**Step 5 — Synthesize**
What facilities are violating permits? What are they discharging? Are nearby water bodies already listed as impaired for those same pollutants? State connections factually without attributing causation beyond what the data supports.

${EPISTEMIC_GUARDRAILS}`,
        },
      }],
    }),
  );

  server.prompt(
    "investigate_ecosystem",
    "Full ecosystem investigation guide. Coordinates watershed, biodiversity, and pollution agents to build a complete picture of ecosystem health at a location.",
    {
      latitude: z.coerce.number().describe("Latitude of the location to investigate"),
      longitude: z.coerce.number().describe("Longitude of the location to investigate"),
    },
    ({ latitude, longitude }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `You are conducting a full ecosystem investigation at ${latitude}, ${longitude}.

## Investigation Framework

Work through three domains in sequence, then synthesize findings across them.

---

### Domain 1: Watershed
**Tools:** \`usgs_water_conditions\`, \`noaa_tidal_conditions\`

1. Fetch \`usgs_water_conditions\` for the past 7 days. Note temperature, dissolved oxygen, pH, and streamflow readings.
2. Fetch \`noaa_tidal_conditions\` for the past 2 days if the location is near tidal water.
3. Fetch \`usgs_water_conditions\` for 90 days to identify trends.
4. Document: current conditions, any anomalies, and trends.

---

### Domain 2: Biodiversity
**Tools:** \`inaturalist_species_observations\`

1. Fetch observations for the past 30 days.
2. Note threatened or endangered species, invasive species, and dominant taxonomic groups.
3. Fetch observations for 365 days to check for seasonal or long-term patterns.
4. Document: species of note, data gaps, and any patterns worth cross-referencing.

---

### Domain 3: Pollution
**Tools:** \`epa_facilities\`, \`epa_violations\`, \`epa_violation_details\`, \`epa_impaired_waters\`

1. Fetch \`epa_facilities\` for permitted dischargers in a 10-mile radius.
2. Fetch \`epa_violations\` for facilities in Significant Non-Compliance.
3. If SNC facilities exist, fetch \`epa_violation_details\` for specifics.
4. Fetch \`epa_impaired_waters\` for the regulatory status of nearby water bodies.
5. Document: active violations, impaired waters, and any overlapping pollutants.

---

### Synthesis

After gathering data from all three domains:
- What are the current watershed conditions?
- What species are present? Any of concern?
- Are there active pollution violations? What are they discharging?
- Are nearby water bodies listed as impaired? For what causes?
- Where do findings across domains align? (e.g., a facility discharging nitrogen + a nearby water body impaired by nutrients)
- What data gaps exist that would be needed to draw stronger conclusions?

${EPISTEMIC_GUARDRAILS}`,
        },
      }],
    }),
  );
}
