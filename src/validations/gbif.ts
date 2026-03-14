import { z } from "zod";

export const gbifOccurrenceSchema = z
  .object({
    key: z.number(),
    species: z.string().nullish(),
    genus: z.string().nullish(),
    family: z.string().nullish(),
    kingdom: z.string().nullish(),
    scientificName: z.string(),
    decimalLatitude: z.number().nullish(),
    decimalLongitude: z.number().nullish(),
    eventDate: z.string().nullish(),
    year: z.number().nullish(),
    occurrenceStatus: z.string().nullish(),
    establishmentMeans: z.string().nullish(),
    iucnRedListCategory: z.string().nullish(),
    taxonRank: z.string().nullish(),
    datasetName: z.string().nullish(),
  })
  .passthrough();

export const gbifSearchResponseSchema = z.object({
  offset: z.number(),
  limit: z.number(),
  endOfRecords: z.boolean(),
  count: z.number(),
  results: z.array(gbifOccurrenceSchema),
});
