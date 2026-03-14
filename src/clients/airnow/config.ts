// AirNow API provides EPA air quality data (AQI, pollutant readings) by location.
// Requires a free API key: https://docs.airnowapi.org/
// Set AIRNOW_API_KEY environment variable to enable this client.
export const AIRNOW_BASE_URL = "https://www.airnowapi.org/aq";

export const AIRNOW_DEFAULTS = {
  searchRadiusMiles: 25,
  userAgent: "SpeakForTheTrees/0.2.0",
  fetchTimeoutMs: 15_000,
} as const;
