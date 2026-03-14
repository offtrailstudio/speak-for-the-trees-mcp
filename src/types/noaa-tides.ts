export type FetchTidalDataParams = {
  daysBack?: number;
  startDate?: Date;
  endDate?: Date;
  station?: string;
};

export type TideReading = {
  time: string;
  value: number;
  sigma: number;
  flags: string;
  quality: string;
};

export type TidePrediction = {
  time: string;
  value: number;
};

export type NoaaStation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state: string | null;
  tidal: boolean;
};
