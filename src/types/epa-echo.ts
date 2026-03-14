import type { GeoCenter } from "./location.js";

export type FetchEchoFacilitiesParams = {
  radiusMiles?: number;
  center?: GeoCenter;
};

export type EchoFacility = {
  facilityName: string;
  sourceId: string;
  npdesId: string | null;
  permitStatus: string | null;
  city: string | null;
  state: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type EchoComplianceSummary = {
  totalFacilities: number;
  significantViolations: number;
  currentViolations: number;
  violationsLast4Quarters: number;
  formalEnforcementActions: number;
  inspections: number;
  totalPenalties: string | null;
};

export type EffluentViolation = {
  parameterName: string;
  dischargePoint: string;
  quarterDate: string;
  exceedancePercent: number;
  status: string;
};

export type FacilityViolationDetail = {
  sourceId: string;
  facilityName: string;
  violations: EffluentViolation[];
};
