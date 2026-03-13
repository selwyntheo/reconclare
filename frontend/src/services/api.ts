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
  NavValidationRow,
  TrialBalanceValidationRow,
  PositionValidationRow,
  AssetClassification,
  TransClassification,
  LedgerCategoryDerivation,
} from '../types';
import type {
  MappingDefinition,
  MappingValidateResponse,
  PreviewResponse,
  SchemaInferResponse,
  CelFunctionDoc,
  AiFieldMapping,
  LookupTableMeta,
  MappingJob,
  FieldMapping,
  FilterExpression,
  SourceConfig,
  TargetConfig,
  ErrorHandling,
  FieldSchema,
} from '../types/mapping';

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

// ── MMIF Regulatory Filing Events ───────────────────────────

export async function fetchMmifEvents(status?: string) {
  const params = status && status !== 'ALL' ? `?status=${status}` : '';
  return fetchJSON<any[]>(`/api/mmif/events${params}`);
}

export async function fetchMmifEvent(eventId: string) {
  return fetchJSON<any>(`/api/mmif/events/${eventId}`);
}

export async function fetchMmifEventRuns(eventId: string) {
  return fetchJSON<any[]>(`/api/mmif/events/${eventId}/runs`);
}

export async function fetchMmifEventBreaks(eventId: string, ruleId?: string) {
  const params = ruleId ? `?rule_id=${ruleId}` : '';
  return fetchJSON<any[]>(`/api/mmif/events/${eventId}/breaks${params}`);
}

export async function runMmifValidation(request: { eventId: string; filingPeriod: string; checkSuite: string[]; fundSelection?: string }) {
  return fetchJSON<any>(`/api/mmif/events/${request.eventId}/validate`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function fetchMmifSummary(eventId: string) {
  return fetchJSON<any>(`/api/mmif/events/${eventId}/summary`);
}

export async function fetchMmifMapping(eventId: string, account?: string) {
  const params = account ? `?account=${account}` : '';
  return fetchJSON<any[]>(`/api/mmif/events/${eventId}/mapping${params}`);
}

export async function fetchMmifValidationRules() {
  return fetchJSON<any[]>('/api/mmif/validation-rules');
}

export async function fetchMmifCheckSuiteOptions() {
  return fetchJSON<any[]>('/api/mmif/check-suite-options');
}

// MMIF Agent Analysis
export async function runMmifAgentAnalysis(eventId: string) {
  return fetchJSON<any>(`/api/mmif/events/${eventId}/analyze`, { method: 'POST' });
}
export async function fetchMmifAgentAnalysis(eventId: string) {
  return fetchJSON<any>(`/api/mmif/events/${eventId}/agent-analysis`);
}
export async function fetchMmifAttestation(eventId: string) {
  return fetchJSON<any>(`/api/mmif/events/${eventId}/attestation`);
}
// MMIF Chat
export async function createMmifChatSession(eventId: string) {
  return fetchJSON<any>(`/api/mmif-chat/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId }) });
}
export async function sendMmifChatMessage(sessionId: string, message: string) {
  return fetchJSON<any>(`/api/mmif-chat/session/${sessionId}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
}
export async function fetchMmifChatHistory(sessionId: string) {
  return fetchJSON<any>(`/api/mmif-chat/session/${sessionId}/history`);
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
  reassignedToTeam?: string;
  reassignReason?: string;
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

// ── Dual-System Validation (Internal Checks) ───────────────

export async function fetchNavValidation(eventId: string, valuationDt: string): Promise<NavValidationRow[]> {
  return fetchJSON<NavValidationRow[]>(`/api/events/${eventId}/nav-validation?valuationDt=${valuationDt}`);
}

export async function fetchTrialBalanceValidation(account: string, valuationDt: string): Promise<TrialBalanceValidationRow[]> {
  return fetchJSON<TrialBalanceValidationRow[]>(`/api/funds/${account}/trial-balance-validation?valuationDt=${valuationDt}`);
}

export async function fetchPositionValidation(
  account: string,
  valuationDt: string,
  category?: string
): Promise<PositionValidationRow[]> {
  const params = new URLSearchParams({ valuationDt });
  if (category) params.set('category', category);
  return fetchJSON<PositionValidationRow[]>(`/api/funds/${account}/position-validation?${params.toString()}`);
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

// ══════════════════════════════════════════════════════════════
// CLASSIFICATION MAPPING ENDPOINTS (Section 10)
// ══════════════════════════════════════════════════════════════

// ── Asset Classification ────────────────────────────────────

export async function fetchAssetClassifications(source?: string): Promise<AssetClassification[]> {
  const params = source ? `?source=${encodeURIComponent(source)}` : '';
  return fetchJSON<AssetClassification[]>(`/api/reference/asset-classification${params}`);
}

export async function createAssetClassification(mapping: AssetClassification): Promise<{ message: string; mapping: AssetClassification }> {
  return fetchJSON('/api/reference/asset-classification', {
    method: 'POST',
    body: JSON.stringify(mapping),
  });
}

export async function updateAssetClassification(
  keySecType: string,
  mapping: Partial<AssetClassification>,
  source: string = 'investone'
): Promise<{ message: string }> {
  return fetchJSON(`/api/reference/asset-classification/${encodeURIComponent(keySecType)}?source=${encodeURIComponent(source)}`, {
    method: 'PUT',
    body: JSON.stringify(mapping),
  });
}

export async function deleteAssetClassification(keySecType: string, source: string = 'investone'): Promise<{ message: string }> {
  return fetchJSON(`/api/reference/asset-classification/${encodeURIComponent(keySecType)}?source=${encodeURIComponent(source)}`, {
    method: 'DELETE',
  });
}

// ── Transaction Classification ──────────────────────────────

export async function fetchTransClassifications(source?: string): Promise<TransClassification[]> {
  const params = source ? `?source=${encodeURIComponent(source)}` : '';
  return fetchJSON<TransClassification[]>(`/api/reference/trans-classification${params}`);
}

export async function createTransClassification(mapping: TransClassification): Promise<{ message: string; mapping: TransClassification }> {
  return fetchJSON('/api/reference/trans-classification', {
    method: 'POST',
    body: JSON.stringify(mapping),
  });
}

export async function updateTransClassification(
  keyTransCode: string,
  mapping: Partial<TransClassification>,
  source: string = 'investone'
): Promise<{ message: string }> {
  return fetchJSON(`/api/reference/trans-classification/${encodeURIComponent(keyTransCode)}?source=${encodeURIComponent(source)}`, {
    method: 'PUT',
    body: JSON.stringify(mapping),
  });
}

export async function deleteTransClassification(keyTransCode: string, source: string = 'investone'): Promise<{ message: string }> {
  return fetchJSON(`/api/reference/trans-classification/${encodeURIComponent(keyTransCode)}?source=${encodeURIComponent(source)}`, {
    method: 'DELETE',
  });
}

// ── Ledger Category Derivation ──────────────────────────────

export async function fetchLedgerCategoryDerivations(type?: string): Promise<LedgerCategoryDerivation[]> {
  const params = type ? `?type=${encodeURIComponent(type)}` : '';
  return fetchJSON<LedgerCategoryDerivation[]>(`/api/reference/ledger-category-derivation${params}`);
}

export async function createLedgerCategoryDerivation(mapping: LedgerCategoryDerivation): Promise<{ message: string; mapping: LedgerCategoryDerivation }> {
  return fetchJSON('/api/reference/ledger-category-derivation', {
    method: 'POST',
    body: JSON.stringify(mapping),
  });
}

export async function updateLedgerCategoryDerivation(
  key: string,
  mapping: Partial<LedgerCategoryDerivation>,
  type: string = 'transaction'
): Promise<{ message: string }> {
  return fetchJSON(`/api/reference/ledger-category-derivation/${encodeURIComponent(key)}?type=${encodeURIComponent(type)}`, {
    method: 'PUT',
    body: JSON.stringify(mapping),
  });
}

export async function deleteLedgerCategoryDerivation(key: string, type: string = 'transaction'): Promise<{ message: string }> {
  return fetchJSON(`/api/reference/ledger-category-derivation/${encodeURIComponent(key)}?type=${encodeURIComponent(type)}`, {
    method: 'DELETE',
  });
}

// ══════════════════════════════════════════════════════════════
// BREAK RESOLUTION & DASHBOARDING ENDPOINTS
// ══════════════════════════════════════════════════════════════

// ── Known Differences ────────────────────────────────────────

export async function fetchKnownDifferences(eventId: string, active?: boolean) {
  const params = active !== undefined ? `?active=${active}` : '';
  return fetchJSON<any[]>(`/api/events/${eventId}/known-differences${params}`);
}

export async function createKnownDifference(eventId: string, data: Record<string, unknown>) {
  return fetchJSON<any>(`/api/events/${eventId}/known-differences`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateKnownDifference(eventId: string, reference: string, data: Record<string, unknown>) {
  return fetchJSON<any>(`/api/events/${eventId}/known-differences/${encodeURIComponent(reference)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteKnownDifference(eventId: string, reference: string) {
  return fetchJSON<any>(`/api/events/${eventId}/known-differences/${encodeURIComponent(reference)}`, {
    method: 'DELETE',
  });
}

// ── Break Resolution ─────────────────────────────────────────

export async function updateBreakCategory(entityRef: string, data: { eventId: string; breakCategory: string; changedBy: string }) {
  return fetchJSON<any>(`/api/breaks/${encodeURIComponent(entityRef)}/category`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updateBreakTeam(entityRef: string, data: { eventId: string; assignedTeam: string; assignedOwner?: string; changedBy: string }) {
  return fetchJSON<any>(`/api/breaks/${encodeURIComponent(entityRef)}/team`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function fetchBreakSummary(eventId: string, valuationDt?: string) {
  const params = valuationDt ? `?valuationDt=${valuationDt}` : '';
  return fetchJSON<Record<string, { count: number; totalAmount: number }>>(`/api/events/${eventId}/break-summary${params}`);
}

export async function updateReviewStatus(eventId: string, account: string, data: { reviewStatus: string; valuationDt: string; changedBy: string }) {
  return fetchJSON<any>(`/api/events/${eventId}/funds/${account}/review-status`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ── Reviewer Allocations ────────────────────────────────────

export async function fetchAllocations(eventId: string, valuationDt?: string) {
  const params = valuationDt ? `/${valuationDt}` : '';
  return fetchJSON<any[]>(`/api/events/${eventId}/allocations${params}`);
}

export async function updateAllocations(eventId: string, data: { allocations: any[]; changedBy: string }) {
  return fetchJSON<any>(`/api/events/${eventId}/allocations`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function copyAllocations(eventId: string, data: { fromDate: string; toDate: string; changedBy: string }) {
  return fetchJSON<any>(`/api/events/${eventId}/allocations/copy`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchReviewers() {
  return fetchJSON<any[]>('/api/users/reviewers');
}

// ── NAV Views ────────────────────────────────────────────────

export async function fetchShareClassDashboard(eventId: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/share-class-dashboard?valuationDt=${valuationDt}`);
}

export async function fetchShareClasses(eventId: string, account: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/funds/${account}/share-classes?valuationDt=${valuationDt}`);
}

export async function fetchScorecard(eventId: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/scorecard?valuationDt=${valuationDt}`);
}

export async function fetchRagTracker(eventId: string) {
  return fetchJSON<any>(`/api/events/${eventId}/rag-tracker`);
}

export async function fetchRagThresholds(eventId: string) {
  return fetchJSON<any>(`/api/events/${eventId}/rag-thresholds`);
}

export async function updateRagThresholds(eventId: string, thresholds: { greenMaxBP: number; amberMaxBP: number }) {
  return fetchJSON<any>(`/api/events/${eventId}/rag-thresholds`, {
    method: 'PUT',
    body: JSON.stringify(thresholds),
  });
}

export async function updateScorecardOverrides(eventId: string, data: Record<string, unknown>) {
  return fetchJSON<any>(`/api/events/${eventId}/scorecard/overrides`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ── Position Sub-Views ──────────────────────────────────────

export async function fetchShareBreaks(eventId: string, account: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/funds/${account}/positions/share-breaks?valuationDt=${valuationDt}`);
}

export async function fetchAllShareBreaks(eventId: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/positions/share-breaks?valuationDt=${valuationDt}`);
}

export async function fetchPriceBreaks(eventId: string, account: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/funds/${account}/positions/price-breaks?valuationDt=${valuationDt}`);
}

export async function fetchAllPriceBreaks(eventId: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/positions/price-breaks?valuationDt=${valuationDt}`);
}

export async function fetchPositionTaxLots(eventId: string, account: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/funds/${account}/positions/tax-lots?valuationDt=${valuationDt}`);
}

// ── Income Views ─────────────────────────────────────────────

export async function fetchDividends(eventId: string, account: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/funds/${account}/income/dividends?valuationDt=${valuationDt}`);
}

export async function fetchDividendDetail(eventId: string, account: string, assetId: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/funds/${account}/income/dividends/${encodeURIComponent(assetId)}/detail?valuationDt=${valuationDt}`);
}

export async function fetchAllDividends(eventId: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/income/dividends?valuationDt=${valuationDt}`);
}

export async function fetchDividendFundSummary(eventId: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/income/dividends/fund-summary?valuationDt=${valuationDt}`);
}

export async function fetchIncomeTieBack(eventId: string, account: string, valuationDt: string) {
  return fetchJSON<{ totalNetIncomeDiff: number; tbSubClassBalance: number; tieBackPass: boolean }>(
    `/api/events/${eventId}/funds/${account}/income/tie-back?valuationDt=${valuationDt}`
  );
}

export async function fetchFixedIncomeIncome(eventId: string, account: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/funds/${account}/income/fixed-income?valuationDt=${valuationDt}`);
}

export async function fetchAllFixedIncomeIncome(eventId: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/income/fixed-income?valuationDt=${valuationDt}`);
}

// ── Derivatives Views ────────────────────────────────────────

export async function fetchForwards(eventId: string, account: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/funds/${account}/derivatives/forwards?valuationDt=${valuationDt}`);
}

export async function fetchAllForwards(eventId: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/derivatives/forwards?valuationDt=${valuationDt}`);
}

export async function fetchFutures(eventId: string, account: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/funds/${account}/derivatives/futures?valuationDt=${valuationDt}`);
}

export async function fetchAllFutures(eventId: string, valuationDt: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/derivatives/futures?valuationDt=${valuationDt}`);
}

// ── Commentary ───────────────────────────────────────────────

export async function fetchCommentary(eventId: string, account: string) {
  return fetchJSON<any[]>(`/api/events/${eventId}/funds/${account}/commentary`);
}

export async function createCommentary(eventId: string, account: string, data: Record<string, unknown>) {
  return fetchJSON<any>(`/api/events/${eventId}/funds/${account}/commentary`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCommentary(eventId: string, account: string, commentId: string, data: Record<string, unknown>) {
  return fetchJSON<any>(`/api/events/${eventId}/funds/${account}/commentary/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCommentary(eventId: string, account: string, commentId: string) {
  return fetchJSON<any>(`/api/events/${eventId}/funds/${account}/commentary/${commentId}`, {
    method: 'DELETE',
  });
}

export async function fetchCommentaryRollup(eventId: string, account: string, level?: string) {
  const params = level ? `?level=${level}` : '';
  return fetchJSON<any[]>(`/api/events/${eventId}/funds/${account}/commentary/rollup${params}`);
}

// ── Notifications ────────────────────────────────────────────

export async function fetchNotifications(isRead?: boolean) {
  const params = isRead !== undefined ? `?isRead=${isRead}` : '';
  return fetchJSON<any[]>(`/api/notifications${params}`);
}

export async function markNotificationRead(id: string) {
  return fetchJSON<any>(`/api/notifications/${id}/read`, { method: 'PUT' });
}

export async function fetchNotificationCount() {
  return fetchJSON<{ unread: number }>('/api/notifications/count');
}

// ── Export & Audit ───────────────────────────────────────────

export async function exportToExcel(data: { viewType: string; eventId: string; filters?: Record<string, unknown> }) {
  const response = await fetch(`${API_BASE}/api/export/excel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`Export failed: ${response.status}`);
  return response.blob();
}

export async function fetchAuditLogs(eventId: string, params?: { action?: string; entity?: string; from?: string; to?: string; user?: string; limit?: number; offset?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.action) searchParams.set('action', params.action);
  if (params?.entity) searchParams.set('entity', params.entity);
  if (params?.from) searchParams.set('from', params.from);
  if (params?.to) searchParams.set('to', params.to);
  if (params?.user) searchParams.set('user', params.user);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const qs = searchParams.toString();
  return fetchJSON<{ logs: any[]; total: number }>(`/api/events/${eventId}/audit${qs ? `?${qs}` : ''}`);
}

// ── Health Check ────────────────────────────────────────────

export async function healthCheck() {
  return fetchJSON<{ status: string; timestamp: string }>('/api/health');
}

// ══════════════════════════════════════════════════════════════
// DATA MAPPING UTILITY ENDPOINTS
// ══════════════════════════════════════════════════════════════

// ── Mapping CRUD ────────────────────────────────────────────

export async function fetchMappings(params?: { status?: string; tags?: string; search?: string; skip?: number; limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.tags) sp.set('tags', params.tags);
  if (params?.search) sp.set('search', params.search);
  if (params?.skip) sp.set('skip', String(params.skip));
  if (params?.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return fetchJSON<{ items: MappingDefinition[]; total: number }>(`/api/v1/mappings${qs ? `?${qs}` : ''}`);
}

export async function fetchMapping(mappingId: string) {
  return fetchJSON<MappingDefinition>(`/api/v1/mappings/${mappingId}`);
}

export async function createMapping(data: {
  name: string;
  description?: string;
  tags?: string[];
  source: SourceConfig;
  target: TargetConfig;
  fieldMappings: FieldMapping[];
  filters?: FilterExpression[];
  errorHandling?: ErrorHandling;
}) {
  return fetchJSON<MappingDefinition>('/api/v1/mappings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMapping(mappingId: string, data: Record<string, unknown>) {
  return fetchJSON<MappingDefinition>(`/api/v1/mappings/${mappingId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteMapping(mappingId: string) {
  return fetchJSON<void>(`/api/v1/mappings/${mappingId}`, { method: 'DELETE' });
}

export async function cloneMapping(mappingId: string) {
  return fetchJSON<MappingDefinition>(`/api/v1/mappings/${mappingId}/clone`, { method: 'POST' });
}

export async function approveMapping(mappingId: string, reviewer: string) {
  return fetchJSON<{ mappingId: string; status: string }>(`/api/v1/mappings/${mappingId}/approve?reviewer=${encodeURIComponent(reviewer)}`, { method: 'PUT' });
}

// ── Mapping Validation & Preview ────────────────────────────

export async function validateMapping(data: {
  name: string;
  source: SourceConfig;
  target: TargetConfig;
  fieldMappings: FieldMapping[];
  filters?: FilterExpression[];
  errorHandling?: ErrorHandling;
}) {
  return fetchJSON<MappingValidateResponse>('/api/v1/mappings/validate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function previewMapping(data: {
  mapping: {
    name: string;
    source: SourceConfig;
    target: TargetConfig;
    fieldMappings: FieldMapping[];
    filters?: FilterExpression[];
    errorHandling?: ErrorHandling;
  };
  sampleData: Record<string, unknown>[];
  params?: Record<string, unknown>;
}) {
  return fetchJSON<PreviewResponse>('/api/v1/mappings/preview', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function inferSchema(file: File): Promise<SchemaInferResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/api/v1/mappings/infer-schema`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error(`Schema inference failed: ${response.status}`);
  return response.json();
}

// ── Read Sample Rows ────────────────────────────────────────

export async function readSampleRows(file: File, rows = 10): Promise<{ rows: Record<string, unknown>[]; totalRows: number; format: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/api/v1/mappings/read-sample?rows=${rows}`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error(`Read sample failed: ${response.status}`);
  return response.json();
}

// ── AI Auto-Generate Mapping ────────────────────────────────

export interface AiGenerateResult {
  name: string;
  description: string;
  source: SourceConfig;
  target: TargetConfig;
  fieldMappings: FieldMapping[];
  aiResult: {
    mappings: AiFieldMapping[];
    generatedAt: string;
  };
  sourceStats: {
    totalRows: number;
    sampleRows: Record<string, unknown>[];
    fieldsInferred: number;
  };
  targetStats: {
    fieldsInferred: number;
    sampleRows: Record<string, unknown>[];
  };
}

export async function aiGenerateMapping(
  sourceFile: File,
  targetFile?: File,
  targetSchemaJson?: string,
  mappingName?: string,
  lookupTables?: string,
): Promise<AiGenerateResult> {
  const formData = new FormData();
  formData.append('source_file', sourceFile);
  if (targetFile) formData.append('target_file', targetFile);
  if (targetSchemaJson) formData.append('target_schema_json', targetSchemaJson);
  if (mappingName) formData.append('mapping_name', mappingName);
  if (lookupTables) formData.append('lookup_tables', lookupTables);
  const response = await fetch(`${API_BASE}/api/v1/mappings/ai-generate`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI generation failed: ${response.status} — ${text}`);
  }
  return response.json();
}

// ── Mapping Execution ───────────────────────────────────────

export async function executeMapping(mappingId: string, file: File, params?: Record<string, unknown>) {
  const formData = new FormData();
  formData.append('file', file);
  if (params) formData.append('params', JSON.stringify(params));
  const response = await fetch(`${API_BASE}/api/v1/mappings/${mappingId}/execute`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error(`Execution failed: ${response.status}`);
  return response.json();
}

export async function executeMappingAsync(mappingId: string, file: File, params?: Record<string, unknown>) {
  const formData = new FormData();
  formData.append('file', file);
  if (params) formData.append('params', JSON.stringify(params));
  const response = await fetch(`${API_BASE}/api/v1/mappings/${mappingId}/execute-async`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error(`Async execution failed: ${response.status}`);
  return response.json();
}

// ── Job Endpoints ───────────────────────────────────────────

export async function fetchMappingJob(jobId: string) {
  return fetchJSON<MappingJob>(`/api/v1/jobs/${jobId}`);
}

export async function fetchJobErrors(jobId: string, skip = 0, limit = 100) {
  return fetchJSON<{ errors: unknown[]; total: number }>(`/api/v1/jobs/${jobId}/errors?skip=${skip}&limit=${limit}`);
}

export async function downloadJobOutput(jobId: string) {
  const response = await fetch(`${API_BASE}/api/v1/jobs/${jobId}/output`);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  return response.blob();
}

export async function cancelJob(jobId: string) {
  return fetchJSON<{ jobId: string; status: string }>(`/api/v1/jobs/${jobId}`, { method: 'DELETE' });
}

// ── CEL Utility Endpoints ───────────────────────────────────

export async function validateCel(expression: string, sourceSchema?: FieldSchema[]) {
  return fetchJSON<{ valid: boolean; error?: string }>('/api/v1/cel/validate', {
    method: 'POST',
    body: JSON.stringify({ expression, sourceSchema }),
  });
}

export async function evaluateCel(expression: string, data: Record<string, unknown>, params?: Record<string, unknown>) {
  return fetchJSON<{ result: unknown; resultType: string; error?: string }>('/api/v1/cel/evaluate', {
    method: 'POST',
    body: JSON.stringify({ expression, data, params }),
  });
}

export async function fetchCelFunctions() {
  return fetchJSON<CelFunctionDoc[]>('/api/v1/cel/functions');
}

export async function suggestCel(data: {
  targetField: string;
  targetType: string;
  sourceSchema: FieldSchema[];
  sampleData?: Record<string, unknown>[];
  existingMappings?: FieldMapping[];
  lookupTables?: string[];
}) {
  return fetchJSON<AiFieldMapping>('/api/v1/cel/suggest', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Lookup Table Endpoints ──────────────────────────────────

export async function fetchLookupTables() {
  return fetchJSON<LookupTableMeta[]>('/api/v1/lookups');
}

export async function uploadLookupTable(file: File, name: string, keyField: string, description?: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  formData.append('keyField', keyField);
  if (description) formData.append('description', description);
  const response = await fetch(`${API_BASE}/api/v1/lookups`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  return response.json();
}

export async function deleteLookupTable(tableId: string) {
  return fetchJSON<void>(`/api/v1/lookups/${tableId}`, { method: 'DELETE' });
}
