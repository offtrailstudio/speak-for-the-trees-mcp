import { z } from 'zod';

type Hydrolocation = {
    comid: string;
    name: string | null;
    reachcode: string | null;
    measure: number | null;
    lat: number;
    lng: number;
};

type FetchWaterDataParams = {
    daysBack?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    parameterCodes?: string[];
    monitoringLocationIds?: string[];
};
type WaterReading = {
    parameterCode: string;
    parameterName: string;
    value: number;
    unit: string;
    time: string;
    locationId: string;
};
type UsgsStation = {
    id: string;
    name: string;
    lat: number;
    lng: number;
};

type HydrolocationResult = {
    success: true;
    hydrolocation: Hydrolocation;
} | {
    success: false;
    error: string;
};
type UpstreamStationsResult = {
    success: true;
    stations: UsgsStation[];
} | {
    success: false;
    error: string;
};
declare function fetchHydrolocation(lat: number, lng: number): Promise<HydrolocationResult>;
declare function fetchUpstreamStations(comid: string, distanceKm?: number): Promise<UpstreamStationsResult>;
declare function fetchDownstreamStations(comid: string, distanceKm?: number): Promise<UpstreamStationsResult>;

type GeoBounds = {
    swlat: number;
    swlng: number;
    nelat: number;
    nelng: number;
};
type GeoCenter = {
    lat: number;
    lng: number;
};
type LocationConfig = {
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

type WaterDataResult = {
    success: true;
    readings: WaterReading[];
    totalResults: number;
} | {
    success: false;
    error: string;
};
declare function fetchWaterData(params?: FetchWaterDataParams): Promise<WaterDataResult>;
type StationDiscoveryResult = {
    success: true;
    stations: UsgsStation[];
} | {
    success: false;
    error: string;
};
declare function fetchMonitoringLocations(bounds: GeoBounds): Promise<StationDiscoveryResult>;
declare function filterActiveStations(stationIds: string[]): Promise<string[]>;

declare function formatWaterDataForPrompt(readings: WaterReading[], period: string): string;

type FetchEchoFacilitiesParams = {
    radiusMiles?: number;
    center?: GeoCenter;
};
type EchoFacility = {
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
type EchoComplianceSummary = {
    totalFacilities: number;
    significantViolations: number;
    currentViolations: number;
    violationsLast4Quarters: number;
    formalEnforcementActions: number;
    inspections: number;
    totalPenalties: string | null;
};
type EffluentViolation = {
    parameterName: string;
    dischargePoint: string;
    quarterDate: string;
    exceedancePercent: number;
    status: string;
};
type FacilityViolationDetail = {
    sourceId: string;
    facilityName: string;
    violations: EffluentViolation[];
};

type EchoResult = {
    success: true;
    facilities: EchoFacility[];
    complianceSummary: EchoComplianceSummary;
    totalResults: number;
} | {
    success: false;
    error: string;
};
declare function fetchEchoFacilities(params?: FetchEchoFacilitiesParams): Promise<EchoResult>;
declare function fetchSncFacilityIds(center: {
    lat: number;
    lng: number;
}, radiusMiles?: number): Promise<{
    sourceId: string;
    facilityName: string;
}[]>;
type ViolationDetailsResult = {
    success: true;
    details: FacilityViolationDetail[];
} | {
    success: false;
    error: string;
};
declare function fetchViolationDetails(facilities: {
    sourceId: string;
    facilityName: string;
}[]): Promise<ViolationDetailsResult>;

type EchoData = {
    facilities: EchoFacility[];
    complianceSummary: EchoComplianceSummary;
    violationDetails?: FacilityViolationDetail[];
};
declare function formatEchoDataForPrompt(data: EchoData): string;
declare function formatViolationDetailsAsText(details: FacilityViolationDetail[]): string;

type FetchTidalDataParams = {
    daysBack?: number;
    startDate?: Date;
    endDate?: Date;
    station?: string;
};
type TideReading = {
    time: string;
    value: number;
    sigma: number;
    flags: string;
    quality: string;
};
type TidePrediction = {
    time: string;
    value: number;
};
type NoaaStation = {
    id: string;
    name: string;
    lat: number;
    lng: number;
    state: string | null;
    tidal: boolean;
};

type TidalDataResult = {
    success: true;
    observations: TideReading[];
    predictions: TidePrediction[];
    station: string;
} | {
    success: false;
    error: string;
};
declare function fetchTidalData(params?: FetchTidalDataParams): Promise<TidalDataResult>;
type StationListResult = {
    success: true;
    stations: NoaaStation[];
} | {
    success: false;
    error: string;
};
declare function fetchNoaaStations(): Promise<StationListResult>;

type TidalData = {
    observations: TideReading[];
    predictions: TidePrediction[];
    station: string;
};
declare function formatTidalDataForPrompt(data: TidalData, period: string): string;

declare const iNatObservationSchema: z.ZodObject<{
    id: z.ZodNumber;
    uuid: z.ZodString;
    species_guess: z.ZodNullable<z.ZodString>;
    taxon: z.ZodNullable<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        rank: z.ZodString;
        iconic_taxon_name: z.ZodNullable<z.ZodString>;
        preferred_common_name: z.ZodOptional<z.ZodString>;
        ancestry: z.ZodNullable<z.ZodString>;
        wikipedia_url: z.ZodNullable<z.ZodString>;
        threatened: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        native: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        introduced: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$loose>>;
    observed_on: z.ZodString;
    time_observed_at: z.ZodNullable<z.ZodString>;
    location: z.ZodNullable<z.ZodString>;
    place_guess: z.ZodNullable<z.ZodString>;
    quality_grade: z.ZodEnum<{
        research: "research";
        needs_id: "needs_id";
        casual: "casual";
    }>;
    uri: z.ZodString;
    photos: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        url: z.ZodString;
        attribution: z.ZodString;
        license_code: z.ZodNullable<z.ZodString>;
    }, z.core.$loose>>;
    user: z.ZodObject<{
        id: z.ZodNumber;
        login: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
    }, z.core.$loose>;
}, z.core.$loose>;

type INatObservation = z.infer<typeof iNatObservationSchema>;
type FetchObservationsParams = {
    daysBack?: number;
    startDate?: Date;
    endDate?: Date;
    perPage?: number;
    page?: number;
    bounds?: GeoBounds;
};

type ObservationsResult = {
    success: true;
    observations: INatObservation[];
    totalResults: number;
    page: number;
    perPage: number;
} | {
    success: false;
    error: string;
};
declare function fetchObservations(params?: FetchObservationsParams): Promise<ObservationsResult>;

declare function formatObservationsForPrompt(observations: INatObservation[], period: string): string;

type ImpairedWater = {
    /** Assessment unit identifier (e.g., "NY-1302-0008") */
    assessmentUnitId: string;
    /** Human-readable name (e.g., "Hudson River Lower, Upper segment") */
    assessmentUnitName: string;
    /** EPA IR category (e.g., "5", "4A") */
    irCategory: string;
    /** Plain-language category meaning */
    irCategoryDescription: string;
    /** Overall status: "Fully Supporting", "Not Supporting", etc. */
    overallStatus: string;
    /** Whether this water body is on the 303(d) list */
    on303dList: boolean;
    /** Whether assessed as impaired */
    isImpaired: boolean;
    /** Whether a TMDL exists */
    hasTmdl: boolean;
    /** Reporting cycle year */
    reportingCycle: string;
    /** Cause categories flagged (e.g., "PATHOGENS", "NUTRIENTS") */
    causes: string[];
};

type ImpairedWatersResult = {
    success: true;
    waters: ImpairedWater[];
} | {
    success: false;
    error: string;
};
declare function fetchImpairedWaters(center: GeoCenter, radiusMiles?: number): Promise<ImpairedWatersResult>;

declare function formatImpairedWatersForPrompt(waters: ImpairedWater[], radiusMiles: number): string;

declare function resolveLocation(latitude: number, longitude: number): Promise<LocationConfig>;

/** Flexible temporal scoping for agent tool calls */
type TimeRange = {
    /** Relative: last N days from now */
    days_back?: number;
    /** Absolute start date (ISO 8601, e.g. "2025-06-01") */
    start_date?: string;
    /** Absolute end date (ISO 8601). Defaults to today. */
    end_date?: string;
    /** Named period shortcut */
    period?: "week" | "month" | "quarter" | "year";
};
/** Resolved concrete values from a TimeRange */
type ResolvedTimeRange = {
    startDate: Date;
    endDate: Date;
    daysBack: number;
};

declare function resolveTimeRange(input?: TimeRange): ResolvedTimeRange;

declare function haversineDistance(a: GeoCenter, b: GeoCenter): number;
declare function bboxFromCenter(center: GeoCenter, radiusKm: number): GeoBounds;
declare function findNearest<T extends {
    lat: number;
    lng: number;
}>(items: T[], point: GeoCenter, n: number): T[];

export { bboxFromCenter, fetchDownstreamStations, fetchEchoFacilities, fetchHydrolocation, fetchImpairedWaters, fetchMonitoringLocations, fetchNoaaStations, fetchObservations, fetchSncFacilityIds, fetchTidalData, fetchUpstreamStations, fetchViolationDetails, fetchWaterData, filterActiveStations, findNearest, formatEchoDataForPrompt, formatImpairedWatersForPrompt, formatObservationsForPrompt, formatTidalDataForPrompt, formatViolationDetailsAsText, formatWaterDataForPrompt, haversineDistance, resolveLocation, resolveTimeRange };
