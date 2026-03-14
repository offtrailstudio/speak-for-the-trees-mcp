// GBIF (Global Biodiversity Information Facility) occurrence API.
// No API key required for read-only occurrence searches.
export const GBIF_BASE_URL = "https://api.gbif.org/v1";

export const GBIF_DEFAULTS = {
  limit: 300,
  userAgent: "SpeakForTheTrees/0.2.0",
  fetchTimeoutMs: 15_000,
} as const;
