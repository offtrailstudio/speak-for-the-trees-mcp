import type { GbifOccurrence } from "../../types/gbif.js";

const IUCN_THREAT_LEVELS = new Set(["CR", "EN", "VU", "NT"]);
const IUCN_LABELS: Record<string, string> = {
  CR: "Critically Endangered",
  EN: "Endangered",
  VU: "Vulnerable",
  NT: "Near Threatened",
  LC: "Least Concern",
  DD: "Data Deficient",
  EX: "Extinct",
  EW: "Extinct in the Wild",
};

export function formatGbifOccurrencesForPrompt(
  occurrences: GbifOccurrence[],
  totalCount: number,
  dateRange: string,
): string {
  if (occurrences.length === 0) {
    return `No GBIF species occurrences found in this area for the period: ${dateRange}. This may reflect a data gap rather than absence — GBIF aggregates records from museum collections, citizen science platforms, and research datasets, and coverage varies by region.`;
  }

  const parts: string[] = [
    `GBIF species occurrences in this area — ${dateRange} (${totalCount.toLocaleString()} total records; showing ${occurrences.length}):`,
    "GBIF aggregates records from museum collections, research expeditions, iNaturalist, eBird, and other sources. Each record represents a documented occurrence, not a population estimate.",
  ];

  // Group by kingdom
  const byKingdom = new Map<string, GbifOccurrence[]>();
  for (const o of occurrences) {
    const kingdom = o.kingdom ?? "Unknown";
    if (!byKingdom.has(kingdom)) byKingdom.set(kingdom, []);
    byKingdom.get(kingdom)!.push(o);
  }

  const kingdomOrder = ["Animalia", "Plantae", "Fungi", "Chromista", "Protista", "Bacteria", "Unknown"];
  const sortedKingdoms = [...byKingdom.keys()].sort(
    (a, b) => {
      const ai = kingdomOrder.indexOf(a);
      const bi = kingdomOrder.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    },
  );

  parts.push(`\nKingdom breakdown: ${sortedKingdoms.map((k) => `${k} (${byKingdom.get(k)!.length})`).join(", ")}`);

  // Threatened / IUCN-listed species
  const threatened = occurrences.filter(
    (o) => o.iucnRedListCategory && IUCN_THREAT_LEVELS.has(o.iucnRedListCategory),
  );
  if (threatened.length > 0) {
    parts.push(`\nSpecies with IUCN conservation status (${threatened.length}):`);
    for (const o of threatened.slice(0, 10)) {
      const label = o.iucnRedListCategory ? (IUCN_LABELS[o.iucnRedListCategory] ?? o.iucnRedListCategory) : "";
      const name = o.species ?? o.scientificName;
      parts.push(`  - ${name} (${o.family ?? o.kingdom ?? "unknown family"}) — ${label}`);
    }
    if (threatened.length > 10) parts.push(`  ...and ${threatened.length - 10} more`);
  }

  // Introduced / invasive species
  const introduced = occurrences.filter(
    (o) => o.establishmentMeans && o.establishmentMeans.toUpperCase() !== "NATIVE",
  );
  if (introduced.length > 0) {
    parts.push(`\nNon-native species occurrences (${introduced.length}):`);
    const grouped = new Map<string, GbifOccurrence[]>();
    for (const o of introduced) {
      const means = o.establishmentMeans ?? "Unknown";
      if (!grouped.has(means)) grouped.set(means, []);
      grouped.get(means)!.push(o);
    }
    for (const [means, group] of grouped) {
      const names = [...new Set(group.map((o) => o.species ?? o.scientificName).filter(Boolean))];
      parts.push(`  ${means}: ${names.slice(0, 5).join(", ")}${names.length > 5 ? ` ...and ${names.length - 5} more` : ""}`);
    }
  }

  // Top families by occurrence count
  const byFamily = new Map<string, number>();
  for (const o of occurrences) {
    if (o.family) {
      byFamily.set(o.family, (byFamily.get(o.family) ?? 0) + 1);
    }
  }
  const topFamilies = [...byFamily.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (topFamilies.length > 0) {
    parts.push(`\nMost-recorded families: ${topFamilies.map(([f, n]) => `${f} (${n})`).join(", ")}`);
  }

  parts.push("\nNote: GBIF records are occurrence data — they document presence at a point in time. They are not population surveys and should not be used to infer abundance or population trends.");

  return parts.join("\n");
}
