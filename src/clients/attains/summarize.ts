import type { ImpairedWater } from "../../types/attains.js";

export function formatImpairedWatersForPrompt(
  waters: ImpairedWater[],
  radiusMiles: number,
): string {
  if (waters.length === 0) {
    return `No assessed water bodies found within ${radiusMiles} miles. This may mean the area has not been assessed, not that the waters are unimpaired.`;
  }

  const impaired = waters.filter((w) => w.isImpaired);
  const on303d = waters.filter((w) => w.on303dList);
  const supporting = waters.filter(
    (w) => w.overallStatus === "Fully Supporting",
  );

  const parts: string[] = [];

  parts.push(
    `EPA 303(d) impaired waters assessment within ${radiusMiles} miles (${waters.length} assessed water bodies). Source: EPA ATTAINS database. NOTE: These are official regulatory designations based on state water quality assessments submitted to the EPA, typically updated every 2 years. The reporting cycle year indicates when the assessment was last updated, not necessarily when monitoring occurred.`,
  );

  parts.push(
    `Summary: ${impaired.length} impaired, ${on303d.length} on 303(d) list, ${supporting.length} fully supporting designated uses.`,
  );

  for (const w of waters) {
    const status = w.isImpaired ? "IMPAIRED" : "not impaired";
    const listed = w.on303dList ? ", 303(d) LISTED" : "";
    const tmdl = w.hasTmdl ? ", TMDL exists" : "";
    const causes =
      w.causes.length > 0 ? ` | causes: ${w.causes.join(", ")}` : "";

    parts.push(
      `- ${w.assessmentUnitName} (${w.assessmentUnitId}): ${status}${listed}${tmdl} | ${w.irCategoryDescription} | cycle: ${w.reportingCycle}${causes}`,
    );
  }

  return parts.join("\n");
}
