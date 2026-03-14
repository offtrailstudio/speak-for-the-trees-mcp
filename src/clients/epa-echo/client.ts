import {
  EPA_ECHO_BASE_URL,
  EPA_ECHO_DEFAULTS,
} from "./config.js";
import {
  echoGetFacilitiesResponseSchema,
  echoGetQidResponseSchema,
  echoEffluentComplianceResponseSchema,
} from "../../validations/epa-echo.js";
import type {
  FetchEchoFacilitiesParams,
  EchoFacility,
  EchoComplianceSummary,
  EffluentViolation,
  FacilityViolationDetail,
} from "../../types/epa-echo.js";

type EchoResult =
  | {
      success: true;
      facilities: EchoFacility[];
      complianceSummary: EchoComplianceSummary;
      totalResults: number;
    }
  | { success: false; error: string };

function toNumber(value: string | number | undefined | null): number {
  if (value == null) return 0;
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  return isNaN(n) ? 0 : n;
}

export async function fetchEchoFacilities(
  params: FetchEchoFacilitiesParams = {},
): Promise<EchoResult> {
  const {
    radiusMiles = EPA_ECHO_DEFAULTS.searchRadiusMiles,
    center = { lat: 42.04, lng: -73.91 },
  } = params;

  const clampedRadius = Math.min(Math.max(1, radiusMiles), 100);

  const facilitiesUrl = new URL(
    `${EPA_ECHO_BASE_URL}/cwa_rest_services.get_facilities`,
  );
  facilitiesUrl.searchParams.set("output", "JSON");
  facilitiesUrl.searchParams.set("p_lat", String(center.lat));
  facilitiesUrl.searchParams.set("p_long", String(center.lng));
  facilitiesUrl.searchParams.set("p_radius", String(clampedRadius));
  facilitiesUrl.searchParams.set("p_act", "Y");

  let facilitiesResponse: Response;
  try {
    facilitiesResponse = await fetch(facilitiesUrl.toString(), {
      headers: { "User-Agent": EPA_ECHO_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(EPA_ECHO_DEFAULTS.fetchTimeoutMs),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }

  if (!facilitiesResponse.ok) {
    return {
      success: false,
      error: `EPA ECHO API error: ${facilitiesResponse.status} ${facilitiesResponse.statusText}`,
    };
  }

  let facilitiesJson: unknown;
  try {
    facilitiesJson = await facilitiesResponse.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `EPA ECHO response parse error: ${message}` };
  }

  const facilitiesParsed =
    echoGetFacilitiesResponseSchema.safeParse(facilitiesJson);

  if (!facilitiesParsed.success) {
    return {
      success: false,
      error: `Validation error: ${facilitiesParsed.error.message}`,
    };
  }

  const { Results: stats } = facilitiesParsed.data;
  const qid = stats.QueryID;
  const totalFacilities = toNumber(stats.QueryRows);

  const complianceSummary: EchoComplianceSummary = {
    totalFacilities,
    significantViolations: toNumber(stats.SVRows),
    currentViolations: toNumber(stats.CVRows),
    violationsLast4Quarters: toNumber(stats.VioLast4QRows),
    formalEnforcementActions: toNumber(stats.FEARows),
    inspections: toNumber(stats.INSPRows),
    totalPenalties: stats.TotalPenalties ?? null,
  };

  if (totalFacilities === 0) {
    return {
      success: true,
      facilities: [],
      complianceSummary,
      totalResults: 0,
    };
  }

  const qidUrl = new URL(
    `${EPA_ECHO_BASE_URL}/cwa_rest_services.get_qid`,
  );
  qidUrl.searchParams.set("output", "JSON");
  qidUrl.searchParams.set("qid", qid);
  qidUrl.searchParams.set("pageno", "1");
  qidUrl.searchParams.set(
    "responseset",
    String(EPA_ECHO_DEFAULTS.responseset),
  );
  qidUrl.searchParams.set("qcolumns", "24,25");

  let qidResponse: Response;
  try {
    qidResponse = await fetch(qidUrl.toString(), {
      headers: { "User-Agent": EPA_ECHO_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(EPA_ECHO_DEFAULTS.fetchTimeoutMs),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `Network error: ${message}` };
  }

  if (!qidResponse.ok) {
    return {
      success: false,
      error: `EPA ECHO API error: ${qidResponse.status} ${qidResponse.statusText}`,
    };
  }

  let qidJson: unknown;
  try {
    qidJson = await qidResponse.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `EPA ECHO response parse error: ${message}` };
  }

  const qidParsed = echoGetQidResponseSchema.safeParse(qidJson);

  if (!qidParsed.success) {
    return {
      success: false,
      error: `Validation error: ${qidParsed.error.message}`,
    };
  }

  const facilities: EchoFacility[] = qidParsed.data.Results.Facilities.map(
    (raw) => {
      const lat = raw.FacLat ? parseFloat(raw.FacLat) : null;
      const lng = raw.FacLong ? parseFloat(raw.FacLong) : null;
      return {
        facilityName: raw.CWPName,
        sourceId: raw.SourceID,
        npdesId: raw.MasterExternalPermitNmbr ?? null,
        permitStatus: raw.CWPPermitStatusDesc ?? null,
        city: raw.CWPCity ?? null,
        state: raw.CWPState ?? null,
        county: raw.CWPCounty ?? null,
        latitude: lat !== null && !isNaN(lat) ? lat : null,
        longitude: lng !== null && !isNaN(lng) ? lng : null,
      };
    },
  );

  return {
    success: true,
    facilities,
    complianceSummary,
    totalResults: totalFacilities,
  };
}

export async function fetchSncFacilityIds(
  center: { lat: number; lng: number },
  radiusMiles: number = EPA_ECHO_DEFAULTS.searchRadiusMiles,
): Promise<{ sourceId: string; facilityName: string }[]> {
  const url = new URL(
    `${EPA_ECHO_BASE_URL}/cwa_rest_services.get_facilities`,
  );
  url.searchParams.set("output", "JSON");
  url.searchParams.set("p_lat", String(center.lat));
  url.searchParams.set("p_long", String(center.lng));
  url.searchParams.set("p_radius", String(radiusMiles));
  url.searchParams.set("p_act", "Y");
  url.searchParams.set("p_pccs", "SNC");

  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": EPA_ECHO_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(EPA_ECHO_DEFAULTS.fetchTimeoutMs),
    });
    if (!response.ok) return [];

    const json: unknown = await response.json();
    const parsed = echoGetFacilitiesResponseSchema.safeParse(json);
    if (!parsed.success) return [];

    const totalRows = toNumber(parsed.data.Results.QueryRows);
    if (totalRows === 0) return [];

    const qid = parsed.data.Results.QueryID;
    const qidUrl = new URL(
      `${EPA_ECHO_BASE_URL}/cwa_rest_services.get_qid`,
    );
    qidUrl.searchParams.set("output", "JSON");
    qidUrl.searchParams.set("qid", qid);
    qidUrl.searchParams.set("pageno", "1");
    qidUrl.searchParams.set("responseset", String(EPA_ECHO_DEFAULTS.responseset));

    const qidResponse = await fetch(qidUrl.toString(), {
      headers: { "User-Agent": EPA_ECHO_DEFAULTS.userAgent },
      signal: AbortSignal.timeout(EPA_ECHO_DEFAULTS.fetchTimeoutMs),
    });
    if (!qidResponse.ok) return [];

    const qidJson: unknown = await qidResponse.json();
    const qidParsed = echoGetQidResponseSchema.safeParse(qidJson);
    if (!qidParsed.success) return [];

    return qidParsed.data.Results.Facilities.map((f) => ({
      sourceId: f.SourceID,
      facilityName: f.CWPName,
    }));
  } catch {
    return [];
  }
}

type ViolationDetailsResult =
  | { success: true; details: FacilityViolationDetail[] }
  | { success: false; error: string };

function parseExceedancePercent(value: string): number | null {
  const match = value.match(/^(\d+(?:\.\d+)?)%$/);
  return match ? parseFloat(match[1]) : null;
}

async function fetchSingleFacilityViolations(
  sourceId: string,
  facilityName: string,
): Promise<FacilityViolationDetail | null> {
  const url = new URL(
    `${EPA_ECHO_BASE_URL}/dfr_rest_services.get_cwa_eff_compliance`,
  );
  url.searchParams.set("p_id", sourceId);
  url.searchParams.set("output", "JSON");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": EPA_ECHO_DEFAULTS.userAgent },
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const json: unknown = await response.json();
  const parsed = echoEffluentComplianceResponseSchema.safeParse(json);
  if (!parsed.success) return null;

  const compliance = parsed.data.Results.CWAEffluentCompliance;
  const sources = compliance.Sources;
  if (!sources || sources.length === 0) return null;

  const header = compliance.Header;
  const parameters = sources[0].Parameters ?? [];

  const violations: EffluentViolation[] = [];

  for (const param of parameters) {
    for (let q = 1; q <= 13; q++) {
      const statusKey = `Qtr${q}Status` as keyof typeof param;
      const valueKey = `Qtr${q}Value` as keyof typeof param;
      const status = param[statusKey] as string | null | undefined;
      const value = param[valueKey] as string | null | undefined;

      if (!status || !value) continue;
      if (status !== "S" && status !== "V") continue;

      const exceedance = parseExceedancePercent(value);
      if (exceedance === null) continue;

      const startKey = `Qtr${q}Start` as keyof typeof header;
      const endKey = `Qtr${q}End` as keyof typeof header;
      const qtrStart = header[startKey] as string | undefined;
      const qtrEnd = header[endKey] as string | undefined;
      const quarterDate = qtrEnd ?? qtrStart ?? `Q${q}`;

      violations.push({
        parameterName: param.ParameterName,
        dischargePoint: param.DischargePoint ?? "unknown",
        quarterDate,
        exceedancePercent: exceedance,
        status,
      });
    }
  }

  if (violations.length === 0) return null;

  return { sourceId, facilityName, violations };
}

export async function fetchViolationDetails(
  facilities: { sourceId: string; facilityName: string }[],
): Promise<ViolationDetailsResult> {
  if (facilities.length === 0) {
    return { success: true, details: [] };
  }

  try {
    const results = await Promise.allSettled(
      facilities.map((f) =>
        fetchSingleFacilityViolations(f.sourceId, f.facilityName),
      ),
    );

    const details: FacilityViolationDetail[] = results
      .filter(
        (r): r is PromiseFulfilledResult<FacilityViolationDetail | null> =>
          r.status === "fulfilled" && r.value !== null,
      )
      .map((r) => r.value!);

    return { success: true, details };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { success: false, error: `DFR fetch error: ${message}` };
  }
}
