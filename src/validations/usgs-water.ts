import { z } from "zod";

export const usgsPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]),
});

export const usgsFeaturePropertiesSchema = z
  .object({
    monitoring_location_id: z.string(),
    parameter_code: z.string(),
    parameter_name: z.string().optional(),
    value: z.string().nullable(),
    unit_of_measure: z.string(),
    time: z.string(),
    approval_status: z.string().optional(),
    qualifier: z.union([
      z.string(),
      z.array(z.string()).transform((arr) => arr.join(", ")),
    ]).nullish(),
  })
  .passthrough();

export const usgsFeatureSchema = z
  .object({
    type: z.literal("Feature"),
    properties: usgsFeaturePropertiesSchema,
    geometry: usgsPointSchema.nullable(),
  })
  .passthrough();

export const usgsResponseSchema = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z.array(usgsFeatureSchema),
    numberReturned: z.number(),
  })
  .passthrough();

export const usgsMonitoringLocationPropsSchema = z
  .object({
    id: z.string(),
    monitoring_location_name: z.string().optional(),
  })
  .passthrough();

export const usgsMonitoringLocationFeatureSchema = z
  .object({
    type: z.literal("Feature"),
    properties: usgsMonitoringLocationPropsSchema,
    geometry: usgsPointSchema.nullable(),
  })
  .passthrough();

export const usgsMonitoringLocationsResponseSchema = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z.array(usgsMonitoringLocationFeatureSchema),
    numberReturned: z.number(),
  })
  .passthrough();
