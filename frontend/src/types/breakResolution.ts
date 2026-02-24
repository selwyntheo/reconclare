// ══════════════════════════════════════════════════════════════
// BREAK RESOLUTION & DASHBOARDING TYPES (per Break Resolution Spec v2.0)
// ══════════════════════════════════════════════════════════════

// ── Break Resolution Enums ─────────────────────────────────

export type ResolutionBreakCategory =
  | 'KNOWN_DIFFERENCE'
  | 'BNY_TO_RESOLVE'
  | 'INCUMBENT_TO_RESOLVE'
  | 'UNDER_INVESTIGATION'
  | 'MATCH';

export type ReviewStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';

export type KnownDifferenceType = 'METHODOLOGY' | 'TIMING' | 'SCOPE' | 'PERMANENT' | 'TEMPORARY';

export type BreakTeam =
  | 'NAV_OVERSIGHT'
  | 'PRICING'
  | 'TRADE_CAPTURE'
  | 'CORPORATE_ACTIONS'
  | 'INCOME'
  | 'DERIVATIVES';

export type ReconciliationLevel = 'L1_GL' | 'L2_POSITION' | 'L3_TAX_LOT' | 'L4_TRANSACTION';

export type BreakType = 'SHARE' | 'PRICE' | 'INCOME' | 'RECLAIM' | 'DERIVATIVE' | 'OTHER';

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'BOTH';

// ── RAG Status ─────────────────────────────────────────────

export type RAGStatus = 'GREEN' | 'AMBER' | 'RED';

export interface RAGThresholds {
  greenMaxBP: number;
  amberMaxBP: number;
}

// ── Reviewer Allocation ────────────────────────────────────

export interface ReviewerAllocation {
  eventId: string;
  valuationDate: string;
  fundAccount: string;
  fundName: string;
  assignedReviewer: string;
  reviewerTeam: string;
  reviewStatus: ReviewStatus;
  lastModifiedBy: string;
  lastModifiedAt: string;
}

// ── Known Difference ───────────────────────────────────────

export interface KnownDifference {
  reference: string;
  eventId: string;
  description: string;
  type: KnownDifferenceType;
  amount: number;
  currency: string;
  affectedFunds: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Break Assignment ───────────────────────────────────────

export interface BreakAssignment {
  eventId: string;
  valuationDate: string;
  entityReference: string;
  reconciliationLevel: ReconciliationLevel;
  breakType: BreakType;
  breakCategory: ResolutionBreakCategory;
  assignedTeam: BreakTeam;
  assignedOwner: string;
  reviewStatus: ReviewStatus;
  autoAssigned: boolean;
  assignedAt: string;
  resolvedAt?: string;
}

// ── Notification ───────────────────────────────────────────

export interface Notification {
  id: string;
  eventId: string;
  assignedOwner: string;
  breakType: BreakType;
  entityReference: string;
  fundAccount: string;
  fundName: string;
  message: string;
  channel: NotificationChannel;
  isRead: boolean;
  createdAt: string;
}

// ── Commentary ─────────────────────────────────────────────

export interface CommentaryEntry {
  commentId: string;
  eventId: string;
  fundAccount: string;
  reconciliationLevel: ReconciliationLevel;
  entityReference: string;
  breakCategory: ResolutionBreakCategory;
  amount: number;
  currency: string;
  text: string;
  kdReference?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentaryRollup {
  breakCategory: ResolutionBreakCategory;
  totalAmount: number;
  currency: string;
  count: number;
  entries: CommentaryEntry[];
}

// ── Audit Log ──────────────────────────────────────────────

export type AuditAction =
  | 'ALLOCATION_CHANGE'
  | 'CATEGORY_CHANGE'
  | 'TEAM_REASSIGN'
  | 'STATUS_CHANGE'
  | 'KD_OVERRIDE'
  | 'KD_CREATE'
  | 'KD_UPDATE'
  | 'KD_DELETE'
  | 'COMMENTARY_ADD'
  | 'COMMENTARY_EDIT'
  | 'COMMENTARY_DELETE'
  | 'SIGN_OFF'
  | 'EXPORT';

export interface AuditLog {
  eventId: string;
  action: AuditAction;
  entityReference: string;
  previousValue: unknown;
  newValue: unknown;
  changedBy: string;
  timestamp: string;
}

// ── NAV Share Class ────────────────────────────────────────

export interface ShareClassRow {
  shareClass: string;
  shareClassName: string;
  bnyNetAssetsBase: number;
  incumbentNetAssetsBase: number;
  netAssetsDiffBase: number;
  bnyNetAssetsLocal: number;
  incumbentNetAssetsLocal: number;
  netAssetsDiffLocal: number;
  bnyUnits: number;
  incumbentUnits: number;
  unitsDiff: number;
  bnyNAVPerShareBase: number;
  incumbentNAVPerShareBase: number;
  navPerShareDiffBase: number;
  bnyNAVPerShareLocal: number;
  incumbentNAVPerShareLocal: number;
  navPerShareDiffLocal: number;
  shareMovement: number;
  priorDayUnits: number;
}

// ── NAV Client Scorecard ───────────────────────────────────

export interface ScorecardRow {
  account: string;
  accountName: string;
  bnyNetAssets: number;
  incumbentNetAssets: number;
  netAssetsDifference: number;
  netAssetsDifferenceBP: number;
  kdAmounts: Record<string, number>;
  adjustedDifference: number;
  adjustedBP: number;
  ragStatus: RAGStatus;
  incumbentToResolve: number;
  reviewStatus: ReviewStatus;
  reviewer: string;
  comment: string;
  signedOff: boolean;
}

// ── NAV RAG Tracker ────────────────────────────────────────

export interface RAGTrackerCell {
  adjustedBP: number;
  ragStatus: RAGStatus;
}

export interface RAGTrackerRow {
  account: string;
  accountName: string;
  dates: Record<string, RAGTrackerCell>;
}

// ── Break Summary ──────────────────────────────────────────

export interface BreakSummary {
  category: ResolutionBreakCategory;
  count: number;
  totalAmount: number;
}

// ── Shared Sub-View Rows ───────────────────────────────────

export type MatchStatus = 'MATCH' | 'BNY_ONLY' | 'INCUMBENT_ONLY' | 'MATCHED_WITH_DIFFERENCES';

export interface PositionBreakRow {
  assetId: string;
  securityType: string;
  issueDescription: string;
  cusip: string;
  bnyShares: number;
  incumbentShares: number;
  sharesDiff: number;
  bnyPrice: number;
  incumbentPrice: number;
  priceDiff: number;
  priceDiffPct: number;
  bnyMarketValue: number;
  incumbentMarketValue: number;
  marketValueDiff: number;
  matchStatus: MatchStatus;
  breakCategory: ResolutionBreakCategory;
  breakTeam: BreakTeam;
  breakOwner: string;
  comment: string;
}

// ── Income Rows ────────────────────────────────────────────

export interface DividendRow {
  assetId: string;
  issueDescription: string;
  securityType: string;
  bnyGrossIncome: number;
  incumbentGrossIncome: number;
  grossDiff: number;
  bnyWithholding: number;
  incumbentWithholding: number;
  withholdingDiff: number;
  bnyNetIncome: number;
  incumbentNetIncome: number;
  netDiff: number;
  bnyReclaim: number;
  incumbentReclaim: number;
  reclaimDiff: number;
  breakCategory: ResolutionBreakCategory;
  breakTeam: BreakTeam;
  breakOwner: string;
  comment: string;
}

export interface FixedIncomeRow {
  assetId: string;
  issueDescription: string;
  priorCouponDate: string;
  nextCouponDate: string;
  paymentFrequency: string;
  bnyCouponRate: number;
  incumbentCouponRate: number;
  couponRateDiff: number;
  bnyAccruedIncome: number;
  incumbentAccruedIncome: number;
  accruedDiff: number;
  breakCategory: ResolutionBreakCategory;
  breakTeam: BreakTeam;
  breakOwner: string;
  comment: string;
}

// ── Derivatives Rows ───────────────────────────────────────

export interface ForwardRow {
  assetId: string;
  issueDescription: string;
  buyCurrency: string;
  sellCurrency: string;
  tradeDate: string;
  settlementDate: string;
  bnyNotional: number;
  incumbentNotional: number;
  notionalDiff: number;
  bnyUnrealisedGL: number;
  incumbentUnrealisedGL: number;
  unrealisedGLDiff: number;
  breakCategory: ResolutionBreakCategory;
  breakTeam: BreakTeam;
  breakOwner: string;
  comment: string;
}

export interface FutureRow {
  assetId: string;
  issueDescription: string;
  contractSize: number;
  maturityDate: string;
  bnyContracts: number;
  incumbentContracts: number;
  contractsDiff: number;
  bnyPrice: number;
  incumbentPrice: number;
  priceDiff: number;
  priceDiffPct: number;
  bnyMarketValue: number;
  incumbentMarketValue: number;
  marketValueDiff: number;
  breakCategory: ResolutionBreakCategory;
  breakTeam: BreakTeam;
  breakOwner: string;
  comment: string;
}
