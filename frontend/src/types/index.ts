// ══════════════════════════════════════════════════════════════
// RECON-AI Control Center — Type Definitions (per UX Spec v1.0)
// ══════════════════════════════════════════════════════════════

// ── Enums ────────────────────────────────────────────────────

export type EventStatus = 'DRAFT' | 'ACTIVE' | 'PARALLEL' | 'SIGNED_OFF' | 'COMPLETE';

export type FundType = 'EQUITY' | 'FIXED_INCOME' | 'MULTI_ASSET' | 'MONEY_MARKET';

export type FundStatus = 'PENDING' | 'IN_PARALLEL' | 'PASSED' | 'FAILED' | 'SIGNED_OFF';

export type ValidationRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETE' | 'FAILED';

export type CheckType = 'NAV_TO_LEDGER' | 'LEDGER_BS_TO_INCST' | 'LEDGER_TF_TO_CLASS' | 'POSITION_TO_LOT' | 'LEDGER_TO_SUBLEDGER' | 'BASIS_LOT_CHECK';

export type CheckLevel = 'L0' | 'L1' | 'L2' | 'L3';

export type BreakState =
  | 'DETECTED'
  | 'ANALYZING'
  | 'AI_PASSED'
  | 'HUMAN_REVIEW_PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'MODIFIED'
  | 'ESCALATED'
  | 'ACTION_PENDING'
  | 'CLOSED'
  | 'RESOLVED';

export type BreakCategory = 'TIMING' | 'METHODOLOGY' | 'DATA' | 'PRICING' | 'FX' | 'ACCRUAL' | 'CORPORATE_ACTION' | 'POSITION' | 'MAPPING' | 'UNKNOWN';

export type ReviewAction = 'ACCEPT' | 'MODIFY' | 'REJECT';

// ── 5.1 Event Entity ────────────────────────────────────────

export interface TeamMember {
  userId: string;
  name: string;
  role: 'CONVERSION_MANAGER' | 'FUND_ACCOUNTANT' | 'OPERATIONS_ANALYST' | 'AUDITOR';
  avatar?: string;
}

export interface ConversionEvent {
  eventId: string;
  eventName: string;
  incumbentProvider: string;
  status: EventStatus;
  parallelStartDate?: string;
  targetGoLiveDate: string;
  assignedTeam: TeamMember[];
  funds: Fund[];
  // UI-derived
  breakTrend7d?: number[];
}

// ── 5.2 Fund Entity ─────────────────────────────────────────

export interface Fund {
  account: string;
  fundName: string;
  fundType: FundType;
  shareClasses: string[];
  status: FundStatus;
  // UI-augmented
  lastRunTimestamp?: string;
  breakCount?: number;
  aiStatus?: 'ANALYZING' | 'COMPLETE' | 'NEEDS_REVIEW';
  aiConfidence?: number;
  humanReview?: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';
}

// ── 5.3 ValidationRun Entity ────────────────────────────────

export interface ValidationRun {
  runId: string;
  eventId: string;
  valuationDt: string;
  executionTime: string;
  checkSuite: CheckType[];
  status: ValidationRunStatus;
  durationMs?: number;
  // UI-derived summary
  fundsPassed?: number;
  fundsWarning?: number;
  fundsFailed?: number;
}

// ── 5.4 BreakRecord Entity ──────────────────────────────────

export interface BreakRecord {
  breakId: string;
  validationRunId: string;
  fundAccount: string;
  fundName: string;
  checkType: CheckType;
  level: CheckLevel;
  lhsValue: number;
  rhsValue: number;
  variance: number;
  state: BreakState;
  aiAnalysis?: AIAnalysis;
  humanAnnotation?: HumanAnnotation;
  // UI convenience
  securityId?: string;
  securityName?: string;
  glCategory?: string;
}

// ── 5.5 AIAnalysis Entity ───────────────────────────────────

export interface EvidenceStep {
  stepNumber: number;
  description: string;
}

export interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
}

export interface SimilarBreak {
  breakId: string;
  fundName: string;
  date: string;
  variance: number;
  resolution?: string;
}

export interface AIAnalysis {
  analysisId: string;
  rootCauseSummary: string;
  confidenceScore: number;
  evidenceChain: EvidenceStep[];
  breakCategory: BreakCategory;
  similarBreaks: SimilarBreak[];
  recommendedActions: ActionItem[];
}

// ── Human Review / Annotation ───────────────────────────────

export interface HumanAnnotation {
  annotationId: string;
  reviewerUserId: string;
  reviewerName: string;
  reviewerRole: string;
  action: ReviewAction;
  notes: string;
  resolutionCategory?: BreakCategory;
  timestamp: string;
}

// ── Validation Check Framework (§2.2) ───────────────────────

export interface ValidationCheckDefinition {
  checkType: CheckType;
  level: CheckLevel;
  name: string;
  description: string;
  lhsSource: string;
  rhsSource: string;
}

// ── Validation Results (per-fund, per-check) ────────────────

export interface ValidationResult {
  checkType: CheckType;
  checkName: string;
  level: CheckLevel;
  fundAccount: string;
  fundName: string;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  lhsRowCount: number;
  rhsRowCount: number;
  matchedCount: number;
  breakCount: number;
  totalVariance: number;
  maxVariance: number;
  durationMs: number;
}

// ── Waterfall Chart Data ────────────────────────────────────

export interface WaterfallItem {
  label: string;
  value: number;
  type: 'start' | 'delta' | 'end';
  hasBreak?: boolean;
}

// ── Reconciliation Tree ─────────────────────────────────────

export interface ReconTreeNode {
  id: string;
  label: string;
  level: CheckLevel;
  variance: number;
  status: 'PASS' | 'BREAK' | 'WARNING';
  children?: ReconTreeNode[];
}

// ── Transaction Detail ──────────────────────────────────────

export interface TransactionDetail {
  securityId: string;
  securityName?: string;
  cpuValue: number;
  incumbentValue: number;
  variance: number;
  tradeDate?: string;
  settleDate?: string;
}

// ── Activity Feed ───────────────────────────────────────────

export interface ActivityFeedItem {
  id: string;
  type: 'VALIDATION_RUN' | 'AI_ANALYSIS' | 'HUMAN_ANNOTATION' | 'STATUS_CHANGE';
  message: string;
  eventId: string;
  timestamp: string;
  userId?: string;
  userName?: string;
}

// ══════════════════════════════════════════════════════════════
// LEDGER TO SUBLEDGER VALIDATION TYPES (per spec ledger_subledger.md)
// ══════════════════════════════════════════════════════════════

// ── Security Type Codes (Appendix B) ─────────────────────────

export type SecurityTypeCode = 'CA' | 'CU' | 'FT' | 'MF' | 'RP' | 'S' | 'TI';

// ── Ledger Category Reference ────────────────────────────────

export interface LedgerCategory {
  categoryName: string;
  subledgerSupported: boolean;
  primaryDataSource: string | null;
  description: string | null;
  displayOrder: number;
}

// ── GL Account to Category Mapping ───────────────────────────

export interface GLCategoryMapping {
  chartOfAccounts: string;
  glAccountNumber: string;
  glAccountDescription: string;
  ledgerSection: string;
  bsIncst: 'BS' | 'INCST';
  conversionCategory: string;
}

// ── Transaction Code to Category Mapping ─────────────────────

export interface TransCodeCategoryMapping {
  transCode: string;
  conversionCategory: string;
  fieldUsed: string;
  description: string | null;
}

// ── Ledger to Subledger Summary Grid (Section 2.1) ───────────

export interface LedgerSubledgerSummaryRow {
  account: string;
  category: string;
  subledgerSupported: boolean;
  ledger: number;
  subLedger: number | null;
  variance: number;
}

export interface LedgerSubledgerSummaryResponse {
  rows: LedgerSubledgerSummaryRow[];
  totals: {
    ledger: number;
    subLedger: number;
    variance: number;
  };
}

// ── Ledger Detail Drill-Down (Section 4.2) ───────────────────

export interface LedgerDetailRow {
  account: string;
  bsIncst: 'BS' | 'INCST';
  category: string;
  glAccountNumber: string;
  glAccountDescription: string;
  endingBalance: number;
}

export interface LedgerDetailResponse {
  rows: LedgerDetailRow[];
  total: number;
}

// ── Position Totals Drill-Down (Section 5) ───────────────────

export interface PositionTotalRow {
  account: string;
  category: string;
  secType: SecurityTypeCode | string;
  issueDescription: string | null;
  assetId?: string;
  bookValue: number | null;
  unrealized: number | null;
  netIncome: number | null;
  dailyVarMargin: number | null;
  varMarginUrgl: number | null;
  total: number;
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
}

export interface PositionTotalsResponse {
  rows: PositionTotalRow[];
  grandTotal: number;
}

// ── Unsettled Totals Drill-Down (Section 7) ──────────────────

export interface UnsettledTotalRow {
  account: string;
  category: string;
  transCode: string;
  amount: number;
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
}

export interface UnsettledTotalsResponse {
  rows: UnsettledTotalRow[];
  grandTotal: number;
}

// ── Derived Subledger Rollup (Section 9) ─────────────────────

export interface DerivedSubledgerValue {
  account: string;
  category: string;
  positionValue: number;
  transactionValue: number;
  totalValue: number;
}

// ── Drill-Down Selection State ───────────────────────────────

export interface LedgerSubledgerDrillDownSelection {
  account: string;
  category: string;
  subledgerSupported: boolean;
}

// ══════════════════════════════════════════════════════════════
// PROCESS FLOW DRILL-DOWN TYPES (per Process Flow Spec v1.0)
// ══════════════════════════════════════════════════════════════

export type ValidationStatusType = 'pass' | 'marginal' | 'break';

// ── NAV Compare (NAV Dashboard Grid) ─────────────────────────

export interface NavCompareRow {
  valuationDt: string;
  account: string;
  accountName: string;
  incumbentTNA: number;
  bnyTNA: number;
  tnaDifference: number;
  tnaDifferenceBP: number;
  validationStatus: ValidationStatusType;
}

// ── Cross-Check Results (NAV Dashboard Expandable) ───────────

export interface CrossCheckRow {
  label: string;
  lhsValue: number;
  rhsValue: number;
  difference: number;
  validationStatus: ValidationStatusType;
}

export interface CrossCheckResult {
  bsCheck: CrossCheckRow;
  incstCheck: CrossCheckRow;
}

// ── Trial Balance Category Row ───────────────────────────────

export interface TrialBalanceCategoryRow {
  valuationDt: string;
  account: string;
  category: string;
  incumbentBalance: number;
  bnyBalance: number;
  balanceDiff: number;
  balanceDiffBP: number;
  validationStatus: ValidationStatusType;
}

// ── Subledger Compare Check ──────────────────────────────────

export interface SubledgerCheckResult {
  category: string;
  ledgerValue: number;
  subledgerValue: number;
  difference: number;
  validationStatus: ValidationStatusType;
}

// ── Position Compare Row ─────────────────────────────────────

export interface ComparisonField {
  fieldName: string;
  incumbent: number;
  bny: number;
  variance: number;
}

export interface PositionCompareRow {
  assetId: string;
  securityType: string;
  issueDescription: string;
  cusip: string;
  longShortInd: string;
  shareClass: string;
  comparisonFields: ComparisonField[];
  validationStatus: ValidationStatusType;
}

// ── Tax Lot Row ──────────────────────────────────────────────

export interface TaxLotRow {
  transactionId: string;
  lotTradeDate: string;
  lotSettleDate: string;
  shares: ComparisonField;
  originalFace: ComparisonField;
  origCostLocal: ComparisonField;
  origCostBase: ComparisonField;
  bookValueLocal: ComparisonField;
  bookValueBase: ComparisonField;
  marketValueLocal: ComparisonField;
  marketValueBase: ComparisonField;
  incomeLocal: ComparisonField;
  brokerCode: string;
}

// ── Basis Lot Row ────────────────────────────────────────────

export interface BasisLotRow {
  assetId: string;
  issueDescription: string;
  primaryShares: number;
  nonPrimaryShares: number;
  shareVariance: number;
  validationStatus: ValidationStatusType;
}

// ── Waterfall Chart Bar ──────────────────────────────────────

export interface WaterfallBar {
  category: string;
  value: number;
  type: 'start' | 'delta' | 'end';
  isNegative: boolean;
}

// ── SSE Event Types ──────────────────────────────────────────

export type SSEEventType = 'validation_progress' | 'validation_complete' | 'ai_analysis_complete' | 'status_change';

export interface SSEEvent {
  type: SSEEventType;
  eventId: string;
  data: {
    fundAccount?: string;
    fundIndex?: number;
    totalFunds?: number;
    checkType?: CheckType;
    status?: string;
    runId?: string;
    analysisId?: string;
    message?: string;
  };
}

// ── Drill-Down Context State ─────────────────────────────────

export interface DrillDownContextState {
  eventId: string;
  eventName: string;
  account: string | null;
  accountName: string | null;
  valuationDt: string | null;
  category: string | null;
  assetId: string | null;
}

// ── AI Analysis for Commentary Panel ─────────────────────────

export interface AICommentaryData {
  trendSummary: string;
  patternRecognition: SimilarBreak[];
  confidenceScore: number;
  recommendedNextStep: string;
  rootCauseSummary?: string;
  evidenceChain?: EvidenceStep[];
}

// ══════════════════════════════════════════════════════════════
// DUAL-SYSTEM VALIDATION TYPES (Reconciliation vs Validation tabs)
// ══════════════════════════════════════════════════════════════

export type DrillDownTab = 'reconciliation' | 'validation';

// ── System Check Result (one side of a dual-system check) ────

export interface SystemCheckResult {
  lhsValue: number;
  rhsValue: number;
  difference: number;
  validationStatus: ValidationStatusType;
}

// ── Dual-System Check (CPU + Incumbent side-by-side) ─────────

export interface DualSystemCheck {
  checkName: string;
  cpu: SystemCheckResult;
  incumbent: SystemCheckResult;
}

// ── NAV Validation Row ───────────────────────────────────────

export interface NavValidationRow {
  account: string;
  accountName: string;
  checks: DualSystemCheck[];
  overallStatus: ValidationStatusType;
}

// ── Trial Balance Validation Row ─────────────────────────────

export interface TrialBalanceValidationRow {
  account: string;
  category: string;
  checks: DualSystemCheck[];
  overallStatus: ValidationStatusType;
}

// ── Position Validation Row ──────────────────────────────────

export interface PositionValidationRow {
  assetId: string;
  issueDescription: string;
  checks: DualSystemCheck[];
  overallStatus: ValidationStatusType;
}

// ══════════════════════════════════════════════════════════════
// CLASSIFICATION MAPPING TYPES (per spec Section 10)
// ══════════════════════════════════════════════════════════════

export interface AssetClassification {
  keySource: string;
  keySecType: string;
  convAssetClass: string;
  glCategoryImpact: string;
}

export interface TransClassification {
  keySource: string;
  keyTransCode: string;
  convTransClass: string;
  recPayCategory: string;
}

export interface LedgerCategoryDerivation {
  derivationType: 'transaction' | 'asset';
  convTransClass?: string;
  amntConvCategory?: string;
  urglBsConvCategory?: string;
  intRecPayConvCat?: string;
  intUrglIncstConvCat?: string;
  convAssetClass?: string;
  costConvCat?: string;
  urglBsConvCat?: string;
  dailyMarginCat?: string;
  intRecPayCat?: string;
  intUrglIncstCat?: string;
}

// ── GL Account Mapping Types ─────────────────────────────────
export * from './glMapping';
