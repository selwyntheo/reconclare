## ADDED Requirements

### Requirement: Mapping definition data model
The system SHALL store mapping definitions in MongoDB with fields: mappingId, version, name, description, createdBy, reviewedBy, status, tags, source (format, encoding, options, schema), target (format, encoding, options, schema), fieldMappings (array of targetField + cel + description), filters, and errorHandling.

#### Scenario: Create a new mapping definition
- **WHEN** a valid mapping definition JSON is submitted
- **THEN** it is stored in the `mappingDefinitions` collection with a generated `mappingId`, `version: "1.0.0"`, `status: "DRAFT"`, and `createdAt` timestamp

#### Scenario: Mapping definition includes source and target schemas
- **WHEN** a mapping definition is created with source schema fields `[{name: "Fund_ID", type: "STRING"}]` and target schema fields `[{name: "account", type: "STRING", required: true}]`
- **THEN** both schemas are persisted and used for CEL validation

### Requirement: Mapping definition lifecycle
Mapping definitions SHALL have a status lifecycle: `DRAFT` → `VALIDATED` → `APPROVED` → `ACTIVE` → `ARCHIVED`.

#### Scenario: Transition from DRAFT to VALIDATED
- **WHEN** all CEL expressions in a DRAFT mapping pass validation (parse + type check)
- **THEN** the status can be set to `VALIDATED`

#### Scenario: Transition to APPROVED
- **WHEN** a VALIDATED mapping is approved by a reviewer (different from creator)
- **THEN** the status changes to `APPROVED` with `reviewedBy` and `approvedAt` recorded

#### Scenario: Only APPROVED or ACTIVE mappings can execute
- **WHEN** an execution is requested for a mapping in DRAFT or VALIDATED status
- **THEN** the request is rejected with a 400 error

### Requirement: Mapping definition versioning
Each mapping definition SHALL use semantic versioning. Updates to an APPROVED or ACTIVE mapping SHALL create a new version.

#### Scenario: Version increment on update
- **WHEN** a field mapping CEL expression is changed on an ACTIVE mapping at version `1.0.0`
- **THEN** a new version `1.0.1` is created with status DRAFT, preserving the previous version

### Requirement: Mapping definition cloning
The system SHALL support cloning a mapping definition to create a new mapping based on an existing one.

#### Scenario: Clone a mapping
- **WHEN** a clone request is made for mapping `map_001`
- **THEN** a new mapping is created with a new `mappingId`, `status: "DRAFT"`, `version: "1.0.0"`, copying all field mappings, schemas, filters, and error handling from the source

### Requirement: Job execution tracking
Mapping executions SHALL be tracked as job documents in the `mappingJobs` collection with fields: jobId, mappingId, status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED), progress (rowsProcessed, totalRows, errorCount), startedAt, completedAt, inputFilePath, outputFilePath, errors array, and executionParams.

#### Scenario: Job created on execution start
- **WHEN** a mapping execution is initiated
- **THEN** a job document is created with `status: "PENDING"` and transitions to `"RUNNING"` when processing begins

#### Scenario: Job completed successfully
- **WHEN** all rows are processed without exceeding the error threshold
- **THEN** job status is `COMPLETED` with final row counts and output file path

#### Scenario: Job fails
- **WHEN** execution fails due to error threshold or fatal error
- **THEN** job status is `FAILED` with error details

### Requirement: Lookup table storage
Lookup tables SHALL be stored in the `lookupTables` collection with fields: tableId, name, description, keyField, data (array of records), and metadata (rowCount, uploadedAt, uploadedBy).

#### Scenario: Upload a lookup table
- **WHEN** a CSV or JSON file is uploaded as a lookup table with name `xrefAccount` and keyField `accountId`
- **THEN** the data is parsed, indexed by key field, and stored in MongoDB

#### Scenario: Lookup table available during execution
- **WHEN** a mapping references `lookups.xrefAccount` and that table is loaded
- **THEN** CEL expressions can access lookup values via the `lookup()` function

### Requirement: Mapping audit trail
All mapping definition changes and executions SHALL be logged in the `mappingAuditLog` collection.

#### Scenario: Audit log on mapping creation
- **WHEN** a mapping definition is created
- **THEN** an audit entry records: event type `MAPPING_CREATED`, user, timestamp, and full configuration snapshot

#### Scenario: Audit log on field mapping change
- **WHEN** a CEL expression is modified
- **THEN** an audit entry records: event type `MAPPING_MODIFIED`, user, timestamp, and before/after expression diff

#### Scenario: Audit log on execution
- **WHEN** a mapping job completes
- **THEN** an audit entry records: event type `MAPPING_EXECUTED`, jobId, input file hash, output file hash, row counts, error count, duration
