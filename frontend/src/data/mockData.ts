import {
  Break,
  MatchRateMetric,
  BreakAgingSummary,
  BreakPatternDelta,
  ConfigDriftAlert,
  HypothesisTest,
  CandidateCause,
  EvidenceLogEntry,
  SideBySideRow,
  LineageNode,
  LineageEdge,
} from '../types';

// ── Control Center ───────────────────────────────────────────
export const matchRateMetrics: MatchRateMetric[] = [
  { label: 'Overall Match Rate', rate: 94.2, previousRate: 93.8, trend: 'up' },
  { label: 'NAV Component Match', rate: 97.1, previousRate: 97.3, trend: 'down' },
  { label: 'Position Match', rate: 91.5, previousRate: 90.2, trend: 'up' },
  { label: 'Cash & Accrual Match', rate: 88.7, previousRate: 88.7, trend: 'flat' },
];

export const breakAgingSummary: BreakAgingSummary[] = [
  { bucket: '0-1 days', count: 42, totalVariance: 125340.5 },
  { bucket: '2-3 days', count: 18, totalVariance: 87210.25 },
  { bucket: '4-7 days', count: 7, totalVariance: 234100.0 },
  { bucket: '8-14 days', count: 3, totalVariance: 45600.0 },
  { bucket: '15+ days', count: 2, totalVariance: 12300.75 },
];

export const breakPatternDeltas: BreakPatternDelta[] = [
  { pattern: 'FX Rate Stale', todayCount: 5, yesterdayCount: 2, delta: 3 },
  { pattern: 'Missing Corp Action', todayCount: 3, yesterdayCount: 3, delta: 0 },
  { pattern: 'Accrual Timing', todayCount: 8, yesterdayCount: 12, delta: -4 },
  { pattern: 'Price Source Mismatch', todayCount: 4, yesterdayCount: 1, delta: 3 },
  { pattern: 'Position Lot Mismatch', todayCount: 2, yesterdayCount: 2, delta: 0 },
];

export const configDriftAlerts: ConfigDriftAlert[] = [
  {
    id: 'cd-1',
    message: 'Pricing source mapping v2.3 → v2.4 mismatch detected for Fund ABC Global Equity',
    severity: 'warning',
    source: 'Config Sync Agent',
    detectedAt: '2026-02-06T08:15:00Z',
  },
  {
    id: 'cd-2',
    message: 'FX rate cutoff time changed from 16:00 to 16:30 GMT in incumbent system — not reflected locally',
    severity: 'error',
    source: 'FX Config Monitor',
    detectedAt: '2026-02-06T07:45:00Z',
  },
];

// ── Break Explorer ───────────────────────────────────────────
export const breaks: Break[] = [
  {
    id: 'BRK-001',
    fund: 'ABC Global Equity',
    date: '2026-02-05',
    component: 'Unrealized P&L',
    accountGroup: 'Equities — US Large Cap',
    varianceBase: -45230.12,
    varianceLocal: -45230.12,
    currency: 'USD',
    breakType: 'pricing',
    confidence: 0.92,
    topCandidateCause: 'Stale closing price for AAPL (T vs T-1)',
    severity: 'critical',
    status: 'open',
    ageDays: 1,
  },
  {
    id: 'BRK-002',
    fund: 'XYZ Fixed Income',
    date: '2026-02-05',
    component: 'Accrued Interest',
    accountGroup: 'Fixed Income — IG Corp',
    varianceBase: 12450.0,
    varianceLocal: 12450.0,
    currency: 'USD',
    breakType: 'accrual',
    confidence: 0.85,
    topCandidateCause: 'Day count convention mismatch (ACT/360 vs 30/360)',
    severity: 'high',
    status: 'investigating',
    ageDays: 2,
  },
  {
    id: 'BRK-003',
    fund: 'DEF Multi-Asset',
    date: '2026-02-05',
    component: 'FX Gain/Loss',
    accountGroup: 'FX Forwards',
    varianceBase: -8920.55,
    varianceLocal: -7450.3,
    currency: 'EUR',
    breakType: 'fx',
    confidence: 0.78,
    topCandidateCause: 'FX rate cutoff time difference (4pm vs 4:30pm GMT)',
    severity: 'medium',
    status: 'open',
    ageDays: 1,
  },
  {
    id: 'BRK-004',
    fund: 'ABC Global Equity',
    date: '2026-02-04',
    component: 'Realized P&L',
    accountGroup: 'Equities — EU',
    varianceBase: 3200.0,
    varianceLocal: 2950.4,
    currency: 'EUR',
    breakType: 'corporate_action',
    confidence: 0.88,
    topCandidateCause: 'Stock split 4:1 for SAP SE not applied in incumbent',
    severity: 'high',
    status: 'open',
    ageDays: 2,
  },
  {
    id: 'BRK-005',
    fund: 'GHI Emerging Markets',
    date: '2026-02-05',
    component: 'Market Value',
    accountGroup: 'Equities — EM',
    varianceBase: -1250.0,
    varianceLocal: -18750.0,
    currency: 'BRL',
    breakType: 'position',
    confidence: 0.65,
    topCandidateCause: 'Lot-level position mismatch after partial redemption',
    severity: 'medium',
    status: 'investigating',
    ageDays: 3,
  },
  {
    id: 'BRK-006',
    fund: 'JKL Balanced Fund',
    date: '2026-02-05',
    component: 'Management Fee',
    accountGroup: 'Expenses',
    varianceBase: 520.0,
    varianceLocal: 520.0,
    currency: 'USD',
    breakType: 'timing',
    confidence: 0.95,
    topCandidateCause: 'Fee accrual posted T+1 in incumbent vs T in our system',
    severity: 'low',
    status: 'open',
    ageDays: 1,
  },
  {
    id: 'BRK-007',
    fund: 'MNO Credit Fund',
    date: '2026-02-03',
    component: 'Amortization',
    accountGroup: 'Fixed Income — HY',
    varianceBase: 7800.25,
    varianceLocal: 7800.25,
    currency: 'USD',
    breakType: 'mapping',
    confidence: 0.72,
    topCandidateCause: 'Security ID mapping mismatch (CUSIP vs ISIN)',
    severity: 'medium',
    status: 'open',
    ageDays: 3,
  },
  {
    id: 'BRK-008',
    fund: 'PQR Global Macro',
    date: '2026-02-05',
    component: 'Swap P&L',
    accountGroup: 'Derivatives — IRS',
    varianceBase: -156780.0,
    varianceLocal: -156780.0,
    currency: 'USD',
    breakType: 'pricing',
    confidence: 0.91,
    topCandidateCause: 'Curve construction methodology difference (OIS vs LIBOR)',
    severity: 'critical',
    status: 'open',
    ageDays: 1,
  },
];

// ── Investigation Workspace (for BRK-001) ───────────────────
export const lineageNodes: LineageNode[] = [
  { id: 'n1', label: 'NAV: Unrealized P&L', type: 'nav_component', value: -45230.12 },
  { id: 'n2', label: 'Posting: AAPL MV Δ', type: 'posting', value: -45230.12 },
  { id: 'n3', label: 'JE Line: GL 4010', type: 'je_line', value: -45230.12 },
  { id: 'n4', label: 'Subledger: Position Valuation', type: 'subledger_doc' },
  { id: 'n5', label: 'Event: EOD Price Feed', type: 'event' },
  { id: 'n6', label: 'Event: Position Snapshot', type: 'event' },
];

export const lineageEdges: LineageEdge[] = [
  { source: 'n1', target: 'n2', label: 'comprises' },
  { source: 'n2', target: 'n3', label: 'posted as' },
  { source: 'n3', target: 'n4', label: 'sourced from' },
  { source: 'n4', target: 'n5', label: 'triggered by' },
  { source: 'n4', target: 'n6', label: 'triggered by' },
];

export const sideBySideData: SideBySideRow[] = [
  { field: 'Security', ourValue: 'AAPL (US0378331005)', incumbentValue: 'AAPL (US0378331005)', match: true },
  { field: 'Position (shares)', ourValue: '15,000', incumbentValue: '15,000', match: true },
  { field: 'Price Date', ourValue: '2026-02-05', incumbentValue: '2026-02-04', match: false },
  { field: 'Closing Price', ourValue: '$242.15', incumbentValue: '$239.13', match: false },
  { field: 'Market Value', ourValue: '$3,632,250.00', incumbentValue: '$3,586,950.00', match: false },
  { field: 'Unrealized P&L', ourValue: '$132,250.00', incumbentValue: '$87,019.88', match: false },
  { field: 'Cost Basis', ourValue: '$3,500,000.00', incumbentValue: '$3,500,000.00', match: true },
  { field: 'Currency', ourValue: 'USD', incumbentValue: 'USD', match: true },
  { field: 'Price Source', ourValue: 'Bloomberg EOD', incumbentValue: 'Reuters EOD', match: false },
];

export const candidateCauses: CandidateCause[] = [
  {
    rank: 1,
    description: 'Stale closing price — AAPL price date T-1 in incumbent vs T in our system',
    confidence: 0.92,
    breakType: 'pricing',
    evidenceCount: 4,
  },
  {
    rank: 2,
    description: 'Price source discrepancy — Bloomberg vs Reuters EOD for AAPL',
    confidence: 0.45,
    breakType: 'pricing',
    evidenceCount: 2,
  },
  {
    rank: 3,
    description: 'Corporate action pending — possible unprocessed dividend reinvestment',
    confidence: 0.12,
    breakType: 'corporate_action',
    evidenceCount: 1,
  },
];

export const hypothesisTests: HypothesisTest[] = [
  { id: 'ht-1', name: 'Timing Difference Check', category: 'timing', result: 'fail', detail: 'Price dates differ: T vs T-1', confidence: 0.95 },
  { id: 'ht-2', name: 'FX Rate Impact', category: 'fx', result: 'pass', detail: 'Both use USD — no FX impact', confidence: 1.0 },
  { id: 'ht-3', name: 'Mapping Consistency', category: 'mapping', result: 'pass', detail: 'ISIN matches on both sides', confidence: 0.98 },
  { id: 'ht-4', name: 'Price Source Comparison', category: 'pricing', result: 'fail', detail: 'Bloomberg $242.15 vs Reuters $239.13 — $3.02 diff', confidence: 0.91 },
  { id: 'ht-5', name: 'Corporate Action Check', category: 'corporate_action', result: 'pass', detail: 'No pending CA for AAPL on 2026-02-05', confidence: 0.99 },
  { id: 'ht-6', name: 'Accrual Methodology', category: 'accrual', result: 'inconclusive', detail: 'N/A for equity position', confidence: 0.0 },
];

export const evidenceLog: EvidenceLogEntry[] = [
  {
    id: 'ev-1',
    timestamp: '2026-02-06T08:30:12Z',
    queryType: 'Graph Traversal',
    description: 'NAV component → posting lineage for Unrealized P&L',
    output: 'Found 1 posting (AAPL MV Δ) → 1 JE line (GL 4010) → 1 subledger doc',
    configVersion: 'v2.3.1',
  },
  {
    id: 'ev-2',
    timestamp: '2026-02-06T08:30:15Z',
    queryType: 'Price Lookup',
    description: 'Cross-reference AAPL closing price across sources',
    output: 'Bloomberg: $242.15 (2026-02-05), Reuters: $239.13 (2026-02-04)',
    configVersion: 'v2.3.1',
  },
  {
    id: 'ev-3',
    timestamp: '2026-02-06T08:30:18Z',
    queryType: 'Pattern Match',
    description: 'Search for similar stale-price breaks in last 30 days',
    output: 'Found 3 similar breaks: BRK-045 (MSFT), BRK-067 (GOOGL), BRK-089 (AMZN) — all resolved as timing',
    configVersion: 'v2.3.1',
  },
  {
    id: 'ev-4',
    timestamp: '2026-02-06T08:30:22Z',
    queryType: 'Hypothesis Test',
    description: 'Run timing difference hypothesis for price date mismatch',
    output: 'CONFIRMED: Incumbent using T-1 price ($239.13) vs our T price ($242.15). Variance = $45,230.12',
  },
  {
    id: 'ev-5',
    timestamp: '2026-02-06T08:30:25Z',
    queryType: 'Config Check',
    description: 'Verify pricing source configuration alignment',
    output: 'Config mismatch: Our system → Bloomberg EOD (cutoff 16:00 EST), Incumbent → Reuters EOD (cutoff 16:30 GMT)',
    configVersion: 'v2.3.1 / v2.4.0',
  },
];

// ── Summary stats for Control Center ─────────────────────────
export const dashboardStats = {
  totalBreaks: breaks.length,
  criticalBreaks: breaks.filter((b) => b.severity === 'critical').length,
  openBreaks: breaks.filter((b) => b.status === 'open').length,
  totalVariance: breaks.reduce((sum, b) => sum + Math.abs(b.varianceBase), 0),
  avgConfidence: breaks.reduce((sum, b) => sum + b.confidence, 0) / breaks.length,
  resolvedToday: 12,
  newToday: 5,
};
