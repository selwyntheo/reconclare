## ADDED Requirements

### Requirement: Mapping CRUD endpoints
The API SHALL provide REST endpoints for creating, reading, updating, deleting, and cloning mapping definitions.

#### Scenario: Create mapping definition
- **WHEN** POST `/api/v1/mappings` is called with a valid mapping definition body
- **THEN** the mapping is created with status DRAFT and the response includes the generated mappingId (201 Created)

#### Scenario: List mapping definitions
- **WHEN** GET `/api/v1/mappings` is called with optional query params (status, tags, search)
- **THEN** a paginated list of mapping definitions is returned sorted by updatedAt descending

#### Scenario: Get mapping definition by ID
- **WHEN** GET `/api/v1/mappings/{mappingId}` is called with a valid ID
- **THEN** the full mapping definition is returned including all field mappings, schemas, and options

#### Scenario: Update mapping definition
- **WHEN** PUT `/api/v1/mappings/{mappingId}` is called with updated fields
- **THEN** the mapping is updated (or versioned if APPROVED/ACTIVE) and the response includes the updated document

#### Scenario: Delete mapping definition
- **WHEN** DELETE `/api/v1/mappings/{mappingId}` is called for a DRAFT mapping
- **THEN** the mapping is deleted (204 No Content). ACTIVE mappings SHALL be archived, not deleted.

#### Scenario: Clone mapping definition
- **WHEN** POST `/api/v1/mappings/{mappingId}/clone` is called
- **THEN** a new DRAFT mapping is created copying all configuration from the source (201 Created)

### Requirement: Mapping validation endpoint
The API SHALL validate mapping configurations including CEL expression parsing and type checking.

#### Scenario: Validate valid mapping
- **WHEN** POST `/api/v1/mappings/validate` is called with a mapping config where all CEL expressions parse correctly
- **THEN** response includes `valid: true` with per-field validation results

#### Scenario: Validate mapping with invalid CEL
- **WHEN** POST `/api/v1/mappings/validate` is called with an invalid CEL expression
- **THEN** response includes `valid: false` with the specific field, expression, and parse error message

### Requirement: Mapping preview endpoint
The API SHALL preview mapping results by applying the mapping to sample rows without creating a job.

#### Scenario: Preview with uploaded sample data
- **WHEN** POST `/api/v1/mappings/preview` is called with a mapping config and sample data (up to 100 rows)
- **THEN** response includes an array of mapped output rows alongside source rows, plus any evaluation errors

### Requirement: Schema inference endpoint
The API SHALL infer source schema from an uploaded sample file.

#### Scenario: Infer CSV schema
- **WHEN** POST `/api/v1/mappings/infer-schema` is called with a CSV file upload
- **THEN** response includes inferred field names, types, sample values, and format options (delimiter, encoding)

#### Scenario: Infer Excel schema
- **WHEN** POST `/api/v1/mappings/infer-schema` is called with an XLSX file upload
- **THEN** response includes field names from header row, inferred types from data rows, sheet names, and sample values

### Requirement: Synchronous mapping execution
The API SHALL execute small file mappings synchronously and return the result directly.

#### Scenario: Sync execution for small file
- **WHEN** POST `/api/v1/mappings/{mappingId}/execute` is called with a source file under 10MB
- **THEN** the mapping executes inline and the response includes the output data or a download link, plus an execution summary (rows processed, errors, duration)

#### Scenario: Sync execution rejects large files
- **WHEN** POST `/api/v1/mappings/{mappingId}/execute` is called with a file over 10MB
- **THEN** a 400 error is returned directing the client to use the async endpoint

### Requirement: Asynchronous mapping execution
The API SHALL execute large file mappings asynchronously with job tracking.

#### Scenario: Async execution creates a job
- **WHEN** POST `/api/v1/mappings/{mappingId}/execute-async` is called with a source file
- **THEN** a job document is created and the response returns the `jobId` with status PENDING (202 Accepted)

#### Scenario: Get job status
- **WHEN** GET `/api/v1/jobs/{jobId}` is called
- **THEN** the response includes job status, progress (rowsProcessed, totalRows, errorCount), and timing info

#### Scenario: Get job errors
- **WHEN** GET `/api/v1/jobs/{jobId}/errors` is called for a completed/failed job
- **THEN** a paginated list of row-level error details is returned

#### Scenario: Download job output
- **WHEN** GET `/api/v1/jobs/{jobId}/output` is called for a COMPLETED job
- **THEN** the output file is returned as a download

#### Scenario: Cancel running job
- **WHEN** DELETE `/api/v1/jobs/{jobId}` is called for a RUNNING job
- **THEN** the job is cancelled and status set to CANCELLED

### Requirement: CEL utility endpoints
The API SHALL provide endpoints for validating, evaluating, and listing CEL functions.

#### Scenario: Validate CEL expression
- **WHEN** POST `/api/v1/cel/validate` is called with a CEL expression and source schema
- **THEN** response indicates whether the expression parses correctly and its inferred return type

#### Scenario: Evaluate CEL expression against sample data
- **WHEN** POST `/api/v1/cel/evaluate` is called with a CEL expression and sample row data
- **THEN** response includes the evaluated result value

#### Scenario: List available CEL functions
- **WHEN** GET `/api/v1/cel/functions` is called
- **THEN** response includes all registered CEL functions with names, signatures, descriptions, and examples

### Requirement: Lookup table management endpoints
The API SHALL provide endpoints for uploading, listing, and deleting lookup tables.

#### Scenario: Upload lookup table
- **WHEN** POST `/api/v1/lookups` is called with a CSV/JSON file and metadata (name, keyField)
- **THEN** the lookup table is parsed, stored in MongoDB, and the response includes tableId and row count

#### Scenario: List lookup tables
- **WHEN** GET `/api/v1/lookups` is called
- **THEN** a list of available lookup tables is returned with name, keyField, rowCount, and uploadedAt

#### Scenario: Delete lookup table
- **WHEN** DELETE `/api/v1/lookups/{tableId}` is called
- **THEN** the lookup table is removed from MongoDB (204 No Content)
