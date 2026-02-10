// ══════════════════════════════════════════════════════════════
// GL Account Mapping Types (Incumbent to Eagle)
// ══════════════════════════════════════════════════════════════

// ── Enums ────────────────────────────────────────────────────

export type MappingType = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE';

export type MappingStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type LedgerSection = 'ASSETS' | 'LIABILITIES' | 'EQUITY' | 'INCOME' | 'EXPENSE';

// ── Reference Data ───────────────────────────────────────────

export interface IncumbentGLAccount {
  glAccountNumber: string;
  glAccountDescription: string;
  ledgerSection: LedgerSection;
  provider: string;
}

export interface EagleGLAccount {
  glAccountNumber: string;
  glAccountDescription: string;
  ledgerSection: LedgerSection;
  category?: string;
}

// ── Mapping Document ─────────────────────────────────────────

export interface GLAccountMapping {
  mappingId: string;
  eventId: string;
  sourceProvider: string;
  sourceGlAccountNumber: string;
  sourceGlAccountDescription: string;
  sourceLedgerSection: LedgerSection;
  targetGlAccountNumber: string;
  targetGlAccountDescription: string;
  targetLedgerSection: LedgerSection;
  mappingType: MappingType;
  splitWeight: number;
  groupId?: string;
  effectiveDate?: string;
  status: MappingStatus;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Request Types ────────────────────────────────────────────

export interface CreateMappingRequest {
  eventId: string;
  sourceProvider: string;
  sourceGlAccountNumber: string;
  targetGlAccountNumber: string;
  mappingType?: MappingType;
  splitWeight?: number;
  groupId?: string;
  effectiveDate?: string;
  createdBy?: string;
}

export interface UpdateMappingRequest {
  mappingType?: MappingType;
  splitWeight?: number;
  groupId?: string;
  effectiveDate?: string;
  status?: MappingStatus;
}

export interface BulkMappingRequest {
  mappings: CreateMappingRequest[];
}

export interface BulkDeleteRequest {
  mappingIds: string[];
}

// ── Response Types ───────────────────────────────────────────

export interface BulkCreateResponse {
  created: number;
  errors: Array<{ index: number; error: string }>;
  mappings: GLAccountMapping[];
}

export interface BulkDeleteResponse {
  deleted: number;
  requested: number;
}

export interface UnmappedAccountsResponse {
  unmappedIncumbent: IncumbentGLAccount[];
  unmappedEagle: EagleGLAccount[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    type: string;
    sourceGlAccountNumber?: string;
    message: string;
    mappingIds?: string[];
  }>;
  warnings: Array<{
    type: string;
    mappingId?: string;
    message: string;
  }>;
  mappingCount: number;
}

// ── UI State Types ───────────────────────────────────────────

export type MappingChangeType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface MappingChange {
  id: string;
  type: MappingChangeType;
  mapping: GLAccountMapping | CreateMappingRequest;
  timestamp: number;
}

export interface AccountWithMappingStatus {
  account: IncumbentGLAccount | EagleGLAccount;
  isMapped: boolean;
  mappingIds: string[];
  mappingType?: MappingType;
}

export interface MappingGroup {
  groupId: string;
  mappingType: MappingType;
  sourceAccounts: string[];
  targetAccounts: string[];
  mappings: GLAccountMapping[];
  totalWeight: number;
}

// ── Drag and Drop Types ──────────────────────────────────────

export type DragItemType = 'INCUMBENT_ACCOUNT' | 'EAGLE_ACCOUNT';

export interface DragItem {
  type: DragItemType;
  accountNumber: string;
  account: IncumbentGLAccount | EagleGLAccount;
}

export interface DropResult {
  sourceAccountNumber: string;
  targetAccountNumber: string;
  sourceType: DragItemType;
}

// ── Connection Line Types ────────────────────────────────────

export interface ConnectionLine {
  id: string;
  mappingId: string;
  sourceAccountNumber: string;
  targetAccountNumber: string;
  mappingType: MappingType;
  splitWeight: number;
  groupId?: string;
  isSelected: boolean;
  sourcePosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
}

// ── Selection State ──────────────────────────────────────────

export interface SelectionState {
  selectedIncumbentAccounts: string[];
  selectedEagleAccounts: string[];
  selectedMappingId: string | null;
}

// ── Filter State ─────────────────────────────────────────────

export interface FilterState {
  incumbentSearch: string;
  eagleSearch: string;
  incumbentSection: LedgerSection | 'ALL';
  eagleSection: LedgerSection | 'ALL';
  showMappedOnly: boolean;
  showUnmappedOnly: boolean;
}

// ── Sidebar Details ──────────────────────────────────────────

export interface MappingSidebarDetails {
  mapping: GLAccountMapping;
  relatedMappings: GLAccountMapping[];
  canEditWeight: boolean;
}

// ── Undo/Redo State ──────────────────────────────────────────

export interface UndoRedoState {
  past: MappingChange[][];
  present: MappingChange[];
  future: MappingChange[][];
}
