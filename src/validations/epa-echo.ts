import { z } from "zod";

export const echoFacilitySchema = z
  .object({
    CWPName: z.string(),
    SourceID: z.string(),
    CWPStreet: z.string().nullable().optional(),
    CWPCity: z.string().nullable().optional(),
    CWPState: z.string().nullable().optional(),
    CWPZip: z.string().nullable().optional(),
    CWPCounty: z.string().nullable().optional(),
    MasterExternalPermitNmbr: z.string().nullable().optional(),
    CWPPermitStatusDesc: z.string().nullable().optional(),
    FacLat: z.string().nullable().optional(),
    FacLong: z.string().nullable().optional(),
    CWPActualAverageFlowNmbr: z.string().nullable().optional(),
    EPASystem: z.string().nullable().optional(),
    Statute: z.string().nullable().optional(),
  })
  .passthrough();

export const echoGetFacilitiesResponseSchema = z
  .object({
    Results: z.object({
      Message: z.string(),
      QueryID: z.string(),
      QueryRows: z.string(),
      SVRows: z.union([z.string(), z.number()]).optional(),
      CVRows: z.union([z.string(), z.number()]).optional(),
      V3Rows: z.union([z.string(), z.number()]).optional(),
      FEARows: z.union([z.string(), z.number()]).optional(),
      InfFEARows: z.union([z.string(), z.number()]).optional(),
      INSPRows: z.union([z.string(), z.number()]).optional(),
      VioLast4QRows: z.union([z.string(), z.number()]).optional(),
      TotalPenalties: z.string().nullable().optional(),
    }).passthrough(),
  })
  .passthrough();

export const echoEffluentParameterSchema = z
  .object({
    ParameterName: z.string(),
    DischargePoint: z.string().nullable().optional(),
    Qtr1Status: z.string().nullable().optional(),
    Qtr2Status: z.string().nullable().optional(),
    Qtr3Status: z.string().nullable().optional(),
    Qtr4Status: z.string().nullable().optional(),
    Qtr5Status: z.string().nullable().optional(),
    Qtr6Status: z.string().nullable().optional(),
    Qtr7Status: z.string().nullable().optional(),
    Qtr8Status: z.string().nullable().optional(),
    Qtr9Status: z.string().nullable().optional(),
    Qtr10Status: z.string().nullable().optional(),
    Qtr11Status: z.string().nullable().optional(),
    Qtr12Status: z.string().nullable().optional(),
    Qtr13Status: z.string().nullable().optional(),
    Qtr1Value: z.string().nullable().optional(),
    Qtr2Value: z.string().nullable().optional(),
    Qtr3Value: z.string().nullable().optional(),
    Qtr4Value: z.string().nullable().optional(),
    Qtr5Value: z.string().nullable().optional(),
    Qtr6Value: z.string().nullable().optional(),
    Qtr7Value: z.string().nullable().optional(),
    Qtr8Value: z.string().nullable().optional(),
    Qtr9Value: z.string().nullable().optional(),
    Qtr10Value: z.string().nullable().optional(),
    Qtr11Value: z.string().nullable().optional(),
    Qtr12Value: z.string().nullable().optional(),
    Qtr13Value: z.string().nullable().optional(),
  })
  .passthrough();

export const echoEffluentHeaderSchema = z
  .object({
    Qtr1Start: z.string().optional(),
    Qtr1End: z.string().optional(),
    Qtr2Start: z.string().optional(),
    Qtr2End: z.string().optional(),
    Qtr3Start: z.string().optional(),
    Qtr3End: z.string().optional(),
    Qtr4Start: z.string().optional(),
    Qtr4End: z.string().optional(),
    Qtr5Start: z.string().optional(),
    Qtr5End: z.string().optional(),
    Qtr6Start: z.string().optional(),
    Qtr6End: z.string().optional(),
    Qtr7Start: z.string().optional(),
    Qtr7End: z.string().optional(),
    Qtr8Start: z.string().optional(),
    Qtr8End: z.string().optional(),
    Qtr9Start: z.string().optional(),
    Qtr9End: z.string().optional(),
    Qtr10Start: z.string().optional(),
    Qtr10End: z.string().optional(),
    Qtr11Start: z.string().optional(),
    Qtr11End: z.string().optional(),
    Qtr12Start: z.string().optional(),
    Qtr12End: z.string().optional(),
    Qtr13Start: z.string().optional(),
    Qtr13End: z.string().optional(),
  })
  .passthrough();

export const echoEffluentComplianceResponseSchema = z
  .object({
    Results: z.object({
      CWAEffluentCompliance: z.object({
        Header: echoEffluentHeaderSchema,
        Sources: z.array(
          z.object({
            Parameters: z.array(echoEffluentParameterSchema).optional(),
          }).passthrough(),
        ).optional(),
      }).passthrough(),
    }).passthrough(),
  })
  .passthrough();

export const echoGetQidResponseSchema = z
  .object({
    Results: z.object({
      Message: z.string(),
      QueryRows: z.string(),
      QueryID: z.string(),
      PageNo: z.string().optional(),
      Facilities: z.array(echoFacilitySchema),
    }).passthrough(),
  })
  .passthrough();
