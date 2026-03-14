import type {
  EchoFacility,
  EchoComplianceSummary,
  FacilityViolationDetail,
} from "../../types/epa-echo.js";

const MAX_FACILITIES_PER_GROUP = 10;
const MAX_VIOLATIONS_PER_FACILITY = 5;

export type EchoData = {
  facilities: EchoFacility[];
  complianceSummary: EchoComplianceSummary;
  violationDetails?: FacilityViolationDetail[];
};

export function formatEchoDataForPrompt(data: EchoData): string {
  const { facilities, complianceSummary: cs } = data;

  if (facilities.length === 0 && cs.totalFacilities === 0) return "";

  const parts: string[] = [];

  parts.push(
    `Permitted dischargers within search radius (${cs.totalFacilities} facilities with active Clean Water Act permits):`,
  );

  const stats: string[] = [];
  if (cs.significantViolations > 0)
    stats.push(`${cs.significantViolations} with significant violations`);
  if (cs.currentViolations > 0)
    stats.push(`${cs.currentViolations} with current violations`);
  if (cs.violationsLast4Quarters > 0)
    stats.push(
      `${cs.violationsLast4Quarters} with violations in the last 4 quarters`,
    );
  if (cs.formalEnforcementActions > 0)
    stats.push(
      `${cs.formalEnforcementActions} subject to formal enforcement actions`,
    );
  if (cs.inspections > 0) stats.push(`${cs.inspections} inspected`);
  if (cs.totalPenalties)
    stats.push(`${cs.totalPenalties} in total penalties assessed`);

  if (stats.length > 0) {
    parts.push(`Compliance overview: ${stats.join("; ")}.`);
  }

  if (facilities.length > 0) {
    const expired = facilities.filter((f) => f.permitStatus === "Expired");
    const effective = facilities.filter((f) => f.permitStatus === "Effective");
    const other = facilities.filter(
      (f) => f.permitStatus !== "Expired" && f.permitStatus !== "Effective",
    );

    if (expired.length > 0) {
      parts.push(`Facilities with expired permits (${expired.length}):`);
      for (const f of expired.slice(0, MAX_FACILITIES_PER_GROUP)) {
        parts.push(formatFacilityLine(f));
      }
      if (expired.length > MAX_FACILITIES_PER_GROUP) {
        parts.push(
          `  ...and ${expired.length - MAX_FACILITIES_PER_GROUP} more`,
        );
      }
    }

    if (other.length > 0) {
      parts.push(
        `Facilities with non-standard permit status (${other.length}):`,
      );
      for (const f of other.slice(0, MAX_FACILITIES_PER_GROUP)) {
        parts.push(formatFacilityLine(f));
      }
      if (other.length > MAX_FACILITIES_PER_GROUP) {
        parts.push(`  ...and ${other.length - MAX_FACILITIES_PER_GROUP} more`);
      }
    }

    if (effective.length > 0) {
      parts.push(
        `${effective.length} nearby facilities hold effective permits.`,
      );
    }
  }

  if (data.violationDetails && data.violationDetails.length > 0) {
    parts.push(
      `\nSpecific effluent violations by significant noncompliance facilities:`,
    );
    for (const detail of data.violationDetails) {
      const sorted = [...detail.violations].sort(
        (a, b) => b.exceedancePercent - a.exceedancePercent,
      );
      const top = sorted.slice(0, MAX_VIOLATIONS_PER_FACILITY);
      const violationList = top
        .map(
          (v) =>
            `${v.parameterName} ${v.exceedancePercent}% over limit (${v.quarterDate})`,
        )
        .join(", ");
      const more =
        sorted.length > MAX_VIOLATIONS_PER_FACILITY
          ? ` and ${sorted.length - MAX_VIOLATIONS_PER_FACILITY} more`
          : "";
      parts.push(
        `- ${detail.facilityName} (${detail.sourceId}): ${violationList}${more}`,
      );
    }
  }

  return parts.join("\n");
}

export function formatViolationDetailsAsText(
  details: FacilityViolationDetail[],
): string {
  if (details.length === 0) return "No violation details found.";

  const parts: string[] = [
    `Effluent violation details for ${details.length} facility(ies). NOTE: These are permit limit exceedances reported to the EPA. A violation means the facility exceeded its permitted discharge level — it does not by itself indicate downstream ecological impact. Assessing actual impact would require water quality monitoring data from downstream stations during and after the discharge event.`,
  ];

  for (const detail of details) {
    const sorted = [...detail.violations].sort(
      (a, b) => b.exceedancePercent - a.exceedancePercent,
    );
    const lines = sorted.map(
      (v) =>
        `  - ${v.parameterName}: ${v.exceedancePercent}% over permit limit at discharge point ${v.dischargePoint} (${v.quarterDate})`,
    );
    parts.push(`${detail.facilityName} (${detail.sourceId}):`);
    parts.push(...lines);
  }

  return parts.join("\n");
}

function formatFacilityLine(f: EchoFacility): string {
  const location = [f.city, f.county ? `${f.county} County` : null, f.state]
    .filter(Boolean)
    .join(", ");
  const permit = f.npdesId ? ` | permit ${f.npdesId}` : "";
  const status = f.permitStatus ? ` | ${f.permitStatus}` : "";
  return `- ${f.facilityName}${permit}${status} | ${location || "location unknown"}`;
}
