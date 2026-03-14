/** Flexible temporal scoping for agent tool calls */
export type TimeRange = {
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
export type ResolvedTimeRange = {
  startDate: Date;
  endDate: Date;
  daysBack: number;
};
