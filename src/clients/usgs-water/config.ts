export const USGS_WATER_BASE_URL =
  "https://api.waterdata.usgs.gov/ogcapi/v0";

export const MONITORING_LOCATIONS = ["USGS-01372043"] as const;

export const PARAMETER_CODES = {
  "00010": "Water Temperature",
  "00060": "Streamflow/Discharge",
  "00065": "Gage Height",
  "00300": "Dissolved Oxygen",
  "00400": "pH",
} as const;

export const USGS_WATER_DEFAULTS = {
  defaultDaysBack: 7,
  limit: 1000,
  maxLimit: 10000,
  userAgent: "SpeakForTheTrees/0.1.0",
  fetchTimeoutMs: 15_000,
} as const;
