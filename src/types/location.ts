export type GeoBounds = {
  swlat: number;
  swlng: number;
  nelat: number;
  nelng: number;
};

export type GeoCenter = {
  lat: number;
  lng: number;
};

export type LocationConfig = {
  slug: string;
  name: string;
  description: string;
  bounds: GeoBounds;
  center: GeoCenter;
  usgsStationIds: string[];
  noaaStationId: string;
  /** NLDI COMID for the nearest stream reach. Enables watershed-scoped queries. */
  comid?: string;
};
