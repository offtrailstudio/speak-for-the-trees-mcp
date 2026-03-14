import { z } from "zod";

export const iNatPhotoSchema = z
  .object({
    id: z.number(),
    url: z.string(),
    attribution: z.string(),
    license_code: z.string().nullable(),
  })
  .passthrough();

export const iNatTaxonSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    rank: z.string(),
    iconic_taxon_name: z.string().nullable(),
    preferred_common_name: z.string().optional(),
    ancestry: z.string().nullable(),
    wikipedia_url: z.string().nullable(),
    threatened: z.boolean().optional().default(false),
    native: z.boolean().optional().default(false),
    introduced: z.boolean().optional().default(false),
  })
  .passthrough();

export const iNatUserSchema = z
  .object({
    id: z.number(),
    login: z.string(),
    name: z.string().nullable(),
  })
  .passthrough();

export const iNatObservationSchema = z
  .object({
    id: z.number(),
    uuid: z.string(),
    species_guess: z.string().nullable(),
    taxon: iNatTaxonSchema.nullable(),
    observed_on: z.string(),
    time_observed_at: z.string().nullable(),
    location: z.string().nullable(),
    place_guess: z.string().nullable(),
    quality_grade: z.enum(["research", "needs_id", "casual"]),
    uri: z.string(),
    photos: z.array(iNatPhotoSchema),
    user: iNatUserSchema,
  })
  .passthrough();

export const iNatResponseSchema = z.object({
  total_results: z.number(),
  page: z.number(),
  per_page: z.number(),
  results: z.array(iNatObservationSchema),
});
