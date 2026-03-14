export const ATTAINS_MAPSERVER_URL =
  "https://gispub.epa.gov/arcgis/rest/services/OW/ATTAINS_Assessment/MapServer";

export const ATTAINS_DEFAULTS = {
  searchRadiusMiles: 5,
  maxResults: 25,
  userAgent: "SpeakForTheTrees/0.1.0",
  fetchTimeoutMs: 15_000,
} as const;

export const ATTAINS_LAYERS = {
  points: 0,
  lines: 1,
  areas: 2,
} as const;

export const IR_CATEGORIES: Record<string, string> = {
  "1": "All designated uses attained — not impaired",
  "2": "Some uses attained; insufficient data for others",
  "3": "Insufficient data to determine impairment",
  "4A": "Impaired — TMDL completed",
  "4B": "Impaired — other controls expected to address impairment",
  "4C": "Impaired — not caused by a pollutant",
  "5": "Impaired — requires TMDL (303(d) listed)",
  "5A": "Impaired — requires TMDL, new listing",
  "5M": "Impaired — requires TMDL, monitoring scheduled",
};
