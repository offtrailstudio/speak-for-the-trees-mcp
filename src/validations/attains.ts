import { z } from "zod";

export const attainsFeatureAttributesSchema = z.object({
  assessmentunitidentifier: z.string().nullish(),
  assessmentunitname: z.string().nullish(),
  reportingcycle: z.string().nullish(),
  ircategory: z.string().nullish(),
  overallstatus: z.string().nullish(),
  isassessed: z.string().nullish(),
  isimpaired: z.string().nullish(),
  isthreatened: z.string().nullish(),
  on303dlist: z.string().nullish(),
  hastmdl: z.string().nullish(),
  has4bplan: z.string().nullish(),
  causegrouppathogens: z.string().nullish(),
  causegroupnutrients: z.string().nullish(),
  causegroupmetals: z.string().nullish(),
  causegroupmercury: z.string().nullish(),
  causegrouporganicdepletionoxygendepletion: z.string().nullish(),
  causegrouppesticides: z.string().nullish(),
  causegroupsediment: z.string().nullish(),
  causegrouptemperature: z.string().nullish(),
  causegrouphabitat: z.string().nullish(),
  causegroupflow: z.string().nullish(),
  causegroupph: z.string().nullish(),
  causegroupturbidity: z.string().nullish(),
  causegroupother: z.string().nullish(),
});

export const attainsFeatureSchema = z.object({
  attributes: attainsFeatureAttributesSchema,
});

export const attainsQueryResponseSchema = z.object({
  features: z.array(attainsFeatureSchema),
});
