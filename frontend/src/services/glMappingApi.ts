/**
 * GL Account Mapping API Service
 * Provides API functions for managing GL account mappings between Incumbent and Eagle.
 */

import {
  IncumbentGLAccount,
  EagleGLAccount,
  GLAccountMapping,
  CreateMappingRequest,
  UpdateMappingRequest,
  BulkMappingRequest,
  BulkDeleteRequest,
  BulkCreateResponse,
  BulkDeleteResponse,
  UnmappedAccountsResponse,
  MappingValidationResult,
} from '../types/glMapping';

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

// ── Reference Data ───────────────────────────────────────────

export async function fetchIncumbentAccounts(
  provider?: string
): Promise<IncumbentGLAccount[]> {
  const params = provider ? `?provider=${encodeURIComponent(provider)}` : '';
  return fetchJSON<IncumbentGLAccount[]>(
    `/api/reference/incumbent-gl-accounts${params}`
  );
}

export async function fetchEagleAccounts(
  ledgerSection?: string
): Promise<EagleGLAccount[]> {
  const params = ledgerSection
    ? `?ledger_section=${encodeURIComponent(ledgerSection)}`
    : '';
  return fetchJSON<EagleGLAccount[]>(
    `/api/reference/eagle-gl-accounts${params}`
  );
}

// ── Mappings CRUD ────────────────────────────────────────────

export async function fetchGLMappings(
  eventId: string,
  options?: { status?: string; sourceProvider?: string }
): Promise<GLAccountMapping[]> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.sourceProvider) params.set('source_provider', options.sourceProvider);
  const qs = params.toString();
  return fetchJSON<GLAccountMapping[]>(
    `/api/events/${eventId}/gl-mappings${qs ? `?${qs}` : ''}`
  );
}

export async function createGLMapping(
  eventId: string,
  request: CreateMappingRequest
): Promise<GLAccountMapping> {
  return fetchJSON<GLAccountMapping>(`/api/events/${eventId}/gl-mappings`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function updateGLMapping(
  mappingId: string,
  request: UpdateMappingRequest
): Promise<GLAccountMapping> {
  return fetchJSON<GLAccountMapping>(`/api/gl-mappings/${mappingId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export async function deleteGLMapping(
  mappingId: string
): Promise<{ status: string; mappingId: string }> {
  return fetchJSON(`/api/gl-mappings/${mappingId}`, {
    method: 'DELETE',
  });
}

// ── Bulk Operations ──────────────────────────────────────────

export async function createBulkMappings(
  eventId: string,
  request: BulkMappingRequest
): Promise<BulkCreateResponse> {
  return fetchJSON<BulkCreateResponse>(
    `/api/events/${eventId}/gl-mappings/bulk`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );
}

export async function deleteBulkMappings(
  eventId: string,
  request: BulkDeleteRequest
): Promise<BulkDeleteResponse> {
  return fetchJSON<BulkDeleteResponse>(
    `/api/events/${eventId}/gl-mappings/bulk`,
    {
      method: 'DELETE',
      body: JSON.stringify(request),
    }
  );
}

// ── Validation & Unmapped ────────────────────────────────────

export async function fetchUnmappedAccounts(
  eventId: string,
  sourceProvider?: string
): Promise<UnmappedAccountsResponse> {
  const params = sourceProvider
    ? `?source_provider=${encodeURIComponent(sourceProvider)}`
    : '';
  return fetchJSON<UnmappedAccountsResponse>(
    `/api/events/${eventId}/gl-mappings/unmapped${params}`
  );
}

export async function validateMappings(
  eventId: string
): Promise<MappingValidationResult> {
  return fetchJSON<MappingValidationResult>(
    `/api/events/${eventId}/gl-mappings/validate`,
    {
      method: 'POST',
    }
  );
}
