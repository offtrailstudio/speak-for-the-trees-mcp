export type FetchWaterDataParams = {
  daysBack?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  parameterCodes?: string[];
  monitoringLocationIds?: string[];
};

export type WaterReading = {
  parameterCode: string;
  parameterName: string;
  value: number;
  unit: string;
  time: string;
  locationId: string;
};

export type UsgsStation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};
