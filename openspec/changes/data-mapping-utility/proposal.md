## Why

The RECON-AI platform ingests files from dozens of incumbent fund administrators (State Street, Northern Trust, JP Morgan, etc.), each delivering data in bespoke CSV, TSV, fixed-width, JSON, XML, and Excel formats. Currently there is no configurable transformation layer to normalize these into the canonical data model — each integration requires custom code. A CEL-powered mapping engine provides a declarative, AI-generable, human-reviewable, and safe transformation layer that eliminates this bottleneck.

## What Changes

- Add a **mapping engine** that reads structured files (CSV, JSON, Excel), evaluates CEL expressions per-field, and writes to target formats
- Add a **CEL evaluation layer** using `cel-python` with custom extension functions for date/time, numeric, string, lookup, and coercion operations
- Add a **mapping configuration data model** stored in MongoDB with full CRUD lifecycle (draft → approved → active → archived)
- Add **REST APIs** for mapping management, validation, preview, execution (sync + async), CEL utilities, and lookup table management
- Add **AI-powered mapping generation** where Claude analyzes sample source files and target schemas to produce CEL expressions with confidence scores
- Add **lookup table support** for cross-reference resolution during mapping execution
- Add **template reuse** with inheritance so common incumbent layouts map once and apply across funds
- Add **execution job tracking** with error capture, progress reporting, and output download

## Capabilities

### New Capabilities
- `mapping-engine`: Core file-to-file transformation engine with CEL evaluation pipeline, format readers/writers, and row-level processing
- `mapping-config`: Mapping definition data model, CRUD lifecycle, template inheritance, versioning, and MongoDB persistence
- `mapping-api`: REST API endpoints for mapping management, validation, preview, execution, CEL utilities, and lookup tables
- `mapping-ai`: AI-powered CEL expression generation from sample data, expression validation, confidence scoring, and suggestion pipeline
- `cel-functions`: Custom CEL function library — date/time, numeric, string, lookup, and coercion functions for financial data transformation

### Modified Capabilities

## Impact

- **New Python packages**: `cel-python`, `openpyxl` (already present), `lxml` (XML parsing), `pyarrow` (Parquet)
- **New MongoDB collections**: `mappingDefinitions`, `mappingTemplates`, `mappingJobs`, `lookupTables`, `mappingAuditLog`
- **New API router**: `/api/v1/mappings/`, `/api/v1/cel/`, `/api/v1/lookups/`, `/api/v1/jobs/`
- **New backend modules**: `backend/services/mapping/`, `backend/api/routers/mapping.py`
- **Integration points**: Document Intelligence output feeds in as source files; mapped output feeds into validation engine
