"""
Pydantic models for the Data Mapping Utility.
"""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────

class FileFormat(str, Enum):
    CSV = "CSV"
    TSV = "TSV"
    JSON = "JSON"
    EXCEL = "EXCEL"
    XML = "XML"
    FIXED_WIDTH = "FIXED_WIDTH"
    PARQUET = "PARQUET"
    YAML = "YAML"


class FieldType(str, Enum):
    STRING = "STRING"
    INT = "INT"
    DOUBLE = "DOUBLE"
    DECIMAL = "DECIMAL"
    BOOL = "BOOL"
    DATE = "DATE"
    DATETIME = "DATETIME"
    TIMESTAMP = "TIMESTAMP"
    LIST = "LIST"
    MAP = "MAP"


class MappingStatus(str, Enum):
    DRAFT = "DRAFT"
    VALIDATED = "VALIDATED"
    APPROVED = "APPROVED"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class ErrorStrategy(str, Enum):
    FAIL_FAST = "FAIL_FAST"
    SKIP_AND_LOG = "SKIP_AND_LOG"
    USE_DEFAULT = "USE_DEFAULT"
    COLLECT_ERRORS = "COLLECT_ERRORS"


class JobStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class Confidence(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class AuditEventType(str, Enum):
    MAPPING_CREATED = "MAPPING_CREATED"
    MAPPING_MODIFIED = "MAPPING_MODIFIED"
    MAPPING_APPROVED = "MAPPING_APPROVED"
    MAPPING_EXECUTED = "MAPPING_EXECUTED"
    MAPPING_DELETED = "MAPPING_DELETED"


# ── Source & Target Config ─────────────────────────────────────────

class FieldSchema(BaseModel):
    name: str
    type: FieldType = FieldType.STRING
    required: bool = False
    description: Optional[str] = None


class SourceOptions(BaseModel):
    delimiter: str = ","
    quoteChar: str = '"'
    escapeChar: str = "\\"
    hasHeader: bool = True
    skipRows: int = 0
    commentChar: Optional[str] = None
    nullValues: List[str] = Field(default_factory=lambda: [""])
    dateFormats: List[str] = Field(default_factory=lambda: ["yyyy-MM-dd"])
    trimValues: bool = True
    encoding: str = "UTF-8"
    # JSON-specific
    rootPath: str = "$"
    # Excel-specific
    sheetName: Optional[str] = None
    sheetIndex: int = 0
    headerRow: int = 0
    dataStartRow: int = 1


class TargetOptions(BaseModel):
    prettyPrint: bool = False
    arrayWrapper: bool = True
    delimiter: str = ","
    encoding: str = "UTF-8"
    # Excel-specific
    sheetName: str = "Sheet1"


class SourceConfig(BaseModel):
    format: FileFormat
    encoding: str = "UTF-8"
    options: SourceOptions = Field(default_factory=SourceOptions)
    schema_fields: List[FieldSchema] = Field(default_factory=list, alias="schema")

    class Config:
        populate_by_name = True


class TargetConfig(BaseModel):
    format: FileFormat
    encoding: str = "UTF-8"
    options: TargetOptions = Field(default_factory=TargetOptions)
    schema_fields: List[FieldSchema] = Field(default_factory=list, alias="schema")

    class Config:
        populate_by_name = True


# ── Field Mappings & Filters ──────────────────────────────────────

class FieldMapping(BaseModel):
    targetField: str
    cel: str
    description: Optional[str] = None


class FilterExpression(BaseModel):
    cel: str
    description: Optional[str] = None


class ErrorHandling(BaseModel):
    onFieldError: ErrorStrategy = ErrorStrategy.SKIP_AND_LOG
    onRowError: ErrorStrategy = ErrorStrategy.SKIP_AND_LOG
    maxErrorCount: int = 1000
    defaults: Dict[str, Any] = Field(default_factory=dict)


# ── Mapping Definition ────────────────────────────────────────────

class MappingDefinition(BaseModel):
    mappingId: Optional[str] = None
    version: str = "1.0.0"
    name: str
    description: Optional[str] = None
    createdBy: Optional[str] = None
    reviewedBy: Optional[str] = None
    status: MappingStatus = MappingStatus.DRAFT
    tags: List[str] = Field(default_factory=list)
    source: SourceConfig
    target: TargetConfig
    fieldMappings: List[FieldMapping]
    filters: List[FilterExpression] = Field(default_factory=list)
    errorHandling: ErrorHandling = Field(default_factory=ErrorHandling)
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    approvedAt: Optional[datetime] = None


# ── Job Models ────────────────────────────────────────────────────

class RowError(BaseModel):
    rowIndex: int
    sourceRow: Optional[Dict[str, Any]] = None
    targetField: Optional[str] = None
    celExpression: Optional[str] = None
    errorType: str
    errorMessage: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class JobProgress(BaseModel):
    rowsProcessed: int = 0
    totalRows: Optional[int] = None
    rowsSkipped: int = 0
    errorCount: int = 0


class MappingJob(BaseModel):
    jobId: Optional[str] = None
    mappingId: str
    status: JobStatus = JobStatus.PENDING
    progress: JobProgress = Field(default_factory=JobProgress)
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    inputFilePath: Optional[str] = None
    outputFilePath: Optional[str] = None
    errors: List[RowError] = Field(default_factory=list)
    executionParams: Dict[str, Any] = Field(default_factory=dict)
    durationMs: Optional[int] = None


# ── Lookup Table Models ───────────────────────────────────────────

class LookupTableMeta(BaseModel):
    tableId: Optional[str] = None
    name: str
    description: Optional[str] = None
    keyField: str
    rowCount: int = 0
    uploadedAt: Optional[datetime] = None
    uploadedBy: Optional[str] = None


class LookupTable(BaseModel):
    tableId: Optional[str] = None
    name: str
    description: Optional[str] = None
    keyField: str
    data: List[Dict[str, Any]] = Field(default_factory=list)
    rowCount: int = 0
    uploadedAt: Optional[datetime] = None
    uploadedBy: Optional[str] = None


# ── API Request/Response Models ───────────────────────────────────

class MappingCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    source: SourceConfig
    target: TargetConfig
    fieldMappings: List[FieldMapping]
    filters: List[FilterExpression] = Field(default_factory=list)
    errorHandling: ErrorHandling = Field(default_factory=ErrorHandling)


class FieldValidationResult(BaseModel):
    targetField: str
    cel: str
    valid: bool
    error: Optional[str] = None
    inferredType: Optional[str] = None


class MappingValidateResponse(BaseModel):
    valid: bool
    fieldResults: List[FieldValidationResult]
    filterResults: List[FieldValidationResult] = Field(default_factory=list)


class PreviewRequest(BaseModel):
    mapping: MappingCreateRequest
    sampleData: List[Dict[str, Any]]
    params: Dict[str, Any] = Field(default_factory=dict)


class PreviewRow(BaseModel):
    sourceRow: Dict[str, Any]
    targetRow: Optional[Dict[str, Any]] = None
    errors: List[str] = Field(default_factory=list)
    filtered: bool = False


class PreviewResponse(BaseModel):
    rows: List[PreviewRow]
    totalRows: int
    mappedRows: int
    filteredRows: int
    errorRows: int


class SchemaInferField(BaseModel):
    name: str
    inferredType: FieldType
    sampleValues: List[Any] = Field(default_factory=list)
    nullCount: int = 0
    distinctCount: int = 0


class SchemaInferResponse(BaseModel):
    format: FileFormat
    encoding: str = "UTF-8"
    fields: List[SchemaInferField]
    options: Dict[str, Any] = Field(default_factory=dict)
    totalRows: int = 0


class CelValidateRequest(BaseModel):
    expression: str
    sourceSchema: List[FieldSchema] = Field(default_factory=list)


class CelValidateResponse(BaseModel):
    valid: bool
    error: Optional[str] = None
    inferredType: Optional[str] = None


class CelEvaluateRequest(BaseModel):
    expression: str
    data: Dict[str, Any]
    params: Dict[str, Any] = Field(default_factory=dict)


class CelEvaluateResponse(BaseModel):
    result: Any
    resultType: str
    error: Optional[str] = None


class CelSuggestRequest(BaseModel):
    targetField: str
    targetType: FieldType
    sourceSchema: List[FieldSchema]
    sampleData: List[Dict[str, Any]] = Field(default_factory=list)
    existingMappings: List[FieldMapping] = Field(default_factory=list)
    lookupTables: List[str] = Field(default_factory=list)


class AiFieldMapping(BaseModel):
    targetField: str
    cel: str
    confidence: Confidence
    explanation: str
    assumptions: List[str] = Field(default_factory=list)
    validated: bool = False


class AiGenerationResult(BaseModel):
    mappings: List[AiFieldMapping]
    generatedAt: datetime = Field(default_factory=datetime.utcnow)


class CelFunctionDoc(BaseModel):
    name: str
    signature: str
    description: str
    example: Optional[str] = None
    category: str


class ExecutionSummary(BaseModel):
    jobId: str
    mappingId: str
    status: JobStatus
    rowsProcessed: int
    rowsSkipped: int
    errorCount: int
    durationMs: int
    outputPath: Optional[str] = None


# ── Audit Log ─────────────────────────────────────────────────────

class MappingAuditEntry(BaseModel):
    eventType: AuditEventType
    mappingId: Optional[str] = None
    jobId: Optional[str] = None
    user: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    details: Dict[str, Any] = Field(default_factory=dict)
