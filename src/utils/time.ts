import type { TimeRange, ResolvedTimeRange } from "../types/query.js";

const PERIOD_DAYS: Record<string, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

export function resolveTimeRange(input?: TimeRange): ResolvedTimeRange {
  if (!input) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    return { startDate, endDate, daysBack: 7 };
  }

  const endDate = input.end_date ? new Date(input.end_date) : new Date();

  if (input.start_date) {
    const startDate = new Date(input.start_date);
    const daysBack = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return { startDate, endDate, daysBack };
  }

  if (input.period) {
    const days = PERIOD_DAYS[input.period] ?? 7;
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - days);
    return { startDate, endDate, daysBack: days };
  }

  const daysBack = input.days_back ?? 7;
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - daysBack);
  return { startDate, endDate, daysBack };
}
