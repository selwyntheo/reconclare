// ══════════════════════════════════════════════════════════════
// Data Mapping Utility — Type Definitions
// ══════════════════════════════════════════════════════════════

export type FileFormat = 'CSV' | 'TSV' | 'JSON' | 'EXCEL' | 'XML' | 'FIXED_WIDTH' | 'PARQUET' | 'YAML';
export type FieldType = 'STRING' | 'INT' | 'DOUBLE' | 'DECIMAL' | 'BOOL' | 'DATE' | 'DATETIME' | 'TIMESTAMP' | 'LIST' | 'MAP';
export type MappingStatus = 'DRAFT' | 'VALIDATED' | 'APPROVED' | 'ACTIVE' | 'ARCHIVED';
export type ErrorStrategy = 'FAIL_FAST' | 'SKIP_AND_LOG' | 'USE_DEFAULT' | 'COLLECT_ERRORS';
export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface FieldSchema {
  name: string;
  type: FieldType;
  required?: boolean;
  description?: string;
}

export interface SourceOptions {
  delimiter?: string;
  quoteChar?: string;
  hasHeader?: boolean;
  skipRows?: number;
  nullValues?: string[];
  dateFormats?: string[];
  trimValues?: boolean;
  encoding?: string;
  rootPath?: string;
  sheetName?: string;
  sheetIndex?: number;
  headerRow?: number;
  dataStartRow?: number;
}

export interface TargetOptions {
  prettyPrint?: boolean;
  arrayWrapper?: boolean;
  delimiter?: string;
  encoding?: string;
  sheetName?: string;
}

export interface SourceConfig {
  format: FileFormat;
  encoding?: string;
  options: SourceOptions;
  schema: FieldSchema[];
}

export interface TargetConfig {
  format: FileFormat;
  encoding?: string;
  options: TargetOptions;
  schema: FieldSchema[];
}

export interface FieldMapping {
  targetField: string;
  cel: string;
  description?: string;
}

export interface FilterExpression {
  cel: string;
  description?: string;
}

export interface ErrorHandling {
  onFieldError: ErrorStrategy;
  onRowError: ErrorStrategy;
  maxErrorCount: number;
  defaults: Record<string, unknown>;
}

export interface MappingDefinition {
  mappingId: string;
  version: string;
  name: string;
  description?: string;
  createdBy?: string;
  reviewedBy?: string;
  status: MappingStatus;
  tags: string[];
  source: SourceConfig;
  target: TargetConfig;
  fieldMappings: FieldMapping[];
  filters: FilterExpression[];
  errorHandling: ErrorHandling;
  createdAt?: string;
  updatedAt?: string;
  approvedAt?: string;
}

export interface MappingJob {
  jobId: string;
  mappingId: string;
  status: JobStatus;
  progress: {
    rowsProcessed: number;
    totalRows?: number;
    rowsSkipped: number;
    errorCount: number;
  };
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  outputFilePath?: string;
}

export interface FieldValidationResult {
  targetField: string;
  cel: string;
  valid: boolean;
  error?: string;
  inferredType?: string;
}

export interface MappingValidateResponse {
  valid: boolean;
  fieldResults: FieldValidationResult[];
  filterResults: FieldValidationResult[];
}

export interface PreviewRow {
  sourceRow: Record<string, unknown>;
  targetRow?: Record<string, unknown>;
  errors: string[];
  filtered: boolean;
}

export interface PreviewResponse {
  rows: PreviewRow[];
  totalRows: number;
  mappedRows: number;
  filteredRows: number;
  errorRows: number;
}

export interface SchemaInferField {
  name: string;
  inferredType: FieldType;
  sampleValues: unknown[];
  nullCount: number;
  distinctCount: number;
}

export interface SchemaInferResponse {
  format: FileFormat;
  encoding: string;
  fields: SchemaInferField[];
  options: Record<string, unknown>;
  totalRows: number;
}

export interface CelFunctionDoc {
  name: string;
  signature: string;
  description: string;
  example?: string;
  category: string;
}

export interface AiFieldMapping {
  targetField: string;
  cel: string;
  confidence: Confidence;
  explanation: string;
  assumptions: string[];
  validated: boolean;
}

export interface AiGenerationResult {
  mappings: AiFieldMapping[];
  generatedAt: string;
}

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

export interface LookupTableMeta {
  tableId: string;
  name: string;
  description?: string;
  keyField: string;
  rowCount: number;
  uploadedAt?: string;
  uploadedBy?: string;
}
