export const NOAA_TIDES_BASE_URL =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

export const STATION_ID = "8518962";

export const NOAA_TIDES_DEFAULTS = {
  defaultDaysBack: 2,
  maxDaysBack: 7,
  datum: "MLLW",
  units: "metric",
  timeZone: "gmt",
  application: "speak-for-the-trees",
  fetchTimeoutMs: 15_000,
} as const;
