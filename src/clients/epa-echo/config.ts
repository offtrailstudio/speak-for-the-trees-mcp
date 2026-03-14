export const EPA_ECHO_BASE_URL = "https://echodata.epa.gov/echo";

export const EPA_ECHO_DEFAULTS = {
  searchRadiusMiles: 10,
  responseset: 100,
  userAgent: "SpeakForTheTrees/0.1.0",
  fetchTimeoutMs: 15_000,
} as const;
