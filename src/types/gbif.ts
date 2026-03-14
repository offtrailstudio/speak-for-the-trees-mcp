export type GbifOccurrence = {
  key: number;
  species: string | null;
  genus: string | null;
  family: string | null;
  kingdom: string | null;
  scientificName: string;
  decimalLatitude: number | null;
  decimalLongitude: number | null;
  eventDate: string | null;
  year: number | null;
  occurrenceStatus: string | null;
  establishmentMeans: string | null;
  iucnRedListCategory: string | null;
  taxonRank: string | null;
  datasetName: string | null;
};

export type GbifSearchResult = {
  count: number;
  endOfRecords: boolean;
  results: GbifOccurrence[];
};
