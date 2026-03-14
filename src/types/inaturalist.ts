import { z } from "zod";
import {
  iNatObservationSchema,
  iNatResponseSchema,
} from "../validations/inaturalist.js";

export type INatObservation = z.infer<typeof iNatObservationSchema>;
export type INatResponse = z.infer<typeof iNatResponseSchema>;

import type { GeoBounds } from "./location.js";

export type FetchObservationsParams = {
  daysBack?: number;
  startDate?: Date;
  endDate?: Date;
  perPage?: number;
  page?: number;
  bounds?: GeoBounds;
};
