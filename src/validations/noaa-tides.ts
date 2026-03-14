import { z } from "zod";

export const noaaWaterLevelReadingSchema = z
  .object({
    t: z.string(),
    v: z.string(),
    s: z.string(),
    f: z.string(),
    q: z.string(),
  })
  .passthrough();

export const noaaWaterLevelResponseSchema = z.object({
  data: z.array(noaaWaterLevelReadingSchema),
});

export const noaaPredictionReadingSchema = z
  .object({
    t: z.string(),
    v: z.string(),
  })
  .passthrough();

export const noaaPredictionResponseSchema = z.object({
  predictions: z.array(noaaPredictionReadingSchema),
});

export const noaaErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
});

export const noaaStationSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    lat: z.number(),
    lng: z.number(),
    state: z.string().nullable().optional(),
    tidal: z.boolean().optional(),
  })
  .passthrough();

export const noaaStationsResponseSchema = z.object({
  count: z.number(),
  stations: z.array(noaaStationSchema),
});
