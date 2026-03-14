import type { INatObservation } from "../../types/inaturalist.js";

export function formatObservationsForPrompt(
  observations: INatObservation[],
  period: string,
): string {
  if (observations.length === 0) return "";

  const lines = observations.map((obs) => {
    const name = obs.taxon
      ? `${obs.taxon.preferred_common_name ?? obs.taxon.name} (${obs.taxon.name})`
      : obs.species_guess ?? "Unidentified";

    const flags: string[] = [];
    if (obs.taxon?.threatened) flags.push("THREATENED");
    if (obs.taxon?.introduced) flags.push("INTRODUCED");
    if (obs.taxon?.native) flags.push("native");

    const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
    return `- ${name}${flagStr} | ${obs.observed_on} | ${obs.quality_grade} | ${obs.place_guess ?? "unknown location"}`;
  });

  return `Species observations from the past ${period} (${observations.length} records). NOTE: These are community science observations from iNaturalist — they indicate species presence at a point in time, not population size, abundance, or ecosystem health. Observation counts reflect observer effort, not species prevalence.\n${lines.join("\n")}`;
}
