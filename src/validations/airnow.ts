import { z } from "zod";

export const airNowObservationSchema = z.object({
  DateObserved: z.string(),
  HourObserved: z.number(),
  LocalTimeZone: z.string(),
  ReportingArea: z.string(),
  StateCode: z.string(),
  Latitude: z.number(),
  Longitude: z.number(),
  ParameterName: z.string(),
  AQI: z.number(),
  Category: z.object({
    Number: z.number(),
    Name: z.string(),
  }),
});

export const airNowResponseSchema = z.array(airNowObservationSchema);
