/**
 * API Service Layer — RECON-AI Control Center
 * Replaces mock data with real backend API calls.
 */
import {
  LedgerSubledgerSummaryResponse,
  LedgerDetailResponse,
  PositionTotalsResponse,
  UnsettledTotalsResponse,
  LedgerCategory,
  GLCategoryMapping,
  NavCompareRow,
  CrossCheckResult,
  TrialBalanceCategoryRow,
  SubledgerCheckResult,
  PositionCompareRow,
  TaxLotRow,
  BasisLotRow,
  AICommentaryData,
} from '../types';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }
  return response.json();
}

// ── Events ──────────────────────────────────────────────────

export async function fetchEvents(status?: string) {
  const params = status && status !== 'ALL' ? `?status=${status}` : '';
  return fetchJSON<any[]>(`/api/events${params}`);
}

export async function fetchEvent(eventId: string) {
  return fetchJSON<any>(`/api/events/${eventId}`);
}

// ── Validation Checks ───────────────────────────────────────

export async function fetchValidationChecks() {
  return fetchJSON<any[]>('/api/validation-checks');
}

// ── Validation Runs ─────────────────────────────────────────

export async function fetchEventRuns(eventId: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/runs`);
}

export async function fetchRun(runId: string) {
  return fetchJSON<any>(`/api/runs/${runId}`);
}

export async function fetchRunResults(runId: string) {
  return fetchJSON<any[]>(`/api/runs/${runId}/results`);
}

export interface RunValidationRequest {
  eventId: string;
  valuationDt: string;
  checkSuite: string[];
  fundSelection?: string;
}

export async function runValidation(req: RunValidationRequest) {
  return fetchJSON<any>('/api/validation/run', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// ── Break Records ───────────────────────────────────────────

export async function fetchBreaks(params?: {
  runId?: string;
  fundAccount?: string;
  state?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.runId) searchParams.set('run_id', params.runId);
  if (params?.fundAccount) searchParams.set('fund_account', params.fundAccount);
  if (params?.state) searchParams.set('state', params.state);
  const qs = searchParams.toString();
  return fetchJSON<any[]>(`/api/breaks${qs ? `?${qs}` : ''}`);
}

export async function fetchReviewableBreaks() {
  return fetchJSON<any[]>('/api/breaks/reviewable');
}

export interface AnnotationRequest {
  breakId: string;
  action: 'ACCEPT' | 'MODIFY' | 'REJECT';
  notes: string;
  resolutionCategory?: string;
  reviewerUserId?: string;
  reviewerName?: string;
  reviewerRole?: string;
}

export async function annotateBreak(breakId: string, req: AnnotationRequest) {
  return fetchJSON<any>(`/api/breaks/${breakId}/annotate`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// ── Activity Feed ───────────────────────────────────────────

export async function fetchActivity(limit: number = 20) {
  return fetchJSON<any[]>(`/api/activity?limit=${limit}`);
}

// ── Fund-level Data ─────────────────────────────────────────

export async function fetchFundWaterfall(fundAccount: string, valuationDt?: string) {
  const params = valuationDt ? `?valuation_dt=${valuationDt}` : '';
  return fetchJSON<any[]>(`/api/funds/${fundAccount}/waterfall${params}`);
}

export async function fetchFundTransactions(fundAccount: string, valuationDt?: string) {
  const params = valuationDt ? `?valuation_dt=${valuationDt}` : '';
  return fetchJSON<any[]>(`/api/funds/${fundAccount}/transactions${params}`);
}

export async function fetchFundPositions(fundAccount: string, valuationDt?: string) {
  const params = valuationDt ? `?valuation_dt=${valuationDt}` : '';
  return fetchJSON<any[]>(`/api/funds/${fundAccount}/positions${params}`);
}

// ── Ledger to Subledger Validation ──────────────────────────

export async function fetchLedgerSubledgerSummary(
  fundAccount: string,
  valuationDt?: string,
  userBank: string = 'CPU'
): Promise<LedgerSubledgerSummaryResponse> {
  const params = new URLSearchParams();
  if (valuationDt) params.set('valuation_dt', valuationDt);
  params.set('user_bank', userBank);
  const qs = params.toString();
  return fetchJSON<LedgerSubledgerSummaryResponse>(
    `/api/funds/${fundAccount}/ledger-subledger${qs ? `?${qs}` : ''}`
  );
}

export async function fetchLedgerDetail(
  fundAccount: string,
  category: string,
  valuationDt?: string,
  userBank: string = 'CPU'
): Promise<LedgerDetailResponse> {
  const params = new URLSearchParams();
  params.set('category', category);
  if (valuationDt) params.set('valuation_dt', valuationDt);
  params.set('user_bank', userBank);
  return fetchJSON<LedgerDetailResponse>(
    `/api/funds/${fundAccount}/ledger-detail?${params.toString()}`
  );
}

export async function fetchPositionTotals(
  fundAccount: string,
  category: string,
  valuationDt?: string,
  userBank: string = 'CPU'
): Promise<PositionTotalsResponse> {
  const params = new URLSearchParams();
  params.set('category', category);
  if (valuationDt) params.set('valuation_dt', valuationDt);
  params.set('user_bank', userBank);
  return fetchJSON<PositionTotalsResponse>(
    `/api/funds/${fundAccount}/position-totals?${params.toString()}`
  );
}

export async function fetchUnsettledTotals(
  fundAccount: string,
  category: string,
  valuationDt?: string
): Promise<UnsettledTotalsResponse> {
  const params = new URLSearchParams();
  params.set('category', category);
  if (valuationDt) params.set('valuation_dt', valuationDt);
  return fetchJSON<UnsettledTotalsResponse>(
    `/api/funds/${fundAccount}/unsettled-totals?${params.toString()}`
  );
}

export async function fetchLedgerCategories(): Promise<LedgerCategory[]> {
  return fetchJSON<LedgerCategory[]>('/api/reference/ledger-categories');
}

export async function fetchGLCategoryMappings(
  chartOfAccounts?: string
): Promise<GLCategoryMapping[]> {
  const params = chartOfAccounts ? `?chart_of_accounts=${chartOfAccounts}` : '';
  return fetchJSON<GLCategoryMapping[]>(`/api/reference/gl-category-mappings${params}`);
}

export async function createGLCategoryMapping(mapping: Omit<GLCategoryMapping, '_id'>): Promise<{ message: string; mapping: GLCategoryMapping }> {
  return fetchJSON('/api/reference/gl-category-mappings', {
    method: 'POST',
    body: JSON.stringify(mapping),
  });
}

export async function updateGLCategoryMapping(
  glAccountNumber: string,
  mapping: Partial<GLCategoryMapping>,
  chartOfAccounts: string = 'investone mufg'
): Promise<{ message: string }> {
  const params = `?chart_of_accounts=${encodeURIComponent(chartOfAccounts)}`;
  return fetchJSON(`/api/reference/gl-category-mappings/${encodeURIComponent(glAccountNumber)}${params}`, {
    method: 'PUT',
    body: JSON.stringify(mapping),
  });
}

export async function deleteGLCategoryMapping(
  glAccountNumber: string,
  chartOfAccounts: string = 'investone mufg'
): Promise<{ message: string }> {
  const params = `?chart_of_accounts=${encodeURIComponent(chartOfAccounts)}`;
  return fetchJSON(`/api/reference/gl-category-mappings/${encodeURIComponent(glAccountNumber)}${params}`, {
    method: 'DELETE',
  });
}

// ══════════════════════════════════════════════════════════════
// PROCESS FLOW DRILL-DOWN ENDPOINTS
// ══════════════════════════════════════════════════════════════

// ── NAV Compare ────────────────────────────────────────────

export async function fetchNavCompare(eventId: string, valuationDt: string): Promise<NavCompareRow[]> {
  return fetchJSON<NavCompareRow[]>(`/api/events/${eventId}/nav-compare?valuationDt=${valuationDt}`);
}

export async function fetchNavCrossChecks(eventId: string, account: string, valuationDt: string): Promise<CrossCheckResult> {
  return fetchJSON<CrossCheckResult>(`/api/events/${eventId}/nav-compare/${account}/cross-checks?valuationDt=${valuationDt}`);
}

// ── Trial Balance Compare ──────────────────────────────────

export async function fetchTrialBalanceCompare(account: string, valuationDt: string): Promise<TrialBalanceCategoryRow[]> {
  return fetchJSON<TrialBalanceCategoryRow[]>(`/api/funds/${account}/trial-balance-compare?valuationDt=${valuationDt}`);
}

export async function fetchSubledgerCheck(account: string, category: string, valuationDt: string): Promise<SubledgerCheckResult> {
  return fetchJSON<SubledgerCheckResult>(
    `/api/funds/${account}/trial-balance-compare/${encodeURIComponent(category)}/subledger-check?valuationDt=${valuationDt}`
  );
}

// ── Position Compare ───────────────────────────────────────

export async function fetchPositionCompare(
  account: string,
  valuationDt: string,
  category: string
): Promise<PositionCompareRow[]> {
  return fetchJSON<PositionCompareRow[]>(
    `/api/funds/${account}/position-compare?valuationDt=${valuationDt}&category=${encodeURIComponent(category)}`
  );
}

export async function fetchTaxLots(
  account: string,
  assetId: string,
  valuationDt: string
): Promise<TaxLotRow[]> {
  return fetchJSON<TaxLotRow[]>(
    `/api/funds/${account}/position-compare/${encodeURIComponent(assetId)}/tax-lots?valuationDt=${valuationDt}`
  );
}

// ── Basis Lot Check ────────────────────────────────────────

export async function fetchBasisLotCheck(account: string, valuationDt: string): Promise<BasisLotRow[]> {
  return fetchJSON<BasisLotRow[]>(`/api/funds/${account}/basis-lot-check?valuationDt=${valuationDt}`);
}

// ── Available Dates & AI Analysis ──────────────────────────

export async function fetchAvailableDates(eventId: string): Promise<string[]> {
  return fetchJSON<string[]>(`/api/events/${eventId}/available-dates`);
}

export async function fetchAIAnalysis(
  eventId: string,
  account?: string,
  category?: string
): Promise<AICommentaryData> {
  const params = new URLSearchParams({ eventId });
  if (account) params.set('account', account);
  if (category) params.set('category', category);
  return fetchJSON<AICommentaryData>(`/api/ai/analysis?${params.toString()}`);
}

// ── Sequential Validation ──────────────────────────────────

export async function runSequentialValidation(
  eventId: string,
  valuationDt: string,
  checkSuite: string[],
  fundSelection?: string
) {
  return fetchJSON<any>('/api/validation/run-sequential', {
    method: 'POST',
    body: JSON.stringify({ eventId, valuationDt, checkSuite, fundSelection }),
  });
}

// ── Health Check ────────────────────────────────────────────

export async function healthCheck() {
  return fetchJSON<{ status: string; timestamp: string }>('/api/health');
}
