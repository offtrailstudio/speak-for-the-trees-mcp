import { describe, it, expect } from "vitest";
import { formatTriFacilitiesForPrompt, formatTriReleasesForPrompt } from "./summarize.js";
import type { TriFacility, FacilityTriDetail } from "../../types/tri.js";

const makeFacility = (overrides: Partial<TriFacility> = {}): TriFacility => ({
  triId: "12508TCKND248TI",
  facilityName: "TUCK INDUSTRIES INC",
  city: "BEACON",
  county: "DUTCHESS",
  state: "NY",
  latitude: 41.493889,
  longitude: -73.969444,
  ...overrides,
});

const makeDetail = (overrides: Partial<FacilityTriDetail> = {}): FacilityTriDetail => ({
  triId: "12508TCKND248TI",
  facilityName: "TUCK INDUSTRIES INC",
  chemicals: [
    {
      chemicalName: "LEAD",
      reportingYear: "2022",
      totalAirReleases: 500,
      totalWaterReleases: 0,
      totalLandReleases: 100,
      totalOnSiteReleases: 600,
      totalOffSiteTransfers: 50,
    },
    {
      chemicalName: "MERCURY",
      reportingYear: "2022",
      totalAirReleases: 10,
      totalWaterReleases: 5,
      totalLandReleases: 0,
      totalOnSiteReleases: 15,
      totalOffSiteTransfers: 0,
    },
  ],
  ...overrides,
});

describe("formatTriFacilitiesForPrompt", () => {
  it("returns empty-state message when no facilities", () => {
    const result = formatTriFacilitiesForPrompt([], "DUTCHESS", "NY");
    expect(result).toContain("No TRI-reporting facilities");
    expect(result).toContain("DUTCHESS County, NY");
  });

  it("includes facility name and triId in output", () => {
    const result = formatTriFacilitiesForPrompt([makeFacility()], "DUTCHESS", "NY");
    expect(result).toContain("TUCK INDUSTRIES INC");
    expect(result).toContain("12508TCKND248TI");
  });

  it("includes county and state in header", () => {
    const result = formatTriFacilitiesForPrompt([makeFacility()], "DUTCHESS", "NY");
    expect(result).toContain("DUTCHESS County, NY");
  });

  it("includes city and state in facility line", () => {
    const result = formatTriFacilitiesForPrompt([makeFacility()], "DUTCHESS", "NY");
    expect(result).toContain("BEACON, NY");
  });
});

describe("formatTriReleasesForPrompt", () => {
  it("returns empty-state message when no details", () => {
    const result = formatTriReleasesForPrompt([]);
    expect(result).toContain("No chemical release data");
  });

  it("uses triId (not sourceId) in facility header", () => {
    const result = formatTriReleasesForPrompt([makeDetail()]);
    expect(result).toContain("12508TCKND248TI");
  });

  it("uses reportingYear (not reportYear) for year annotation", () => {
    const result = formatTriReleasesForPrompt([makeDetail()]);
    expect(result).toContain("2022");
  });

  it("sorts chemicals by total on-site releases descending", () => {
    const result = formatTriReleasesForPrompt([makeDetail()]);
    const leadIdx = result.indexOf("LEAD");
    const mercuryIdx = result.indexOf("MERCURY");
    expect(leadIdx).toBeLessThan(mercuryIdx);
  });

  it("shows air/water/land breakdown", () => {
    const result = formatTriReleasesForPrompt([makeDetail()]);
    expect(result).toContain("air: 500 lbs");
    expect(result).toContain("land: 100 lbs");
  });
});
