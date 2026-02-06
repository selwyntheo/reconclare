import {
  ValidationRule,
  ValidationResult,
  DerivedRollupRule,
  ValidationSummary,
} from '../types';

// ── §1 Validation Matrix Rules (LHS vs RHS) ─────────────────

export const validationRules: ValidationRule[] = [
  {
    id: 'VAL-1.1',
    name: 'NAV to Ledger',
    ruleType: 'NAV_TO_LEDGER',
    section: '1.1',
    lhs: {
      source: 'dataNav',
      keys: ['valuationDt', 'account', 'class'],
      displayFields: ['accountName'],
      compareFields: ['netAssets'],
      filter: "isPrimaryBasis = 'Y'",
    },
    rhs: {
      source: 'dataLedger',
      keys: ['valuationDt', 'account', 'class'],
      displayFields: ['accountName'],
      compareFields: ['endingBalance'],
      filter: "isPrimaryBasis = 'Y' AND eagleClass = 'TF' AND (LEFT(eagleLedgerAcct,1) = '1' OR LEFT(eagleLedgerAcct,1) = '2')",
    },
    toleranceAbsolute: 0.01,
  },
  {
    id: 'VAL-1.2',
    name: 'Ledger BS to INCST',
    ruleType: 'LEDGER_BS_TO_INCST',
    section: '1.2',
    lhs: {
      source: 'dataLedger',
      keys: ['valuationDt', 'account'],
      displayFields: ['accountName'],
      compareFields: ['endingBalance'],
      filter: "isPrimaryBasis = 'Y' AND eagleClass = 'TF' AND (LEFT(eagleLedgerAcct,1) <> '1' AND LEFT(eagleLedgerAcct,1) <> '2')",
    },
    rhs: {
      source: 'dataLedger',
      keys: ['valuationDt', 'account'],
      displayFields: ['accountName'],
      compareFields: ['endingBalance'],
      filter: "isPrimaryBasis = 'Y' AND eagleClass = 'TF' AND isSleeve <> 1",
    },
    toleranceAbsolute: 0.01,
  },
  {
    id: 'VAL-1.3',
    name: 'Ledger TF to Class',
    ruleType: 'LEDGER_TF_TO_CLASS',
    section: '1.3',
    lhs: {
      source: 'dataLedger',
      keys: ['valuationDt', 'account', 'glAccountNumber'],
      displayFields: ['glDescription'],
      compareFields: ['endingBalance'],
      filter: "eagleClass = 'TF' AND classLevel = 1 AND isSleeve = 0 AND isPrimaryBasis = 'Y'",
    },
    rhs: {
      source: 'dataLedger',
      keys: ['valuationDt', 'account', 'glAccountNumber'],
      displayFields: ['glDescription'],
      compareFields: ['endingBalance'],
      filter: "eagleClass = 'TF' AND isComposite = 1 AND isPrimaryBasis = 'Y'",
    },
    toleranceAbsolute: 0.01,
  },
  {
    id: 'VAL-1.4',
    name: 'Position to Lot',
    ruleType: 'POSITION_TO_LOT',
    section: '1.4',
    lhs: {
      source: 'dataSubLedgerTrans',
      keys: ['valuationDt', 'account', 'class', 'assetid', 'longShort'],
      displayFields: ['secType', 'issueDescription'],
      compareFields: [
        'shares', 'originalFace', 'origCostLocal', 'origCostBase',
        'bookValueLocal', 'bookValueBase', 'marketValueLocal', 'marketValueBase',
      ],
    },
    rhs: {
      source: 'dataSubLedgerPosition',
      keys: ['valuationDt', 'account', 'class', 'assetid', 'longShort'],
      displayFields: ['secType', 'issueDescription'],
      compareFields: [
        'posShares', 'posOriginalFace', 'posOrigCostLocal', 'posOrigCostBase',
        'posBookValueLocal', 'posBookValueBase', 'posMarketValueLocal', 'posMarketValueBase',
      ],
    },
    toleranceAbsolute: 0.01,
  },
  {
    id: 'VAL-1.5',
    name: 'Ledger to Subledger',
    ruleType: 'LEDGER_TO_SUBLEDGER',
    section: '1.5',
    lhs: {
      source: 'dataLedger',
      keys: ['valuationDt', 'account', 'eagleLedgerAcct'],
      displayFields: ['ledgerDescription'],
      compareFields: ['endingBalance'],
      filter: "eagleClass = 'TF' AND isPrimaryBasis = 'Y'",
    },
    rhs: {
      source: 'derivedSubLedgerRollup',
      keys: ['valuationDt', 'account', 'eagleLedgerAcct'],
      displayFields: ['ledgerDescription'],
      compareFields: ['subLedgerValue'],
      filter: "isPrimaryBasis = 'Y'",
    },
    toleranceAbsolute: 0.01,
  },
  {
    id: 'VAL-1.6',
    name: 'Basis Lot Check',
    ruleType: 'BASIS_LOT_CHECK',
    section: '1.6',
    lhs: {
      source: 'dataSubLedgerTrans',
      keys: ['valuationDt', 'account', 'class', 'assetid'],
      displayFields: ['secType', 'issueDescription'],
      compareFields: ['shares'],
      filter: "isPrimaryBasis = 'Y'",
    },
    rhs: {
      source: 'dataSubLedgerTrans',
      keys: ['valuationDt', 'account', 'class', 'assetid'],
      displayFields: ['secType', 'issueDescription'],
      compareFields: ['shares'],
      filter: "isPrimaryBasis <> 'Y'",
    },
    toleranceAbsolute: 0.01,
  },
];

// ── §2 Derived SubLedger Rollup Rules ────────────────────────

export const derivedRollupRules: DerivedRollupRule[] = [
  // 2.1 Capital & Subscriptions
  { id: 'DR-2.1.1', name: 'Capital Subs', category: 'CAPITAL_SUBSCRIPTIONS', sourceTable: 'dataNav', ledgerAccount: '3002000110', dataExpression: '[subscriptionBalance] * -1' },
  { id: 'DR-2.1.2', name: 'Capital Reds', category: 'CAPITAL_SUBSCRIPTIONS', sourceTable: 'dataNav', ledgerAccount: '3002000210', dataExpression: '[redemptionBalance]' },
  { id: 'DR-2.1.3', name: 'Capital Reinvest', category: 'CAPITAL_SUBSCRIPTIONS', sourceTable: 'dataNav', ledgerAccount: '3002000210', dataExpression: '[reinvestedDistribution] * -1' },
  { id: 'DR-2.1.4', name: 'Capital Subs Rec', category: 'CAPITAL_SUBSCRIPTIONS', sourceTable: 'dataNav', ledgerAccount: '1005000300', dataExpression: '[subscriptionRecBase]' },
  { id: 'DR-2.1.5', name: 'Capital Reds Pay', category: 'CAPITAL_SUBSCRIPTIONS', sourceTable: 'dataNav', ledgerAccount: '2005003500', dataExpression: '[redemptionPayBase] * -1' },
  // 2.2 Distribution
  { id: 'DR-2.2.1', name: 'Dist Income', category: 'DISTRIBUTION', sourceTable: 'dataNav', ledgerAccount: '3004000100', dataExpression: '[incomeDistribution]' },
  { id: 'DR-2.2.2', name: 'Dist STCG', category: 'DISTRIBUTION', sourceTable: 'dataNav', ledgerAccount: '3004000120', dataExpression: '[stcgDistribution]' },
  { id: 'DR-2.2.3', name: 'Dist LTCG', category: 'DISTRIBUTION', sourceTable: 'dataNav', ledgerAccount: '3004000110', dataExpression: '[ltcgDistribution]' },
  { id: 'DR-2.2.4', name: 'Dist Payable', category: 'DISTRIBUTION', sourceTable: 'dataNav', ledgerAccount: '2006000700', dataExpression: '[distributionPayable] * -1' },
  // 2.3 Forwards
  { id: 'DR-2.3.1', name: 'Forward Cost Rec', category: 'FORWARDS', sourceTable: 'dataSubLedgerTrans', ledgerAccount: '1007001100', dataExpression: 'ABS([fwdBookValue])' },
  { id: 'DR-2.3.2', name: 'Forward Cost Pay', category: 'FORWARDS', sourceTable: 'dataSubLedgerTrans', ledgerAccount: '2005002900', dataExpression: 'ABS([fwdBookValue]) * -1' },
  { id: 'DR-2.3.3', name: 'Forward URGL BS', category: 'FORWARDS', sourceTable: 'dataSubLedgerTrans', ledgerAccount: '1011000201', dataExpression: '[fwdUnrealized]' },
  { id: 'DR-2.3.4', name: 'Forward URGL INCST', category: 'FORWARDS', sourceTable: 'dataSubLedgerTrans', ledgerAccount: '4004000401', dataExpression: '[fwdUnrealized] * -1' },
  // 2.4 Repo (RPR)
  { id: 'DR-2.4.1', name: 'RPR Cost', category: 'REPO', sourceTable: 'dataSubLedgerTrans', ledgerAccount: '[eagleRecPayLedger]', dataExpression: '[transAmountBase]' },
  { id: 'DR-2.4.2', name: 'RPR URGL BS', category: 'REPO', sourceTable: 'dataSubLedgerTrans', ledgerAccount: '1011000300', dataExpression: '[transMarketValue] - [transAmountBase]' },
  { id: 'DR-2.4.3', name: 'RPR URGL INCST', category: 'REPO', sourceTable: 'dataSubLedgerTrans', ledgerAccount: '3003000800', dataExpression: '([transMarketValue] - [transAmountBase]) * -1' },
  // 2.5 Securities
  { id: 'DR-2.5.1', name: 'Security Cost', category: 'SECURITIES', sourceTable: 'dataSubLedgerPosition', ledgerAccount: '[eagleCostLedgerAcct]', dataExpression: 'posBookValueBase' },
  { id: 'DR-2.5.2', name: 'Security Interest', category: 'SECURITIES', sourceTable: 'dataSubLedgerPosition', ledgerAccount: '[eagleIntLedgerAcct]', dataExpression: 'posIncomeBase' },
  { id: 'DR-2.5.3', name: 'Security URGL BS', category: 'SECURITIES', sourceTable: 'dataSubLedgerPosition', ledgerAccount: '1011000101', dataExpression: '[posMarketValueBase] - [posBookValueBase]' },
  { id: 'DR-2.5.4', name: 'Security URGL INCST', category: 'SECURITIES', sourceTable: 'dataSubLedgerPosition', ledgerAccount: '3003000301', dataExpression: '([posMarketValueBase] - [posBookValueBase]) * -1' },
  // 2.6 Ledger Load
  { id: 'DR-2.6.1', name: 'Ledger Load', category: 'LEDGER_LOAD', sourceTable: 'dataLedger', ledgerAccount: '[eagleLedgerAcct]', dataExpression: 'endingBalance', filter: 'ledgerLoad = 1' },
  // 2.7 Futures & Income Unrealized
  { id: 'DR-2.7.1', name: 'Future URGL INCST', category: 'FUTURES_INCOME_UNREALIZED', sourceTable: 'dataSubLedgerTrans', ledgerAccount: '3003000500', dataExpression: '[ltdVariationMarginBase]' },
  { id: 'DR-2.7.2', name: 'Security Int URGL BS', category: 'FUTURES_INCOME_UNREALIZED', sourceTable: 'dataSubLedgerPosition', ledgerAccount: '1011000300', dataExpression: '[posIncomeMarket] - [posIncomeBase]' },
  { id: 'DR-2.7.3', name: 'Security Int URGL INCST', category: 'FUTURES_INCOME_UNREALIZED', sourceTable: 'dataSubLedgerPosition', ledgerAccount: '3003000800', dataExpression: '([posIncomeMarket] - [posIncomeBase]) * -1' },
];

// ── Mock Validation Results (per fund, per rule) ─────────────

const funds = [
  'ABC Global Equity',
  'XYZ Fixed Income',
  'DEF Multi-Asset',
  'GHI Emerging Markets',
  'JKL Balanced Fund',
];

export const validationResults: ValidationResult[] = [
  // NAV to Ledger
  { ruleId: 'VAL-1.1', ruleName: 'NAV to Ledger', ruleType: 'NAV_TO_LEDGER', section: '1.1', account: 'ABC Global Equity', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 12, rhsRowCount: 12, matchedCount: 12, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:01:12Z', durationMs: 342 },
  { ruleId: 'VAL-1.1', ruleName: 'NAV to Ledger', ruleType: 'NAV_TO_LEDGER', section: '1.1', account: 'XYZ Fixed Income', valuationDate: '2026-02-05', status: 'failed', lhsRowCount: 8, rhsRowCount: 8, matchedCount: 6, breakCount: 2, totalVariance: 12450.0, maxVariance: 8200.0, executedAt: '2026-02-06T08:01:14Z', durationMs: 289 },
  { ruleId: 'VAL-1.1', ruleName: 'NAV to Ledger', ruleType: 'NAV_TO_LEDGER', section: '1.1', account: 'DEF Multi-Asset', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 15, rhsRowCount: 15, matchedCount: 15, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:01:16Z', durationMs: 410 },
  { ruleId: 'VAL-1.1', ruleName: 'NAV to Ledger', ruleType: 'NAV_TO_LEDGER', section: '1.1', account: 'GHI Emerging Markets', valuationDate: '2026-02-05', status: 'warning', lhsRowCount: 10, rhsRowCount: 10, matchedCount: 9, breakCount: 1, totalVariance: 0.03, maxVariance: 0.03, executedAt: '2026-02-06T08:01:18Z', durationMs: 315 },
  { ruleId: 'VAL-1.1', ruleName: 'NAV to Ledger', ruleType: 'NAV_TO_LEDGER', section: '1.1', account: 'JKL Balanced Fund', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 6, rhsRowCount: 6, matchedCount: 6, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:01:20Z', durationMs: 198 },

  // Ledger BS to INCST
  { ruleId: 'VAL-1.2', ruleName: 'Ledger BS to INCST', ruleType: 'LEDGER_BS_TO_INCST', section: '1.2', account: 'ABC Global Equity', valuationDate: '2026-02-05', status: 'failed', lhsRowCount: 24, rhsRowCount: 24, matchedCount: 21, breakCount: 3, totalVariance: 45230.12, maxVariance: 32100.0, executedAt: '2026-02-06T08:02:01Z', durationMs: 520 },
  { ruleId: 'VAL-1.2', ruleName: 'Ledger BS to INCST', ruleType: 'LEDGER_BS_TO_INCST', section: '1.2', account: 'XYZ Fixed Income', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 18, rhsRowCount: 18, matchedCount: 18, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:02:03Z', durationMs: 445 },
  { ruleId: 'VAL-1.2', ruleName: 'Ledger BS to INCST', ruleType: 'LEDGER_BS_TO_INCST', section: '1.2', account: 'DEF Multi-Asset', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 30, rhsRowCount: 30, matchedCount: 30, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:02:05Z', durationMs: 612 },
  { ruleId: 'VAL-1.2', ruleName: 'Ledger BS to INCST', ruleType: 'LEDGER_BS_TO_INCST', section: '1.2', account: 'GHI Emerging Markets', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 20, rhsRowCount: 20, matchedCount: 20, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:02:07Z', durationMs: 389 },
  { ruleId: 'VAL-1.2', ruleName: 'Ledger BS to INCST', ruleType: 'LEDGER_BS_TO_INCST', section: '1.2', account: 'JKL Balanced Fund', valuationDate: '2026-02-05', status: 'warning', lhsRowCount: 14, rhsRowCount: 14, matchedCount: 13, breakCount: 1, totalVariance: 520.0, maxVariance: 520.0, executedAt: '2026-02-06T08:02:09Z', durationMs: 278 },

  // Ledger TF to Class
  { ruleId: 'VAL-1.3', ruleName: 'Ledger TF to Class', ruleType: 'LEDGER_TF_TO_CLASS', section: '1.3', account: 'ABC Global Equity', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 36, rhsRowCount: 36, matchedCount: 36, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:03:01Z', durationMs: 680 },
  { ruleId: 'VAL-1.3', ruleName: 'Ledger TF to Class', ruleType: 'LEDGER_TF_TO_CLASS', section: '1.3', account: 'XYZ Fixed Income', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 28, rhsRowCount: 28, matchedCount: 28, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:03:03Z', durationMs: 550 },
  { ruleId: 'VAL-1.3', ruleName: 'Ledger TF to Class', ruleType: 'LEDGER_TF_TO_CLASS', section: '1.3', account: 'DEF Multi-Asset', valuationDate: '2026-02-05', status: 'failed', lhsRowCount: 42, rhsRowCount: 42, matchedCount: 39, breakCount: 3, totalVariance: 8920.55, maxVariance: 5200.0, executedAt: '2026-02-06T08:03:05Z', durationMs: 720 },
  { ruleId: 'VAL-1.3', ruleName: 'Ledger TF to Class', ruleType: 'LEDGER_TF_TO_CLASS', section: '1.3', account: 'GHI Emerging Markets', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 22, rhsRowCount: 22, matchedCount: 22, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:03:07Z', durationMs: 410 },
  { ruleId: 'VAL-1.3', ruleName: 'Ledger TF to Class', ruleType: 'LEDGER_TF_TO_CLASS', section: '1.3', account: 'JKL Balanced Fund', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 16, rhsRowCount: 16, matchedCount: 16, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:03:09Z', durationMs: 320 },

  // Position to Lot
  { ruleId: 'VAL-1.4', ruleName: 'Position to Lot', ruleType: 'POSITION_TO_LOT', section: '1.4', account: 'ABC Global Equity', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 145, rhsRowCount: 145, matchedCount: 145, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:04:01Z', durationMs: 1250 },
  { ruleId: 'VAL-1.4', ruleName: 'Position to Lot', ruleType: 'POSITION_TO_LOT', section: '1.4', account: 'XYZ Fixed Income', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 89, rhsRowCount: 89, matchedCount: 89, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:04:03Z', durationMs: 980 },
  { ruleId: 'VAL-1.4', ruleName: 'Position to Lot', ruleType: 'POSITION_TO_LOT', section: '1.4', account: 'DEF Multi-Asset', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 210, rhsRowCount: 210, matchedCount: 210, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:04:05Z', durationMs: 1580 },
  { ruleId: 'VAL-1.4', ruleName: 'Position to Lot', ruleType: 'POSITION_TO_LOT', section: '1.4', account: 'GHI Emerging Markets', valuationDate: '2026-02-05', status: 'failed', lhsRowCount: 120, rhsRowCount: 118, matchedCount: 116, breakCount: 4, totalVariance: 1250.0, maxVariance: 750.0, executedAt: '2026-02-06T08:04:07Z', durationMs: 1100 },
  { ruleId: 'VAL-1.4', ruleName: 'Position to Lot', ruleType: 'POSITION_TO_LOT', section: '1.4', account: 'JKL Balanced Fund', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 65, rhsRowCount: 65, matchedCount: 65, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:04:09Z', durationMs: 720 },

  // Ledger to Subledger
  { ruleId: 'VAL-1.5', ruleName: 'Ledger to Subledger', ruleType: 'LEDGER_TO_SUBLEDGER', section: '1.5', account: 'ABC Global Equity', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 48, rhsRowCount: 48, matchedCount: 48, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:05:01Z', durationMs: 890 },
  { ruleId: 'VAL-1.5', ruleName: 'Ledger to Subledger', ruleType: 'LEDGER_TO_SUBLEDGER', section: '1.5', account: 'XYZ Fixed Income', valuationDate: '2026-02-05', status: 'failed', lhsRowCount: 35, rhsRowCount: 35, matchedCount: 32, breakCount: 3, totalVariance: 7800.25, maxVariance: 4500.0, executedAt: '2026-02-06T08:05:03Z', durationMs: 760 },
  { ruleId: 'VAL-1.5', ruleName: 'Ledger to Subledger', ruleType: 'LEDGER_TO_SUBLEDGER', section: '1.5', account: 'DEF Multi-Asset', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 55, rhsRowCount: 55, matchedCount: 55, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:05:05Z', durationMs: 920 },
  { ruleId: 'VAL-1.5', ruleName: 'Ledger to Subledger', ruleType: 'LEDGER_TO_SUBLEDGER', section: '1.5', account: 'GHI Emerging Markets', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 30, rhsRowCount: 30, matchedCount: 30, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:05:07Z', durationMs: 650 },
  { ruleId: 'VAL-1.5', ruleName: 'Ledger to Subledger', ruleType: 'LEDGER_TO_SUBLEDGER', section: '1.5', account: 'JKL Balanced Fund', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 22, rhsRowCount: 22, matchedCount: 22, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:05:09Z', durationMs: 480 },

  // Basis Lot Check
  { ruleId: 'VAL-1.6', ruleName: 'Basis Lot Check', ruleType: 'BASIS_LOT_CHECK', section: '1.6', account: 'ABC Global Equity', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 145, rhsRowCount: 145, matchedCount: 145, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:06:01Z', durationMs: 1320 },
  { ruleId: 'VAL-1.6', ruleName: 'Basis Lot Check', ruleType: 'BASIS_LOT_CHECK', section: '1.6', account: 'XYZ Fixed Income', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 89, rhsRowCount: 89, matchedCount: 89, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:06:03Z', durationMs: 1050 },
  { ruleId: 'VAL-1.6', ruleName: 'Basis Lot Check', ruleType: 'BASIS_LOT_CHECK', section: '1.6', account: 'DEF Multi-Asset', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 210, rhsRowCount: 210, matchedCount: 210, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:06:05Z', durationMs: 1680 },
  { ruleId: 'VAL-1.6', ruleName: 'Basis Lot Check', ruleType: 'BASIS_LOT_CHECK', section: '1.6', account: 'GHI Emerging Markets', valuationDate: '2026-02-05', status: 'warning', lhsRowCount: 120, rhsRowCount: 118, matchedCount: 117, breakCount: 3, totalVariance: 0.05, maxVariance: 0.02, executedAt: '2026-02-06T08:06:07Z', durationMs: 1150 },
  { ruleId: 'VAL-1.6', ruleName: 'Basis Lot Check', ruleType: 'BASIS_LOT_CHECK', section: '1.6', account: 'JKL Balanced Fund', valuationDate: '2026-02-05', status: 'passed', lhsRowCount: 65, rhsRowCount: 65, matchedCount: 65, breakCount: 0, totalVariance: 0, maxVariance: 0, executedAt: '2026-02-06T08:06:09Z', durationMs: 780 },
];

// ── Computed Summary ─────────────────────────────────────────

const passed = validationResults.filter((r) => r.status === 'passed').length;
const failed = validationResults.filter((r) => r.status === 'failed').length;
const warnings = validationResults.filter((r) => r.status === 'warning').length;
const pending = validationResults.filter((r) => r.status === 'pending').length;
const totalRows = validationResults.reduce((s, r) => s + r.lhsRowCount, 0);
const matchedRows = validationResults.reduce((s, r) => s + r.matchedCount, 0);

export const validationSummary: ValidationSummary = {
  totalRules: validationResults.length,
  passed,
  failed,
  warnings,
  pending,
  overallMatchRate: totalRows > 0 ? Math.round((matchedRows / totalRows) * 10000) / 100 : 0,
  totalVariance: validationResults.reduce((s, r) => s + r.totalVariance, 0),
};
