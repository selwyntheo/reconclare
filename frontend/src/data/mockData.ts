import {
  ConversionEvent,
  Fund,
  ValidationRun,
  BreakRecord,
  AIAnalysis,
  ValidationResult,
  ValidationCheckDefinition,
  WaterfallItem,
  ReconTreeNode,
  TransactionDetail,
  ActivityFeedItem,
} from '../types';

// ══════════════════════════════════════════════════════════════
// Mock Data — RECON-AI Control Center (per UX Spec v1.0)
// ══════════════════════════════════════════════════════════════

// ── Validation Check Definitions (§2.2) ─────────────────────

export const validationChecks: ValidationCheckDefinition[] = [
  { checkType: 'NAV_TO_LEDGER', level: 'L0', name: 'NAV to Ledger', description: 'NAV ties to GL balance sheet', lhsSource: 'dataNav', rhsSource: 'dataLedger' },
  { checkType: 'LEDGER_BS_TO_INCST', level: 'L1', name: 'Ledger BS to INCST', description: 'Balance sheet ties to income statement', lhsSource: 'dataLedger', rhsSource: 'dataLedger' },
  { checkType: 'LEDGER_TF_TO_CLASS', level: 'L1', name: 'Ledger TF to Class', description: 'Total fund ties to share class rollup', lhsSource: 'dataLedger', rhsSource: 'dataLedger' },
  { checkType: 'POSITION_TO_LOT', level: 'L2', name: 'Position to Lot', description: 'Position totals match lot-level sum', lhsSource: 'dataSubLedgerTrans', rhsSource: 'dataSubLedgerPosition' },
  { checkType: 'LEDGER_TO_SUBLEDGER', level: 'L2', name: 'Ledger to Subledger', description: 'GL balances match derived subledger', lhsSource: 'dataLedger', rhsSource: 'derivedSubLedgerRollup' },
  { checkType: 'BASIS_LOT_CHECK', level: 'L2', name: 'Basis Lot Check', description: 'Primary basis matches tax basis shares', lhsSource: 'dataSubLedgerTrans', rhsSource: 'dataSubLedgerTrans' },
];

// ── Events ──────────────────────────────────────────────────

const vanguardFunds: Fund[] = [
  { account: 'VG-BOND-IDX', fundName: 'VG Bond Index', fundType: 'FIXED_INCOME', shareClasses: ['Admiral', 'Investor'], status: 'PASSED', lastRunTimestamp: '2026-02-07T08:30:00Z', breakCount: 0, aiStatus: 'COMPLETE', aiConfidence: 1.0, humanReview: 'APPROVED' },
  { account: 'VG-CORP-BOND', fundName: 'VG Corp Bond', fundType: 'FIXED_INCOME', shareClasses: ['Admiral', 'ETF'], status: 'FAILED', lastRunTimestamp: '2026-02-07T08:32:00Z', breakCount: 2, aiStatus: 'COMPLETE', aiConfidence: 0.89, humanReview: 'PENDING' },
  { account: 'VG-HIGH-YIELD', fundName: 'VG High Yield', fundType: 'FIXED_INCOME', shareClasses: ['Admiral', 'Investor', 'ETF'], status: 'FAILED', lastRunTimestamp: '2026-02-07T08:35:00Z', breakCount: 5, aiStatus: 'ANALYZING', humanReview: 'PENDING' },
  { account: 'VG-TREASURY', fundName: 'VG Treasury', fundType: 'FIXED_INCOME', shareClasses: ['Admiral', 'Investor'], status: 'PASSED', lastRunTimestamp: '2026-02-07T08:31:00Z', breakCount: 0, aiStatus: 'COMPLETE', aiConfidence: 1.0, humanReview: 'APPROVED' },
  { account: 'VG-TIPS', fundName: 'VG Inflation-Protected', fundType: 'FIXED_INCOME', shareClasses: ['Admiral'], status: 'PASSED', lastRunTimestamp: '2026-02-07T08:33:00Z', breakCount: 0, aiStatus: 'COMPLETE', aiConfidence: 1.0, humanReview: 'APPROVED' },
  { account: 'VG-INTL-BOND', fundName: 'VG International Bond', fundType: 'FIXED_INCOME', shareClasses: ['Admiral', 'Investor'], status: 'IN_PARALLEL', lastRunTimestamp: '2026-02-07T08:34:00Z', breakCount: 1, aiStatus: 'COMPLETE', aiConfidence: 0.92, humanReview: 'PENDING' },
];

const fidelityFunds: Fund[] = [
  { account: 'FID-GROWTH', fundName: 'Fidelity Growth', fundType: 'EQUITY', shareClasses: ['K', 'Retail'], status: 'PASSED', lastRunTimestamp: '2026-02-07T07:45:00Z', breakCount: 0, aiStatus: 'COMPLETE', aiConfidence: 1.0, humanReview: 'APPROVED' },
  { account: 'FID-VALUE', fundName: 'Fidelity Value', fundType: 'EQUITY', shareClasses: ['K', 'Retail'], status: 'PASSED', lastRunTimestamp: '2026-02-07T07:46:00Z', breakCount: 0, aiStatus: 'COMPLETE', aiConfidence: 1.0, humanReview: 'APPROVED' },
  { account: 'FID-BALANCED', fundName: 'Fidelity Balanced', fundType: 'MULTI_ASSET', shareClasses: ['K'], status: 'PASSED', lastRunTimestamp: '2026-02-07T07:47:00Z', breakCount: 0, aiStatus: 'COMPLETE', aiConfidence: 1.0, humanReview: 'APPROVED' },
];

const tRoweFunds: Fund[] = [
  { account: 'TRP-BLUE-CHIP', fundName: 'T. Rowe Blue Chip Growth', fundType: 'EQUITY', shareClasses: ['I', 'Advisor'], status: 'IN_PARALLEL', lastRunTimestamp: '2026-02-07T08:10:00Z', breakCount: 3, aiStatus: 'ANALYZING', humanReview: 'PENDING' },
  { account: 'TRP-INTL-STOCK', fundName: 'T. Rowe Intl Stock', fundType: 'EQUITY', shareClasses: ['I'], status: 'PENDING', breakCount: 0 },
  { account: 'TRP-NEW-INCOME', fundName: 'T. Rowe New Income', fundType: 'FIXED_INCOME', shareClasses: ['I', 'Advisor'], status: 'PENDING', breakCount: 0 },
  { account: 'TRP-SCIENCE', fundName: 'T. Rowe Science & Tech', fundType: 'EQUITY', shareClasses: ['I'], status: 'IN_PARALLEL', lastRunTimestamp: '2026-02-07T08:12:00Z', breakCount: 1, aiStatus: 'COMPLETE', aiConfidence: 0.95, humanReview: 'PENDING' },
  { account: 'TRP-MONEY-MKT', fundName: 'T. Rowe Money Market', fundType: 'MONEY_MARKET', shareClasses: ['I'], status: 'PENDING', breakCount: 0 },
];

const americanFunds: Fund[] = [
  { account: 'AF-GROWTH-AM', fundName: 'Growth Fund of America', fundType: 'EQUITY', shareClasses: ['R6', 'A', 'C'], status: 'PENDING', breakCount: 0 },
  { account: 'AF-INCOME', fundName: 'American Income Fund', fundType: 'FIXED_INCOME', shareClasses: ['R6', 'A'], status: 'PENDING', breakCount: 0 },
];

export const events: ConversionEvent[] = [
  {
    eventId: 'EVT-2026-001',
    eventName: 'Vanguard Fixed Income Migration',
    incumbentProvider: 'State Street',
    status: 'PARALLEL',
    parallelStartDate: '2026-01-15',
    targetGoLiveDate: '2026-04-01',
    assignedTeam: [
      { userId: 'u1', name: 'Jane Doe', role: 'CONVERSION_MANAGER' },
      { userId: 'u2', name: 'Mike Chen', role: 'FUND_ACCOUNTANT' },
      { userId: 'u3', name: 'Sarah Kim', role: 'OPERATIONS_ANALYST' },
    ],
    funds: vanguardFunds,
    breakTrend7d: [8, 6, 5, 7, 4, 3, 3],
  },
  {
    eventId: 'EVT-2026-002',
    eventName: 'Fidelity Equity Suite',
    incumbentProvider: 'Northern Trust',
    status: 'SIGNED_OFF',
    parallelStartDate: '2025-11-01',
    targetGoLiveDate: '2026-02-15',
    assignedTeam: [
      { userId: 'u1', name: 'Jane Doe', role: 'CONVERSION_MANAGER' },
      { userId: 'u4', name: 'Tom Rivera', role: 'FUND_ACCOUNTANT' },
    ],
    funds: fidelityFunds,
    breakTrend7d: [1, 0, 0, 0, 0, 0, 0],
  },
  {
    eventId: 'EVT-2026-003',
    eventName: 'T. Rowe Price Multi-Strategy',
    incumbentProvider: 'BNP Paribas',
    status: 'ACTIVE',
    parallelStartDate: '2026-02-01',
    targetGoLiveDate: '2026-06-15',
    assignedTeam: [
      { userId: 'u5', name: 'Lisa Park', role: 'CONVERSION_MANAGER' },
      { userId: 'u6', name: 'David Wu', role: 'FUND_ACCOUNTANT' },
      { userId: 'u3', name: 'Sarah Kim', role: 'OPERATIONS_ANALYST' },
    ],
    funds: tRoweFunds,
    breakTrend7d: [0, 0, 2, 4, 5, 4, 4],
  },
  {
    eventId: 'EVT-2026-004',
    eventName: 'American Funds Conversion',
    incumbentProvider: 'JP Morgan',
    status: 'DRAFT',
    targetGoLiveDate: '2026-09-01',
    assignedTeam: [
      { userId: 'u5', name: 'Lisa Park', role: 'CONVERSION_MANAGER' },
    ],
    funds: americanFunds,
    breakTrend7d: [0, 0, 0, 0, 0, 0, 0],
  },
];

// ── Validation Runs ─────────────────────────────────────────

export const validationRuns: ValidationRun[] = [
  {
    runId: 'RUN-20260207-001',
    eventId: 'EVT-2026-001',
    valuationDt: '2026-02-07',
    executionTime: '2026-02-07T08:30:00Z',
    checkSuite: ['NAV_TO_LEDGER', 'LEDGER_BS_TO_INCST', 'LEDGER_TF_TO_CLASS', 'POSITION_TO_LOT', 'LEDGER_TO_SUBLEDGER', 'BASIS_LOT_CHECK'],
    status: 'COMPLETE',
    durationMs: 185000,
    fundsPassed: 4,
    fundsWarning: 0,
    fundsFailed: 2,
  },
  {
    runId: 'RUN-20260206-001',
    eventId: 'EVT-2026-001',
    valuationDt: '2026-02-06',
    executionTime: '2026-02-06T08:15:00Z',
    checkSuite: ['NAV_TO_LEDGER', 'LEDGER_BS_TO_INCST', 'POSITION_TO_LOT'],
    status: 'COMPLETE',
    durationMs: 142000,
    fundsPassed: 4,
    fundsWarning: 1,
    fundsFailed: 1,
  },
  {
    runId: 'RUN-20260207-002',
    eventId: 'EVT-2026-003',
    valuationDt: '2026-02-07',
    executionTime: '2026-02-07T08:10:00Z',
    checkSuite: ['NAV_TO_LEDGER', 'POSITION_TO_LOT'],
    status: 'COMPLETE',
    durationMs: 95000,
    fundsPassed: 1,
    fundsWarning: 1,
    fundsFailed: 1,
  },
];

// ── Validation Results (for RUN-20260207-001) ───────────────

export const validationResults: ValidationResult[] = [
  // NAV to Ledger (L0)
  { checkType: 'NAV_TO_LEDGER', checkName: 'NAV to Ledger', level: 'L0', fundAccount: 'VG-BOND-IDX', fundName: 'VG Bond Index', status: 'PASSED', lhsRowCount: 12, rhsRowCount: 12, matchedCount: 12, breakCount: 0, totalVariance: 0, maxVariance: 0, durationMs: 342 },
  { checkType: 'NAV_TO_LEDGER', checkName: 'NAV to Ledger', level: 'L0', fundAccount: 'VG-CORP-BOND', fundName: 'VG Corp Bond', status: 'FAILED', lhsRowCount: 8, rhsRowCount: 8, matchedCount: 6, breakCount: 2, totalVariance: 12450, maxVariance: 8200, durationMs: 289 },
  { checkType: 'NAV_TO_LEDGER', checkName: 'NAV to Ledger', level: 'L0', fundAccount: 'VG-HIGH-YIELD', fundName: 'VG High Yield', status: 'FAILED', lhsRowCount: 15, rhsRowCount: 15, matchedCount: 12, breakCount: 3, totalVariance: 24500, maxVariance: 15200, durationMs: 410 },
  { checkType: 'NAV_TO_LEDGER', checkName: 'NAV to Ledger', level: 'L0', fundAccount: 'VG-TREASURY', fundName: 'VG Treasury', status: 'PASSED', lhsRowCount: 10, rhsRowCount: 10, matchedCount: 10, breakCount: 0, totalVariance: 0, maxVariance: 0, durationMs: 315 },
  { checkType: 'NAV_TO_LEDGER', checkName: 'NAV to Ledger', level: 'L0', fundAccount: 'VG-TIPS', fundName: 'VG Inflation-Protected', status: 'PASSED', lhsRowCount: 6, rhsRowCount: 6, matchedCount: 6, breakCount: 0, totalVariance: 0, maxVariance: 0, durationMs: 198 },
  { checkType: 'NAV_TO_LEDGER', checkName: 'NAV to Ledger', level: 'L0', fundAccount: 'VG-INTL-BOND', fundName: 'VG International Bond', status: 'WARNING', lhsRowCount: 10, rhsRowCount: 10, matchedCount: 9, breakCount: 1, totalVariance: 0.03, maxVariance: 0.03, durationMs: 280 },
  // Ledger BS to INCST (L1)
  { checkType: 'LEDGER_BS_TO_INCST', checkName: 'Ledger BS to INCST', level: 'L1', fundAccount: 'VG-BOND-IDX', fundName: 'VG Bond Index', status: 'PASSED', lhsRowCount: 24, rhsRowCount: 24, matchedCount: 24, breakCount: 0, totalVariance: 0, maxVariance: 0, durationMs: 520 },
  { checkType: 'LEDGER_BS_TO_INCST', checkName: 'Ledger BS to INCST', level: 'L1', fundAccount: 'VG-CORP-BOND', fundName: 'VG Corp Bond', status: 'PASSED', lhsRowCount: 18, rhsRowCount: 18, matchedCount: 18, breakCount: 0, totalVariance: 0, maxVariance: 0, durationMs: 445 },
  { checkType: 'LEDGER_BS_TO_INCST', checkName: 'Ledger BS to INCST', level: 'L1', fundAccount: 'VG-HIGH-YIELD', fundName: 'VG High Yield', status: 'FAILED', lhsRowCount: 30, rhsRowCount: 30, matchedCount: 28, breakCount: 2, totalVariance: 8400, maxVariance: 5200, durationMs: 612 },
  { checkType: 'LEDGER_BS_TO_INCST', checkName: 'Ledger BS to INCST', level: 'L1', fundAccount: 'VG-TREASURY', fundName: 'VG Treasury', status: 'PASSED', lhsRowCount: 20, rhsRowCount: 20, matchedCount: 20, breakCount: 0, totalVariance: 0, maxVariance: 0, durationMs: 389 },
  // Position to Lot (L2)
  { checkType: 'POSITION_TO_LOT', checkName: 'Position to Lot', level: 'L2', fundAccount: 'VG-BOND-IDX', fundName: 'VG Bond Index', status: 'PASSED', lhsRowCount: 145, rhsRowCount: 145, matchedCount: 145, breakCount: 0, totalVariance: 0, maxVariance: 0, durationMs: 1250 },
  { checkType: 'POSITION_TO_LOT', checkName: 'Position to Lot', level: 'L2', fundAccount: 'VG-HIGH-YIELD', fundName: 'VG High Yield', status: 'PASSED', lhsRowCount: 89, rhsRowCount: 89, matchedCount: 89, breakCount: 0, totalVariance: 0, maxVariance: 0, durationMs: 980 },
  { checkType: 'POSITION_TO_LOT', checkName: 'Position to Lot', level: 'L2', fundAccount: 'VG-CORP-BOND', fundName: 'VG Corp Bond', status: 'PASSED', lhsRowCount: 65, rhsRowCount: 65, matchedCount: 65, breakCount: 0, totalVariance: 0, maxVariance: 0, durationMs: 720 },
];

// ── Break Records ───────────────────────────────────────────

const highYieldAI: AIAnalysis = {
  analysisId: 'AI-001',
  rootCauseSummary: 'Day count convention mismatch: CPU uses ACT/ACT, Incumbent uses 30/360 for CUSIP 789456123. This results in a 2-day accrual difference producing $15,200 variance in accrued income.',
  confidenceScore: 0.91,
  evidenceChain: [
    { stepNumber: 1, description: 'NAV variance of $24.5K traced to Accrued Income component' },
    { stepNumber: 2, description: 'Position 789456123 contributes $15.2K of the variance' },
    { stepNumber: 3, description: 'Day count: ACT/ACT = 32 days, 30/360 = 30 days — 2-day difference' },
    { stepNumber: 4, description: 'Coupon rate 4.5% on $10M face = $1,232.88/day × 2 = $2,465.75 per class' },
  ],
  breakCategory: 'METHODOLOGY',
  similarBreaks: [
    { breakId: 'BRK-2026-045', fundName: 'Fund DEF', date: '2026-01-15', variance: 12300, resolution: 'Config update to ACT/ACT' },
    { breakId: 'BRK-2025-189', fundName: 'Fund GHI', date: '2025-12-20', variance: 9800, resolution: 'Incumbent timing difference' },
  ],
  recommendedActions: [
    { id: 'act-1', description: 'Update day count convention in incumbent configuration to ACT/ACT for fixed income positions' },
    { id: 'act-2', description: 'Verify all CUSIP-level accrual settings across fund family' },
  ],
};

const corpBondAI: AIAnalysis = {
  analysisId: 'AI-002',
  rootCauseSummary: 'Stale pricing for corporate bond CUSIP 456789012. Incumbent used T-1 price while CPU used T price. Price difference of $0.25 per unit on 50,000 units = $12,500 variance.',
  confidenceScore: 0.89,
  evidenceChain: [
    { stepNumber: 1, description: 'NAV variance of $12.4K in VG Corp Bond' },
    { stepNumber: 2, description: 'Traced to Investment at Market component' },
    { stepNumber: 3, description: 'CUSIP 456789012 priced at $98.75 (CPU) vs $98.50 (Incumbent)' },
  ],
  breakCategory: 'PRICING',
  similarBreaks: [
    { breakId: 'BRK-2026-032', fundName: 'VG Bond Index', date: '2026-01-28', variance: 8900, resolution: 'Timing — resolved next day' },
  ],
  recommendedActions: [
    { id: 'act-3', description: 'Confirm pricing cutoff times align between systems' },
  ],
};

export const breakRecords: BreakRecord[] = [
  // VG High Yield breaks
  {
    breakId: 'BRK-2026-101',
    validationRunId: 'RUN-20260207-001',
    fundAccount: 'VG-HIGH-YIELD',
    fundName: 'VG High Yield',
    checkType: 'NAV_TO_LEDGER',
    level: 'L0',
    lhsValue: 125420000,
    rhsValue: 125428400,
    variance: 8400,
    state: 'ANALYZING',
    aiAnalysis: highYieldAI,
    securityId: '789456123',
    glCategory: 'Accrued Income',
  },
  {
    breakId: 'BRK-2026-102',
    validationRunId: 'RUN-20260207-001',
    fundAccount: 'VG-HIGH-YIELD',
    fundName: 'VG High Yield',
    checkType: 'NAV_TO_LEDGER',
    level: 'L0',
    lhsValue: 42350000,
    rhsValue: 42332000,
    variance: -18200,
    state: 'HUMAN_REVIEW_PENDING',
    securityId: '456789012',
    glCategory: 'Investment at Market',
  },
  {
    breakId: 'BRK-2026-103',
    validationRunId: 'RUN-20260207-001',
    fundAccount: 'VG-HIGH-YIELD',
    fundName: 'VG High Yield',
    checkType: 'NAV_TO_LEDGER',
    level: 'L0',
    lhsValue: 8900000,
    rhsValue: 8904200,
    variance: 4200,
    state: 'AI_PASSED',
    aiAnalysis: {
      analysisId: 'AI-003',
      rootCauseSummary: 'Minor receivable timing difference — settles T+1.',
      confidenceScore: 0.96,
      evidenceChain: [{ stepNumber: 1, description: 'Receivable posted T in CPU, T+1 in incumbent' }],
      breakCategory: 'TIMING',
      similarBreaks: [],
      recommendedActions: [],
    },
    glCategory: 'Receivables',
  },
  {
    breakId: 'BRK-2026-104',
    validationRunId: 'RUN-20260207-001',
    fundAccount: 'VG-HIGH-YIELD',
    fundName: 'VG High Yield',
    checkType: 'LEDGER_BS_TO_INCST',
    level: 'L1',
    lhsValue: 24500,
    rhsValue: 0,
    variance: 24500,
    state: 'ANALYZING',
    aiAnalysis: highYieldAI,
    glCategory: 'Accrued Income',
  },
  {
    breakId: 'BRK-2026-105',
    validationRunId: 'RUN-20260207-001',
    fundAccount: 'VG-HIGH-YIELD',
    fundName: 'VG High Yield',
    checkType: 'LEDGER_BS_TO_INCST',
    level: 'L1',
    lhsValue: 5200,
    rhsValue: 0,
    variance: 5200,
    state: 'DETECTED',
    glCategory: 'Payables',
  },
  // VG Corp Bond breaks
  {
    breakId: 'BRK-2026-106',
    validationRunId: 'RUN-20260207-001',
    fundAccount: 'VG-CORP-BOND',
    fundName: 'VG Corp Bond',
    checkType: 'NAV_TO_LEDGER',
    level: 'L0',
    lhsValue: 98750000,
    rhsValue: 98737550,
    variance: -12450,
    state: 'HUMAN_REVIEW_PENDING',
    aiAnalysis: corpBondAI,
    securityId: '456789012',
    glCategory: 'Investment at Market',
  },
  {
    breakId: 'BRK-2026-107',
    validationRunId: 'RUN-20260207-001',
    fundAccount: 'VG-CORP-BOND',
    fundName: 'VG Corp Bond',
    checkType: 'NAV_TO_LEDGER',
    level: 'L0',
    lhsValue: 2100000,
    rhsValue: 2091800,
    variance: -8200,
    state: 'IN_REVIEW',
    aiAnalysis: {
      analysisId: 'AI-004',
      rootCauseSummary: 'Accrual methodology difference for floating rate note.',
      confidenceScore: 0.72,
      evidenceChain: [
        { stepNumber: 1, description: 'Floating rate note CUSIP 321654987 accrual differs' },
        { stepNumber: 2, description: 'CPU uses SOFR + 150bps, Incumbent uses LIBOR + 150bps' },
      ],
      breakCategory: 'METHODOLOGY',
      similarBreaks: [],
      recommendedActions: [{ id: 'act-5', description: 'Verify benchmark rate configuration' }],
    },
    humanAnnotation: {
      annotationId: 'ANN-001',
      reviewerUserId: 'u2',
      reviewerName: 'Mike Chen',
      reviewerRole: 'FUND_ACCOUNTANT',
      action: 'MODIFY',
      notes: 'Confirmed SOFR vs LIBOR mismatch. Incumbent needs to update to SOFR.',
      resolutionCategory: 'METHODOLOGY',
      timestamp: '2026-02-07T09:15:00Z',
    },
    securityId: '321654987',
    glCategory: 'Accrued Income',
  },
  // VG Intl Bond (warning-level)
  {
    breakId: 'BRK-2026-108',
    validationRunId: 'RUN-20260207-001',
    fundAccount: 'VG-INTL-BOND',
    fundName: 'VG International Bond',
    checkType: 'NAV_TO_LEDGER',
    level: 'L0',
    lhsValue: 45000000,
    rhsValue: 45000000.03,
    variance: 0.03,
    state: 'AI_PASSED',
    aiAnalysis: {
      analysisId: 'AI-005',
      rootCauseSummary: 'Rounding difference within tolerance — no action required.',
      confidenceScore: 0.99,
      evidenceChain: [{ stepNumber: 1, description: '$0.03 variance is within $0.05 tolerance threshold' }],
      breakCategory: 'DATA',
      similarBreaks: [],
      recommendedActions: [],
    },
    glCategory: 'NAV Total',
  },
];

// ── Waterfall Data (VG High Yield) ──────────────────────────

export const waterfallData: WaterfallItem[] = [
  { label: 'Incumbent NAV', value: 125420000, type: 'start' },
  { label: 'Inv at Market', value: -18200, type: 'delta', hasBreak: true },
  { label: 'Accrued Income', value: 24500, type: 'delta', hasBreak: true },
  { label: 'Payables', value: -2100, type: 'delta' },
  { label: 'Receivables', value: 4200, type: 'delta', hasBreak: true },
  { label: 'CPU NAV', value: 125428400, type: 'end' },
];

// ── Reconciliation Tree (VG High Yield) ─────────────────────

export const reconTree: ReconTreeNode = {
  id: 'L0-NAV',
  label: 'NAV',
  level: 'L0',
  variance: 8400,
  status: 'BREAK',
  children: [
    {
      id: 'L1-ACCRUED',
      label: 'Accrued Income',
      level: 'L1',
      variance: 24500,
      status: 'BREAK',
      children: [
        {
          id: 'L2-FI-POS',
          label: 'Fixed Income Positions',
          level: 'L2',
          variance: 24500,
          status: 'BREAK',
          children: [
            { id: 'L3-789456123', label: 'CUSIP 789456123', level: 'L3', variance: 15200, status: 'BREAK' },
            { id: 'L3-456789012', label: 'CUSIP 456789012', level: 'L3', variance: 6800, status: 'BREAK' },
            { id: 'L3-111222333', label: 'CUSIP 111222333', level: 'L3', variance: 2500, status: 'WARNING' },
          ],
        },
        { id: 'L2-EQ-POS', label: 'Equity Positions', level: 'L2', variance: 0, status: 'PASS' },
      ],
    },
    {
      id: 'L1-INV-MKT',
      label: 'Investment at Market',
      level: 'L1',
      variance: -18200,
      status: 'BREAK',
      children: [
        { id: 'L2-BOND-MV', label: 'Bond Market Value', level: 'L2', variance: -18200, status: 'BREAK' },
      ],
    },
    { id: 'L1-RECV', label: 'Receivables', level: 'L1', variance: 4200, status: 'BREAK' },
    { id: 'L1-PAY', label: 'Payables', level: 'L1', variance: -2100, status: 'PASS' },
  ],
};

// ── Transaction Detail (VG High Yield) ──────────────────────

export const transactionDetails: TransactionDetail[] = [
  { securityId: '789456123', securityName: 'XYZ Corp 4.5% 2030', cpuValue: 42350, incumbentValue: 27150, variance: 15200, tradeDate: '2026-01-15', settleDate: '2026-01-17' },
  { securityId: '456789012', securityName: 'ABC Inc 3.75% 2028', cpuValue: 18900, incumbentValue: 12100, variance: 6800, tradeDate: '2026-01-20', settleDate: '2026-01-22' },
  { securityId: '111222333', securityName: 'DEF Ltd 5.0% 2032', cpuValue: 8500, incumbentValue: 6000, variance: 2500, tradeDate: '2026-02-01', settleDate: '2026-02-03' },
];

// ── Activity Feed ───────────────────────────────────────────

export const activityFeed: ActivityFeedItem[] = [
  { id: 'af-1', type: 'VALIDATION_RUN', message: 'Validation run completed for Vanguard FI — 4 passed, 2 failed', eventId: 'EVT-2026-001', timestamp: '2026-02-07T08:35:00Z', userName: 'System' },
  { id: 'af-2', type: 'AI_ANALYSIS', message: 'AI analysis complete for VG Corp Bond — 89% confidence', eventId: 'EVT-2026-001', timestamp: '2026-02-07T08:37:00Z', userName: 'AI Agent' },
  { id: 'af-3', type: 'HUMAN_ANNOTATION', message: 'Mike Chen annotated BRK-2026-107 — Modified root cause', eventId: 'EVT-2026-001', timestamp: '2026-02-07T09:15:00Z', userId: 'u2', userName: 'Mike Chen' },
  { id: 'af-4', type: 'STATUS_CHANGE', message: 'Fidelity Equity Suite signed off — all funds passed', eventId: 'EVT-2026-002', timestamp: '2026-02-07T07:50:00Z', userId: 'u1', userName: 'Jane Doe' },
  { id: 'af-5', type: 'VALIDATION_RUN', message: 'Validation run started for T. Rowe Price — 2 checks', eventId: 'EVT-2026-003', timestamp: '2026-02-07T08:10:00Z', userName: 'System' },
  { id: 'af-6', type: 'AI_ANALYSIS', message: 'AI analyzing 3 breaks in T. Rowe Blue Chip Growth', eventId: 'EVT-2026-003', timestamp: '2026-02-07T08:12:00Z', userName: 'AI Agent' },
  { id: 'af-7', type: 'VALIDATION_RUN', message: 'Validation run completed for T. Rowe Price — 1 passed, 1 warning, 1 failed', eventId: 'EVT-2026-003', timestamp: '2026-02-07T08:11:35Z', userName: 'System' },
];
