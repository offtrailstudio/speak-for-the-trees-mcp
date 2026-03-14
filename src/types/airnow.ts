export type AirNowObservation = {
  dateTime: string;
  reportingArea: string;
  stateCode: string;
  latitude: number;
  longitude: number;
  parameterName: string;
  aqi: number;
  category: {
    number: number;
    name: string;
  };
};
