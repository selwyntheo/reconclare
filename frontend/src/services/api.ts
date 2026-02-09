/**
 * API Service Layer — RECON-AI Control Center
 * Replaces mock data with real backend API calls.
 */

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

// ── Health Check ────────────────────────────────────────────

export async function healthCheck() {
  return fetchJSON<{ status: string; timestamp: string }>('/api/health');
}
