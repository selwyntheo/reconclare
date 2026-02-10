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

// ── Health Check ────────────────────────────────────────────

export async function healthCheck() {
  return fetchJSON<{ status: string; timestamp: string }>('/api/health');
}
