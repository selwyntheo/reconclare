## 1. Project Setup & Dependencies

- [x] 1.1 Add `cel-python`, `lxml`, `pyarrow` to `backend/requirements.txt`
- [x] 1.2 Create `backend/services/mapping/` package with `__init__.py`
- [x] 1.3 Add mapping collection constants to `backend/db/mongodb.py` (`mappingDefinitions`, `mappingJobs`, `lookupTables`, `mappingAuditLog`)
- [x] 1.4 Add mapping config settings to `backend/config/settings.py` (`MAPPING_DATA_DIR`, `MAPPING_MAX_SYNC_FILE_SIZE`, `MAPPING_MAX_ERROR_COUNT`)

## 2. Pydantic Schemas

- [x] 2.1 Create `backend/services/mapping/schemas.py` with Pydantic models: `FieldSchema`, `SourceConfig`, `TargetConfig`, `FieldMapping`, `FilterExpression`, `ErrorHandling`, `MappingDefinition`
- [x] 2.2 Add job-related models: `MappingJob`, `JobStatus` enum, `JobProgress`, `RowError`
- [x] 2.3 Add lookup table models: `LookupTable`, `LookupTableMeta`
- [x] 2.4 Add API request/response models: `MappingCreateRequest`, `MappingValidateResponse`, `PreviewRequest`, `PreviewResponse`, `SchemaInferResponse`, `CelValidateRequest`, `CelEvaluateRequest`, `CelSuggestRequest`, `AiGenerationResult`

## 3. CEL Evaluator & Custom Functions

- [x] 3.1 Create `backend/services/mapping/cel_evaluator.py` with `CelEvaluator` class — environment setup, expression compilation, and evaluation against row context
- [x] 3.2 Implement date/time custom functions: `parseDate`, `formatDate`, `today`, `dateDiff`
- [x] 3.3 Implement numeric custom functions: `parseDecimal`, `round`, `abs`, `toInt`, `formatNumber`
- [x] 3.4 Implement string custom functions: `padLeft`, `padRight`, `split`, `join`, `regexExtract`, `regexReplace`
- [x] 3.5 Implement lookup custom functions: `lookup`, `lookupOrDefault`, `crossRef`
- [x] 3.6 Implement coercion custom functions: `coalesce`, `ifEmpty`, `nullIf`, `toList`, `flatten`
- [x] 3.7 Implement expression validation (parse check, safety check against allowed variable roots: `src`, `rowIndex`, `meta`, `params`, `lookups`)

## 4. Source Readers

- [x] 4.1 Create `backend/services/mapping/readers.py` with `SourceReader` base class defining the `read() -> Iterator[dict]` interface
- [x] 4.2 Implement `CsvReader` — pandas-based CSV/TSV reading with configurable delimiter, quoteChar, hasHeader, skipRows, nullValues, encoding, trimValues
- [x] 4.3 Implement `JsonReader` — JSON array reading with rootPath navigation using jsonpath
- [x] 4.4 Implement `ExcelReader` — openpyxl-based Excel reading with sheetName/sheetIndex, headerRow, dataStartRow selection

## 5. Target Writers

- [x] 5.1 Create `backend/services/mapping/writers.py` with `TargetWriter` base class defining the `write(rows) -> str` interface (returns output file path)
- [x] 5.2 Implement `CsvWriter` — CSV output with headers and configurable delimiter
- [x] 5.3 Implement `JsonWriter` — JSON output with arrayWrapper and prettyPrint options
- [x] 5.4 Implement `ExcelWriter` — XLSX output with headers using openpyxl

## 6. Lookup Table Service

- [x] 6.1 Create `backend/services/mapping/lookup.py` with `LookupService` class — load tables from MongoDB, build in-memory hash indexes
- [x] 6.2 Implement `load_table()` — parse CSV/JSON uploads, store in `lookupTables` collection
- [x] 6.3 Implement `get_lookup_context()` — return dict of loaded tables for CEL evaluation context

## 7. Mapping Engine

- [x] 7.1 Create `backend/services/mapping/engine.py` with `MappingEngine` class orchestrating the read → filter → evaluate → write pipeline
- [x] 7.2 Implement `compile()` — compile all CEL expressions (field mappings + filters) at initialization, report compilation errors
- [x] 7.3 Implement `execute()` — row-by-row processing with `src`, `rowIndex`, `meta`, `params`, `lookups` context variables
- [x] 7.4 Implement error handling strategies: `FAIL_FAST`, `SKIP_AND_LOG`, `USE_DEFAULT`, `COLLECT_ERRORS` with maxErrorCount
- [x] 7.5 Implement execution summary: rows processed, rows skipped, error count, duration, output path

## 8. AI Mapping Generator

- [x] 8.1 Create `backend/services/mapping/ai_generator.py` with `MappingAiGenerator` class using Anthropic SDK
- [x] 8.2 Implement `generate_mappings()` — build prompt with source schema, sample rows, target schema, available functions, lookup tables; parse structured JSON response
- [x] 8.3 Implement `suggest_field_mapping()` — single-field CEL suggestion with context of other mappings
- [x] 8.4 Implement post-generation validation: compile each AI-generated CEL expression, retry up to 2 times on failure with error feedback
- [x] 8.5 Implement confidence scoring logic and structured output (targetField, cel, confidence, explanation, assumptions, validated)

## 9. REST API Router

- [x] 9.1 Create `backend/api/routers/mapping.py` with FastAPI router and register it in `backend/api/main.py`
- [x] 9.2 Implement mapping CRUD endpoints: POST/GET/PUT/DELETE `/api/v1/mappings`, POST `/api/v1/mappings/{mappingId}/clone`
- [x] 9.3 Implement validation endpoint: POST `/api/v1/mappings/validate`
- [x] 9.4 Implement preview endpoint: POST `/api/v1/mappings/preview`
- [x] 9.5 Implement schema inference endpoint: POST `/api/v1/mappings/infer-schema` (file upload → inferred schema)
- [x] 9.6 Implement sync execution endpoint: POST `/api/v1/mappings/{mappingId}/execute` (with 10MB size check)
- [x] 9.7 Implement async execution endpoint: POST `/api/v1/mappings/{mappingId}/execute-async` (BackgroundTasks + job doc)
- [x] 9.8 Implement job endpoints: GET `/api/v1/jobs/{jobId}`, GET `/api/v1/jobs/{jobId}/errors`, GET `/api/v1/jobs/{jobId}/output`, DELETE `/api/v1/jobs/{jobId}`
- [x] 9.9 Implement CEL utility endpoints: POST `/api/v1/cel/validate`, POST `/api/v1/cel/evaluate`, GET `/api/v1/cel/functions`, POST `/api/v1/cel/suggest`
- [x] 9.10 Implement lookup table endpoints: POST/GET/DELETE `/api/v1/lookups`

## 10. MongoDB Persistence & Audit

- [x] 10.1 Implement mapping definition CRUD in MongoDB with status lifecycle (DRAFT → VALIDATED → APPROVED → ACTIVE → ARCHIVED)
- [x] 10.2 Implement mapping versioning — new version on update of APPROVED/ACTIVE mappings
- [x] 10.3 Implement job document CRUD with status transitions (PENDING → RUNNING → COMPLETED/FAILED/CANCELLED)
- [x] 10.4 Implement audit logging: MAPPING_CREATED, MAPPING_MODIFIED, MAPPING_EXECUTED, MAPPING_APPROVED events
- [x] 10.5 Create MongoDB indexes for mapping queries (status, tags, createdAt) and job queries (mappingId, status)

## 11. Seed Data & Integration

- [x] 11.1 Create seed script `backend/scripts/seed_mapping_data.py` with sample mapping definitions (State Street NAV CSV → dataNav JSON, Northern Trust Position Excel → dataSubLedgerPosition)
- [x] 11.2 Create sample lookup tables seed data (xrefAccount, xrefBrokerCode)
- [x] 11.3 Create sample source files for testing (CSV, JSON, Excel) under `backend/tests/fixtures/mapping/`

## 12. Tests

- [x] 12.1 Unit tests for CEL evaluator: custom functions, expression compilation, evaluation, error handling
- [x] 12.2 Unit tests for source readers: CSV, JSON, Excel with various options
- [x] 12.3 Unit tests for target writers: CSV, JSON, Excel output verification
- [x] 12.4 Unit tests for mapping engine: end-to-end pipeline, filtering, error strategies
- [x] 12.5 Unit tests for AI generator: prompt construction, response parsing, validation retry
- [x] 12.6 Integration tests for API endpoints: CRUD, validate, preview, execute, jobs, CEL utilities, lookups
