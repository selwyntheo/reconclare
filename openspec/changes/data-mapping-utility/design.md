## Context

The RECON-AI platform is a FastAPI + MongoDB + Neo4j application for fund administration reconciliation. It already has a canonical data model (dataNav, dataDailyTransactions, dataSubLedgerPosition, dataLedger, refSecurity, cross-reference tables) stored in MongoDB, a multi-agent AI pipeline (LangGraph + Claude/OpenAI), and a validation engine that detects breaks.

The missing piece is **data ingestion normalization**: incumbent providers deliver data in diverse file formats that must be mapped to the canonical model before reconciliation can run. The spec at `requirements/mapping/RECON-AI-Data-Mapping-Utility-Specification.md` defines a CEL-powered mapping engine.

The existing backend uses Python exclusively — no JVM. The spec references Java libraries (cel-java, Apache Commons CSV, Apache POI) but we will implement entirely in Python using equivalent libraries.

## Goals / Non-Goals

**Goals:**
- Implement a Python-native mapping engine using `cel-python` for expression evaluation
- Support CSV, JSON, and Excel as source/target formats (Phase 1)
- Provide full CRUD REST API for mapping definitions with MongoDB persistence
- Enable AI-powered CEL expression generation via Claude (Anthropic SDK)
- Support lookup tables for cross-reference resolution
- Async job execution for large files with progress tracking
- Integrate with existing FastAPI app structure (routers, services, db patterns)

**Non-Goals:**
- XML, YAML, Parquet, fixed-width support (Phase 2)
- React visual mapping designer UI (Phase 3)
- Template inheritance hierarchy (Phase 2)
- Neo4j graph integration for mapping lineage (future)
- Streaming/real-time mapping (batch only)
- Database-to-database replication

## Decisions

### 1. CEL Runtime: `cel-python` over custom expression parser
**Choice:** Use `cel-python` (wraps Rust `cel-interpreter`)
**Rationale:** The spec mandates CEL. `cel-python` provides microsecond evaluation, non-Turing-complete safety guarantees, and compatibility with the CEL spec. Custom functions are registered via Python callables. No JVM dependency needed.
**Alternative rejected:** Building a custom expression parser — would lose CEL ecosystem compatibility and AI generation advantages.

### 2. File I/O: pandas + openpyxl over raw parsers
**Choice:** Use `pandas` for CSV/JSON reading/writing, `openpyxl` for Excel
**Rationale:** pandas is already a project dependency, handles encoding, delimiters, quoting, date parsing, and null value handling. openpyxl is already installed. For large files, pandas chunked reading keeps memory bounded.
**Alternative rejected:** `csv` stdlib module — less feature-rich, no type inference, more boilerplate.

### 3. MongoDB persistence over filesystem
**Choice:** Store mapping definitions, job records, and lookup tables in MongoDB collections
**Rationale:** Consistent with the existing data layer. MongoDB's flexible schema suits the mapping config JSON structure. Existing connection patterns (motor async, pymongo sync) are reused.
**Collections:** `mappingDefinitions`, `mappingJobs`, `lookupTables`, `mappingAuditLog`

### 4. Service layer architecture: dedicated `mapping/` package
**Choice:** Create `backend/services/mapping/` with sub-modules for engine, cel_evaluator, readers, writers, ai_generator
**Rationale:** The mapping engine is a substantial subsystem. A package keeps concerns separated while co-locating related logic. Follows the existing services pattern (validation_engine.py, ai_analysis.py) but at package scale.

### 5. AI generation: Direct Anthropic SDK with structured prompts
**Choice:** Use the Anthropic Python SDK directly with structured prompts containing source schema, sample data, and target schema
**Rationale:** The existing `ai_analysis.py` demonstrates the pattern. Claude generates CEL expressions per target field with confidence scores. `cel-python` validates each expression before acceptance.
**Alternative rejected:** LangGraph agent workflow — overkill for a single-shot generation task. The mapping generation is a prompt-in/structured-JSON-out operation, not a multi-step agent workflow.

### 6. Async execution: BackgroundTasks + MongoDB job tracking
**Choice:** Use FastAPI's BackgroundTasks for async mapping execution with MongoDB job documents for status tracking
**Rationale:** Matches the existing pattern in validation_engine.py where runs are tracked in MongoDB. No need for Celery/Redis since mapping jobs are CPU-bound and short-lived (<1min for 100K rows). WebSocket notifications can be added later using the existing websocket.py infrastructure.

### 7. File storage: Local filesystem with configurable path
**Choice:** Store uploaded source files and generated output files on local filesystem under a configurable `MAPPING_DATA_DIR`
**Rationale:** Simple, fast, and sufficient for Phase 1. S3/blob storage can be added later behind an abstraction. File references stored in MongoDB job documents.

## Risks / Trade-offs

- **[cel-python maturity]** → The `cel-python` library is community-maintained and may not support all CEL spec features. Mitigation: validate core functions needed in a spike test; implement missing functions as Python custom functions registered in the CEL environment.
- **[Large file memory]** → Loading entire files into pandas DataFrames for >100K rows may spike memory. Mitigation: Use chunked reading (`chunksize` parameter) and process chunks sequentially through CEL evaluation.
- **[CEL custom functions]** → Registering custom functions (parseDate, parseDecimal, lookup, etc.) in cel-python may require specific API patterns. Mitigation: Wrap each in a Python function and register via cel-python's extension mechanism; fall back to pre/post-processing if registration is limited.
- **[AI hallucination in CEL]** → Claude may generate CEL expressions using functions not in our custom library. Mitigation: Include explicit function list in prompt; validate every generated expression against the CEL environment before returning to user.
- **[No rollback on failed mapping execution]** → Partial output files may be left on disk. Mitigation: Write to temp file, rename on success, clean up on failure.

## Module Structure

```
backend/
├── services/
│   └── mapping/
│       ├── __init__.py
│       ├── engine.py          # MappingEngine - orchestrates read→evaluate→write pipeline
│       ├── cel_evaluator.py   # CEL environment setup, custom functions, expression compilation/evaluation
│       ├── readers.py         # SourceReader base + CsvReader, JsonReader, ExcelReader
│       ├── writers.py         # TargetWriter base + CsvWriter, JsonWriter, ExcelWriter
│       ├── ai_generator.py   # AI-powered CEL expression generation via Claude
│       ├── schemas.py        # Pydantic models for mapping config, job status, etc.
│       └── lookup.py         # Lookup table loading and cross-reference resolution
├── api/
│   └── routers/
│       └── mapping.py        # REST API endpoints for mappings, jobs, CEL, lookups
├── db/
│   └── (existing mongodb.py) # Add new collection constants
```
