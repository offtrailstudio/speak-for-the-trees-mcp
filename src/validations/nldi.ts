import { z } from "zod";

export const nldiPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]),
});

export const nldiHydrolocationPropsSchema = z
  .object({
    identifier: z.string().optional(),
    name: z.string().optional(),
    comid: z.string().optional(),
    source: z.string().optional(),
    navigation: z.string().optional(),
    measure: z.string().optional(),
    reachcode: z.string().optional(),
  })
  .passthrough();

export const nldiHydrolocationFeatureSchema = z
  .object({
    type: z.literal("Feature"),
    geometry: nldiPointSchema.nullable(),
    properties: nldiHydrolocationPropsSchema,
  })
  .passthrough();

export const nldiHydrolocationResponseSchema = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z.array(nldiHydrolocationFeatureSchema),
  })
  .passthrough();

const nldiFlowlineGeometrySchema = z.object({
  type: z.enum(["LineString", "MultiLineString"]),
  coordinates: z.any(),
});

export const nldiFlowlinePropsSchema = z
  .object({
    nhdplus_comid: z.string().optional(),
  })
  .passthrough();

export const nldiFlowlineFeatureSchema = z
  .object({
    type: z.literal("Feature"),
    geometry: nldiFlowlineGeometrySchema,
    properties: nldiFlowlinePropsSchema,
  })
  .passthrough();

export const nldiFlowlinesResponseSchema = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z.array(nldiFlowlineFeatureSchema),
  })
  .passthrough();

const nldiBasinGeometrySchema = z.object({
  type: z.enum(["Polygon", "MultiPolygon"]),
  coordinates: z.any(),
});

export const nldiBasinFeatureSchema = z
  .object({
    type: z.literal("Feature"),
    geometry: nldiBasinGeometrySchema,
    properties: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const nldiBasinResponseSchema = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z.array(nldiBasinFeatureSchema),
  })
  .passthrough();
