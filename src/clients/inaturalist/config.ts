export const INATURALIST_BASE_URL = "https://api.inaturalist.org/v1";

export const INATURALIST_DEFAULTS = {
  perPage: 30,
  maxPerPage: 200,
  defaultDaysBack: 30,
  userAgent: "SpeakForTheTrees/0.1.0",
  fetchTimeoutMs: 15_000,
} as const;
