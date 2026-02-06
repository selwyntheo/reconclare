// ── Break Types ──────────────────────────────────────────────
export type BreakSeverity = 'critical' | 'high' | 'medium' | 'low';
export type BreakStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export type BreakType =
  | 'pricing'
  | 'corporate_action'
  | 'accrual'
  | 'fx'
  | 'position'
  | 'timing'
  | 'mapping'
  | 'unknown';

export interface Break {
  id: string;
  fund: string;
  date: string;
  component: string;
  accountGroup: string;
  varianceBase: number;
  varianceLocal: number;
  currency: string;
  breakType: BreakType;
  confidence: number;
  topCandidateCause: string;
  severity: BreakSeverity;
  status: BreakStatus;
  ageDays: number;
}

// ── Dashboard / Control Center ───────────────────────────────
export interface MatchRateMetric {
  label: string;
  rate: number;
  previousRate: number;
  trend: 'up' | 'down' | 'flat';
}

export interface BreakAgingSummary {
  bucket: string;       // e.g. "0-1 days", "2-5 days", "5+ days"
  count: number;
  totalVariance: number;
}

export interface BreakPatternDelta {
  pattern: string;
  todayCount: number;
  yesterdayCount: number;
  delta: number;
}

export interface ConfigDriftAlert {
  id: string;
  message: string;
  severity: 'warning' | 'error';
  source: string;
  detectedAt: string;
}

// ── Investigation Workspace ──────────────────────────────────
export interface LineageNode {
  id: string;
  label: string;
  type: 'nav_component' | 'posting' | 'je_line' | 'subledger_doc' | 'event';
  value?: number;
}

export interface LineageEdge {
  source: string;
  target: string;
  label?: string;
}

export interface HypothesisTest {
  id: string;
  name: string;
  category: 'timing' | 'mapping' | 'fx' | 'pricing' | 'corporate_action' | 'accrual';
  result: 'pass' | 'fail' | 'inconclusive' | 'pending';
  detail: string;
  confidence: number;
}

export interface CandidateCause {
  rank: number;
  description: string;
  confidence: number;
  breakType: BreakType;
  evidenceCount: number;
}

export interface EvidenceLogEntry {
  id: string;
  timestamp: string;
  queryType: string;
  description: string;
  output: string;
  configVersion?: string;
}

export interface SideBySideRow {
  field: string;
  ourValue: string;
  incumbentValue: string;
  match: boolean;
}

// ── One-Click Outcomes ───────────────────────────────────────
export type OutcomeAction =
  | 'mark_config_issue'
  | 'mark_timing_difference'
  | 'create_correction_je';

// ── Validation Matrix (InvestOne → Eagle) ────────────────────
export type ValidationRuleType =
  | 'NAV_TO_LEDGER'
  | 'LEDGER_BS_TO_INCST'
  | 'LEDGER_TF_TO_CLASS'
  | 'POSITION_TO_LOT'
  | 'LEDGER_TO_SUBLEDGER'
  | 'BASIS_LOT_CHECK';

export type ValidationStatus = 'passed' | 'failed' | 'warning' | 'running' | 'pending' | 'skipped';

export interface ValidationSide {
  source: string;
  keys: string[];
  displayFields: string[];
  compareFields: string[];
  filter?: string;
}

export interface ValidationRule {
  id: string;
  name: string;
  ruleType: ValidationRuleType;
  section: string;
  lhs: ValidationSide;
  rhs: ValidationSide;
  toleranceAbsolute?: number;
}

export interface ValidationResult {
  ruleId: string;
  ruleName: string;
  ruleType: ValidationRuleType;
  section: string;
  account: string;
  valuationDate: string;
  status: ValidationStatus;
  lhsRowCount: number;
  rhsRowCount: number;
  matchedCount: number;
  breakCount: number;
  totalVariance: number;
  maxVariance: number;
  executedAt: string;
  durationMs: number;
}

export type DerivedRollupCategory =
  | 'CAPITAL_SUBSCRIPTIONS'
  | 'DISTRIBUTION'
  | 'FORWARDS'
  | 'REPO'
  | 'SECURITIES'
  | 'LEDGER_LOAD'
  | 'FUTURES_INCOME_UNREALIZED';

export interface DerivedRollupRule {
  id: string;
  name: string;
  category: DerivedRollupCategory;
  sourceTable: string;
  ledgerAccount: string;
  dataExpression: string;
  filter?: string;
}

export interface ValidationSummary {
  totalRules: number;
  passed: number;
  failed: number;
  warnings: number;
  pending: number;
  overallMatchRate: number;
  totalVariance: number;
}
