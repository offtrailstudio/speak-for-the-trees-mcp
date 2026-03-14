export const NLDI_BASE_URL = "https://api.water.usgs.gov/nldi";

export const NLDI_DEFAULTS = {
  navigationDistanceKm: 50,
  navigationMode: "UT",
  userAgent: "SpeakForTheTrees/0.1.0",
  fetchTimeoutMs: 15_000,
} as const;
