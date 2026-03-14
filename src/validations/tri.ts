import { z } from "zod";

export const triFacilitySchema = z
  .object({
    tri_facility_id: z.string(),
    facility_name: z.string(),
    city_name: z.string().nullish(),
    county_name: z.string().nullish(),
    state_abbr: z.string().nullish(),
    zip_code: z.string().nullish(),
    pref_latitude: z.number().nullish(),
    pref_longitude: z.number().nullish(),
  })
  .passthrough();

export const triFacilityArraySchema = z.array(triFacilitySchema);

export const triCountSchema = z.array(z.object({ TOTALQUERYRESULTS: z.number() }));

export const fccCountySchema = z.object({
  County: z.object({
    FIPS: z.string(),
    name: z.string(),
  }),
}).passthrough();

export const triReportingFormRowSchema = z
  .object({
    doc_ctrl_num: z.string(),
    tri_facility_id: z.string(),
    tri_chem_id: z.string().nullish(),
    reporting_year: z.string().nullish(),
    cas_chem_name: z.string().nullish(),
    generic_chem_name: z.string().nullish(),
  })
  .passthrough();

export const triReportingFormArraySchema = z.array(triReportingFormRowSchema);

export const triFormRRowSchema = z
  .object({
    doc_ctrl_num: z.string(),
    air_total_release: z.number().nullish(),
    water_total_release: z.number().nullish(),
    land_total_release: z.number().nullish(),
    fugitive_tot_rel: z.number().nullish(),
    stack_tot_rel: z.number().nullish(),
    off_site_total_transfers: z.number().nullish(),
  })
  .passthrough();

export const triFormRArraySchema = z.array(triFormRRowSchema);
