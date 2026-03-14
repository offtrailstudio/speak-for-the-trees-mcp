import type { TriFacility, FacilityTriDetail } from "../../types/tri.js";

const MAX_FACILITIES = 20;
const MAX_CHEMICALS_PER_FACILITY = 5;

export function formatTriFacilitiesForPrompt(
  facilities: TriFacility[],
  countyName: string,
  stateAbbr: string,
): string {
  if (facilities.length === 0) {
    return `No TRI-reporting facilities found near this location (${countyName} County, ${stateAbbr}). This means no facilities in this county reported chemical releases to the EPA Toxics Release Inventory, or none fall within the search bounds.`;
  }

  const parts: string[] = [
    `TRI-reporting facilities in ${countyName} County, ${stateAbbr} near this location (${facilities.length} found):`,
    "These facilities are required under the Emergency Planning and Community Right-to-Know Act (EPCRA) to report annual releases of listed toxic chemicals to the EPA.",
  ];

  const displayed = facilities.slice(0, MAX_FACILITIES);
  for (const f of displayed) {
    const location = [f.city, f.state].filter(Boolean).join(", ");
    parts.push(`- ${f.facilityName} (tri_id: ${f.triId}) | ${location || "location unknown"}`);
  }

  if (facilities.length > MAX_FACILITIES) {
    parts.push(`...and ${facilities.length - MAX_FACILITIES} more facilities`);
  }

  return parts.join("\n");
}

export function formatTriReleasesForPrompt(details: FacilityTriDetail[]): string {
  if (details.length === 0) {
    return "No chemical release data found for these facilities.";
  }

  const parts: string[] = [
    `Chemical release data from TRI Detailed Facility Reports. NOTE: TRI data is self-reported by facilities and represents annual totals, not real-time monitoring. Releases are measured in pounds per year. These are legally permitted releases above reporting thresholds — presence in TRI does not indicate a violation.`,
  ];

  for (const detail of details) {
    const sorted = [...detail.chemicals].sort(
      (a, b) => b.totalOnSiteReleases - a.totalOnSiteReleases,
    );
    const top = sorted.slice(0, MAX_CHEMICALS_PER_FACILITY);

    parts.push(`\n${detail.facilityName} (${detail.triId}):`);

    if (top.length === 0) {
      parts.push("  No release data available.");
      continue;
    }

    const yearNote = top[0]?.reportingYear ? ` (${top[0].reportingYear})` : "";
    parts.push(`  Top reported releases${yearNote}:`);

    for (const chem of top) {
      const releaseBreakdown = [
        chem.totalAirReleases > 0 ? `air: ${chem.totalAirReleases.toLocaleString()} lbs` : null,
        chem.totalWaterReleases > 0 ? `water: ${chem.totalWaterReleases.toLocaleString()} lbs` : null,
        chem.totalLandReleases > 0 ? `land: ${chem.totalLandReleases.toLocaleString()} lbs` : null,
      ].filter(Boolean).join(", ");

      const total = chem.totalOnSiteReleases > 0
        ? `${chem.totalOnSiteReleases.toLocaleString()} lbs total`
        : "amount not reported";

      parts.push(`  - ${chem.chemicalName}: ${total}${releaseBreakdown ? ` (${releaseBreakdown})` : ""}`);
    }

    if (sorted.length > MAX_CHEMICALS_PER_FACILITY) {
      parts.push(`  ...and ${sorted.length - MAX_CHEMICALS_PER_FACILITY} more chemicals`);
    }
  }

  return parts.join("\n");
}
