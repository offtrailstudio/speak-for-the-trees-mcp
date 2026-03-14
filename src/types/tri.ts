
export type FetchTriFacilitiesParams = {
  center: { lat: number; lng: number };
  radiusMiles?: number;
};

export type TriFacility = {
  triId: string;
  facilityName: string;
  city: string | null;
  county: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type TriChemicalRelease = {
  chemicalName: string;
  reportingYear: string;
  totalAirReleases: number;
  totalWaterReleases: number;
  totalLandReleases: number;
  totalOnSiteReleases: number;
  totalOffSiteTransfers: number;
};

export type FacilityTriDetail = {
  triId: string;
  facilityName: string;
  chemicals: TriChemicalRelease[];
};
