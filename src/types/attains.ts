export type ImpairedWater = {
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
