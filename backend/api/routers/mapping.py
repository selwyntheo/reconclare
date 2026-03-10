"""
REST API Router for the Data Mapping Utility.

Provides endpoints for mapping CRUD, validation, preview, execution,
CEL utilities, and lookup table management.
"""
import hashlib
import os
import shutil
import tempfile
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from config.settings import settings
from db.mongodb import get_async_db, COLLECTIONS
from services.mapping.cel_evaluator import CelEvaluator, FUNCTION_DOCS, set_lookup_context
from services.mapping.engine import MappingEngine
from services.mapping.lookup import LookupService
from services.mapping.readers import get_reader
from services.mapping.schemas import (
    AuditEventType,
    CelEvaluateRequest, CelEvaluateResponse,
    CelFunctionDoc,
    CelSuggestRequest,
    CelValidateRequest, CelValidateResponse,
    ErrorStrategy, ExecutionSummary,
    FieldSchema, FieldValidationResult,
    JobStatus, MappingAuditEntry,
    MappingCreateRequest, MappingDefinition,
    MappingJob, MappingStatus, MappingValidateResponse,
    PreviewRequest, PreviewResponse, PreviewRow,
    RowError, SchemaInferField, SchemaInferResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["mapping"])


# ── Helpers ───────────────────────────────────────────────────────

def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


async def _get_mapping(mapping_id: str) -> dict:
    db = get_async_db()
    doc = await db[COLLECTIONS["mappingDefinitions"]].find_one({"mappingId": mapping_id})
    if not doc:
        raise HTTPException(404, f"Mapping {mapping_id} not found")
    return doc


async def _audit_log(event_type: AuditEventType, mapping_id: str = None,
                     job_id: str = None, user: str = None, details: dict = None):
    db = get_async_db()
    entry = MappingAuditEntry(
        eventType=event_type,
        mappingId=mapping_id,
        jobId=job_id,
        user=user,
        details=details or {},
    )
    await db[COLLECTIONS["mappingAuditLog"]].insert_one(entry.model_dump())


async def _save_upload(upload: UploadFile) -> str:
    """Save uploaded file to temp dir, return path."""
    os.makedirs(settings.MAPPING_DATA_DIR, exist_ok=True)
    suffix = os.path.splitext(upload.filename or "file")[1]
    tmp_path = os.path.join(settings.MAPPING_DATA_DIR, f"upload_{uuid4().hex[:8]}{suffix}")
    with open(tmp_path, "wb") as f:
        content = await upload.read()
        f.write(content)
    return tmp_path


# ── Mapping CRUD ──────────────────────────────────────────────────

@router.post("/mappings", status_code=201)
async def create_mapping(req: MappingCreateRequest):
    """Create a new mapping definition."""
    db = get_async_db()
    mapping_id = _new_id("map")
    now = datetime.now(timezone.utc)

    doc = req.model_dump(by_alias=True)
    doc["mappingId"] = mapping_id
    doc["version"] = "1.0.0"
    doc["status"] = MappingStatus.DRAFT.value
    doc["createdAt"] = now
    doc["updatedAt"] = now
    doc["createdBy"] = None
    doc["reviewedBy"] = None
    doc["approvedAt"] = None

    await db[COLLECTIONS["mappingDefinitions"]].insert_one(doc)
    await _audit_log(AuditEventType.MAPPING_CREATED, mapping_id=mapping_id, details=doc)

    doc.pop("_id", None)
    return doc


@router.get("/mappings")
async def list_mappings(
    status: Optional[str] = None,
    tags: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    """List mapping definitions with optional filters."""
    db = get_async_db()
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if tags:
        query["tags"] = {"$in": tags.split(",")}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    cursor = db[COLLECTIONS["mappingDefinitions"]].find(
        query, {"_id": 0}
    ).sort("updatedAt", -1).skip(skip).limit(limit)

    results = await cursor.to_list(length=limit)
    total = await db[COLLECTIONS["mappingDefinitions"]].count_documents(query)
    return {"items": results, "total": total, "skip": skip, "limit": limit}


@router.get("/mappings/{mapping_id}")
async def get_mapping(mapping_id: str):
    """Get a mapping definition by ID."""
    doc = await _get_mapping(mapping_id)
    doc.pop("_id", None)
    return doc


@router.put("/mappings/{mapping_id}")
async def update_mapping(mapping_id: str, req: MappingCreateRequest):
    """Update a mapping definition. Creates new version if APPROVED/ACTIVE."""
    db = get_async_db()
    existing = await _get_mapping(mapping_id)
    now = datetime.now(timezone.utc)

    if existing["status"] in (MappingStatus.APPROVED.value, MappingStatus.ACTIVE.value):
        # Create new version
        old_version = existing.get("version", "1.0.0")
        parts = old_version.split(".")
        parts[-1] = str(int(parts[-1]) + 1)
        new_version = ".".join(parts)

        new_doc = req.model_dump(by_alias=True)
        new_doc["mappingId"] = mapping_id
        new_doc["version"] = new_version
        new_doc["status"] = MappingStatus.DRAFT.value
        new_doc["createdAt"] = existing.get("createdAt", now)
        new_doc["updatedAt"] = now
        new_doc["createdBy"] = existing.get("createdBy")
        new_doc["reviewedBy"] = None
        new_doc["approvedAt"] = None

        await db[COLLECTIONS["mappingDefinitions"]].replace_one(
            {"mappingId": mapping_id}, new_doc
        )
        await _audit_log(AuditEventType.MAPPING_MODIFIED, mapping_id=mapping_id,
                         details={"newVersion": new_version})
        new_doc.pop("_id", None)
        return new_doc
    else:
        update_data = req.model_dump(by_alias=True)
        update_data["updatedAt"] = now
        await db[COLLECTIONS["mappingDefinitions"]].update_one(
            {"mappingId": mapping_id}, {"$set": update_data}
        )
        await _audit_log(AuditEventType.MAPPING_MODIFIED, mapping_id=mapping_id)
        updated = await _get_mapping(mapping_id)
        updated.pop("_id", None)
        return updated


@router.delete("/mappings/{mapping_id}", status_code=204)
async def delete_mapping(mapping_id: str):
    """Delete a DRAFT mapping or archive an ACTIVE one."""
    db = get_async_db()
    existing = await _get_mapping(mapping_id)

    if existing["status"] in (MappingStatus.ACTIVE.value, MappingStatus.APPROVED.value):
        await db[COLLECTIONS["mappingDefinitions"]].update_one(
            {"mappingId": mapping_id},
            {"$set": {"status": MappingStatus.ARCHIVED.value, "updatedAt": datetime.now(timezone.utc)}}
        )
    else:
        await db[COLLECTIONS["mappingDefinitions"]].delete_one({"mappingId": mapping_id})

    await _audit_log(AuditEventType.MAPPING_DELETED, mapping_id=mapping_id)


@router.post("/mappings/{mapping_id}/clone", status_code=201)
async def clone_mapping(mapping_id: str):
    """Clone a mapping definition."""
    existing = await _get_mapping(mapping_id)
    db = get_async_db()
    now = datetime.now(timezone.utc)
    new_id = _new_id("map")

    clone = {k: v for k, v in existing.items() if k != "_id"}
    clone["mappingId"] = new_id
    clone["version"] = "1.0.0"
    clone["status"] = MappingStatus.DRAFT.value
    clone["name"] = f"{clone.get('name', '')} (copy)"
    clone["createdAt"] = now
    clone["updatedAt"] = now
    clone["reviewedBy"] = None
    clone["approvedAt"] = None

    await db[COLLECTIONS["mappingDefinitions"]].insert_one(clone)
    clone.pop("_id", None)
    return clone


@router.put("/mappings/{mapping_id}/approve")
async def approve_mapping(mapping_id: str, reviewer: str = Query(...)):
    """Approve a VALIDATED mapping."""
    db = get_async_db()
    existing = await _get_mapping(mapping_id)

    if existing["status"] not in (MappingStatus.VALIDATED.value, MappingStatus.DRAFT.value):
        raise HTTPException(400, f"Mapping must be VALIDATED to approve, current: {existing['status']}")

    now = datetime.now(timezone.utc)
    await db[COLLECTIONS["mappingDefinitions"]].update_one(
        {"mappingId": mapping_id},
        {"$set": {
            "status": MappingStatus.APPROVED.value,
            "reviewedBy": reviewer,
            "approvedAt": now,
            "updatedAt": now,
        }}
    )
    await _audit_log(AuditEventType.MAPPING_APPROVED, mapping_id=mapping_id,
                     user=reviewer)
    return {"mappingId": mapping_id, "status": "APPROVED", "reviewedBy": reviewer}


# ── Mapping Validation ────────────────────────────────────────────

@router.post("/mappings/validate")
async def validate_mapping(req: MappingCreateRequest) -> MappingValidateResponse:
    """Validate all CEL expressions in a mapping config."""
    evaluator = CelEvaluator()
    field_results = []
    filter_results = []
    all_valid = True

    for fm in req.fieldMappings:
        valid, error = evaluator.validate_expression(fm.cel)
        field_results.append(FieldValidationResult(
            targetField=fm.targetField,
            cel=fm.cel,
            valid=valid,
            error=error,
        ))
        if not valid:
            all_valid = False

    for f in req.filters:
        valid, error = evaluator.validate_expression(f.cel)
        filter_results.append(FieldValidationResult(
            targetField="_filter",
            cel=f.cel,
            valid=valid,
            error=error,
        ))
        if not valid:
            all_valid = False

    # If all valid and mapping has an ID, update status to VALIDATED
    return MappingValidateResponse(
        valid=all_valid,
        fieldResults=field_results,
        filterResults=filter_results,
    )


# ── Mapping Preview ───────────────────────────────────────────────

@router.post("/mappings/preview")
async def preview_mapping(req: PreviewRequest) -> PreviewResponse:
    """Preview mapping results on sample data."""
    mapping_def = MappingDefinition(
        name="preview",
        source=req.mapping.source,
        target=req.mapping.target,
        fieldMappings=req.mapping.fieldMappings,
        filters=req.mapping.filters,
        errorHandling=req.mapping.errorHandling,
    )

    engine = MappingEngine()
    results = engine.preview(mapping_def, req.sampleData, req.params)

    def _sanitize(obj):
        """Ensure all values are JSON-serializable."""
        if obj is None:
            return None
        if isinstance(obj, (str, int, float, bool)):
            return obj
        if isinstance(obj, dict):
            return {str(k): _sanitize(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [_sanitize(v) for v in obj]
        return str(obj)

    rows = []
    filtered_count = 0
    error_count = 0
    for r in results:
        row = PreviewRow(
            sourceRow=_sanitize(r["sourceRow"]),
            targetRow=_sanitize(r.get("targetRow")),
            errors=r.get("errors", []),
            filtered=r.get("filtered", False),
        )
        rows.append(row)
        if row.filtered:
            filtered_count += 1
        if row.errors:
            error_count += 1

    return PreviewResponse(
        rows=rows,
        totalRows=len(rows),
        mappedRows=len(rows) - filtered_count - error_count,
        filteredRows=filtered_count,
        errorRows=error_count,
    )


# ── Schema Inference ──────────────────────────────────────────────

@router.post("/mappings/infer-schema")
async def infer_schema(file: UploadFile = File(...)) -> SchemaInferResponse:
    """Infer source schema from an uploaded sample file."""
    file_path = await _save_upload(file)

    try:
        suffix = os.path.splitext(file.filename or "")[1].lower()
        format_map = {".csv": "CSV", ".tsv": "TSV", ".json": "JSON", ".xlsx": "EXCEL", ".xls": "EXCEL"}
        fmt = format_map.get(suffix)
        if not fmt:
            raise HTTPException(400, f"Unsupported file format: {suffix}")

        reader = get_reader(fmt)
        options = {}
        if fmt == "TSV":
            options["delimiter"] = "\t"

        schema_fields = reader.infer_schema(file_path, options)
        total_rows = reader.count_rows(file_path, options) or 0

        fields = [
            SchemaInferField(
                name=f["name"],
                inferredType=f["inferredType"],
                sampleValues=f.get("sampleValues", []),
                nullCount=f.get("nullCount", 0),
                distinctCount=f.get("distinctCount", 0),
            )
            for f in schema_fields
        ]

        return SchemaInferResponse(
            format=fmt,
            fields=fields,
            options=options,
            totalRows=total_rows,
        )
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


# ── Read Sample Rows ─────────────────────────────────────────────

@router.post("/mappings/read-sample")
async def read_sample_rows(
    file: UploadFile = File(...),
    rows: int = Query(10, ge=1, le=100),
):
    """Read up to N rows from an uploaded file and return them as JSON dicts."""
    file_path = await _save_upload(file)
    try:
        suffix = os.path.splitext(file.filename or "")[1].lower()
        format_map = {".csv": "CSV", ".tsv": "TSV", ".json": "JSON", ".xlsx": "EXCEL", ".xls": "EXCEL"}
        fmt = format_map.get(suffix)
        if not fmt:
            raise HTTPException(400, f"Unsupported file format: {suffix}")

        reader = get_reader(fmt)
        options: Dict[str, Any] = {}
        if fmt == "TSV":
            options["delimiter"] = "\t"

        sample = []
        for row in reader.read(file_path, options):
            sample.append(row)
            if len(sample) >= rows:
                break

        total = reader.count_rows(file_path, options) or len(sample)
        return {"rows": sample, "totalRows": total, "format": fmt}
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


# ── AI Auto-Generate Mapping ─────────────────────────────────────

@router.post("/mappings/ai-generate")
async def ai_generate_mapping(
    source_file: UploadFile = File(...),
    target_file: UploadFile = File(None),
    target_schema_json: Optional[str] = Form(None),
    mapping_name: Optional[str] = Form(None),
    lookup_tables: Optional[str] = Form(None),
):
    """
    AI-powered full mapping generation.

    Upload a source file and either a target file or target schema JSON.
    The LLM infers both schemas, reads sample data, and generates
    CEL field mappings for every target field.

    Returns a complete draft mapping definition ready for review.
    """
    import json as _json

    source_path = await _save_upload(source_file)
    target_path = None

    try:
        # ── Infer source schema & read sample rows ──
        src_suffix = os.path.splitext(source_file.filename or "")[1].lower()
        format_map = {".csv": "CSV", ".tsv": "TSV", ".json": "JSON", ".xlsx": "EXCEL", ".xls": "EXCEL"}
        src_fmt = format_map.get(src_suffix)
        if not src_fmt:
            raise HTTPException(400, f"Unsupported source format: {src_suffix}")

        src_reader = get_reader(src_fmt)
        src_options: Dict[str, Any] = {}
        if src_fmt == "TSV":
            src_options["delimiter"] = "\t"

        src_schema_raw = src_reader.infer_schema(source_path, src_options)
        src_schema = [
            FieldSchema(name=f["name"], type=f.get("inferredType", "STRING"))
            for f in src_schema_raw
        ]

        # Read sample rows (up to 5)
        sample_rows = []
        for row in src_reader.read(source_path, src_options):
            sample_rows.append(row)
            if len(sample_rows) >= 5:
                break

        src_total_rows = src_reader.count_rows(source_path, src_options) or 0

        # ── Resolve target schema ──
        tgt_fmt = "JSON"
        tgt_schema: List[FieldSchema] = []
        tgt_schema_raw: List[Dict[str, Any]] = []
        tgt_options: Dict[str, Any] = {}
        tgt_sample_rows: List[Dict[str, Any]] = []

        if target_file and target_file.filename:
            # Infer target schema from uploaded file
            target_path = await _save_upload(target_file)
            tgt_suffix = os.path.splitext(target_file.filename or "")[1].lower()
            tgt_fmt_str = format_map.get(tgt_suffix)
            if not tgt_fmt_str:
                raise HTTPException(400, f"Unsupported target format: {tgt_suffix}")
            tgt_fmt = tgt_fmt_str

            tgt_reader = get_reader(tgt_fmt)
            if tgt_fmt == "TSV":
                tgt_options["delimiter"] = "\t"

            tgt_schema_raw = tgt_reader.infer_schema(target_path, tgt_options)
            tgt_schema = [
                FieldSchema(name=f["name"], type=f.get("inferredType", "STRING"))
                for f in tgt_schema_raw
            ]
            # Read sample target rows for AI context
            for row in tgt_reader.read(target_path, tgt_options):
                tgt_sample_rows.append(row)
                if len(tgt_sample_rows) >= 3:
                    break

        elif target_schema_json:
            # Parse manually provided target schema
            parsed = _json.loads(target_schema_json)
            tgt_schema = [FieldSchema(**f) for f in parsed]
        else:
            raise HTTPException(400, "Provide either target_file or target_schema_json")

        # ── Resolve lookup table names ──
        lkp_names: List[str] = []
        if lookup_tables:
            lkp_names = [s.strip() for s in lookup_tables.split(",") if s.strip()]
        else:
            # Auto-discover available lookups
            db = get_async_db()
            svc = LookupService(db)
            tables = await svc.list_tables()
            lkp_names = [t.get("name", "") for t in tables if t.get("name")]

        # ── Call AI generator ──
        from services.mapping.ai_generator import MappingAiGenerator

        generator = MappingAiGenerator()
        ai_result = await generator.generate_mappings(
            source_schema=src_schema,
            sample_data=sample_rows,
            target_schema=tgt_schema,
            lookup_tables=lkp_names,
            target_sample_data=tgt_sample_rows if tgt_sample_rows else None,
        )

        # ── Build complete mapping definition ──
        auto_name = mapping_name or f"AI Mapping: {source_file.filename} → {target_file.filename if target_file and target_file.filename else tgt_fmt}"
        field_mappings = [
            {
                "targetField": m.targetField,
                "cel": m.cel,
                "description": m.explanation,
            }
            for m in ai_result.mappings
        ]

        # Build source/target config
        source_config = {
            "format": src_fmt,
            "encoding": "UTF-8",
            "options": src_options,
            "schema": [f.model_dump() for f in src_schema],
        }
        target_config = {
            "format": tgt_fmt,
            "encoding": "UTF-8",
            "options": {"prettyPrint": True, "arrayWrapper": True} if tgt_fmt == "JSON" else tgt_options,
            "schema": [f.model_dump() for f in tgt_schema],
        }

        return {
            "name": auto_name,
            "description": f"Auto-generated by AI from {source_file.filename}. "
                           f"{len(ai_result.mappings)} field mappings created.",
            "source": source_config,
            "target": target_config,
            "fieldMappings": field_mappings,
            "aiResult": {
                "mappings": [m.model_dump() for m in ai_result.mappings],
                "generatedAt": ai_result.generatedAt.isoformat() if ai_result.generatedAt else None,
            },
            "sourceStats": {
                "totalRows": src_total_rows,
                "sampleRows": sample_rows[:3],
                "fieldsInferred": len(src_schema),
            },
            "targetStats": {
                "fieldsInferred": len(tgt_schema),
                "sampleRows": tgt_sample_rows[:3] if tgt_sample_rows else [],
            },
        }

    finally:
        if os.path.exists(source_path):
            os.remove(source_path)
        if target_path and os.path.exists(target_path):
            os.remove(target_path)


# ── Mapping Execution (Sync) ─────────────────────────────────────

@router.post("/mappings/{mapping_id}/execute")
async def execute_mapping_sync(
    mapping_id: str,
    file: UploadFile = File(...),
    params: Optional[str] = Form(None),
):
    """Execute mapping synchronously (files < 10MB)."""
    doc = await _get_mapping(mapping_id)
    if doc["status"] not in (MappingStatus.APPROVED.value, MappingStatus.ACTIVE.value):
        raise HTTPException(400, f"Only APPROVED or ACTIVE mappings can execute. Current: {doc['status']}")

    file_path = await _save_upload(file)
    file_size = os.path.getsize(file_path)

    if file_size > settings.MAPPING_MAX_SYNC_FILE_SIZE:
        os.remove(file_path)
        raise HTTPException(400, f"File too large for sync execution ({file_size} bytes). Use /execute-async.")

    try:
        exec_params = {}
        if params:
            import json
            exec_params = json.loads(params)

        mapping_def = MappingDefinition(**{k: v for k, v in doc.items() if k != "_id"})

        # Load lookups
        db = get_async_db()
        lookup_svc = LookupService(db)
        lookup_ctx = await lookup_svc.load_tables_for_execution()

        engine = MappingEngine()
        summary = engine.execute(mapping_def, file_path, params=exec_params, lookup_context=lookup_ctx)

        # Create job record
        await _create_job_record(summary, mapping_id, file_path, exec_params)
        await _audit_log(AuditEventType.MAPPING_EXECUTED, mapping_id=mapping_id,
                         job_id=summary.jobId, details=summary.model_dump())

        return summary.model_dump()
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


# ── Mapping Execution (Async) ────────────────────────────────────

@router.post("/mappings/{mapping_id}/execute-async", status_code=202)
async def execute_mapping_async(
    mapping_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    params: Optional[str] = Form(None),
):
    """Execute mapping asynchronously. Returns jobId."""
    doc = await _get_mapping(mapping_id)
    if doc["status"] not in (MappingStatus.APPROVED.value, MappingStatus.ACTIVE.value):
        raise HTTPException(400, f"Only APPROVED or ACTIVE mappings can execute. Current: {doc['status']}")

    file_path = await _save_upload(file)
    exec_params = {}
    if params:
        import json
        exec_params = json.loads(params)

    job_id = _new_id("job")
    now = datetime.now(timezone.utc)

    db = get_async_db()
    job_doc = MappingJob(
        jobId=job_id,
        mappingId=mapping_id,
        status=JobStatus.PENDING,
        startedAt=now,
        inputFilePath=file_path,
        executionParams=exec_params,
    )
    await db[COLLECTIONS["mappingJobs"]].insert_one(job_doc.model_dump())

    background_tasks.add_task(
        _run_async_mapping, job_id, mapping_id, file_path, exec_params, doc
    )

    return {"jobId": job_id, "status": "PENDING"}


async def _run_async_mapping(
    job_id: str, mapping_id: str, file_path: str,
    exec_params: dict, mapping_doc: dict,
):
    """Background task for async mapping execution."""
    db = get_async_db()
    collection = db[COLLECTIONS["mappingJobs"]]

    await collection.update_one(
        {"jobId": job_id},
        {"$set": {"status": JobStatus.RUNNING.value}}
    )

    try:
        mapping_def = MappingDefinition(**{k: v for k, v in mapping_doc.items() if k != "_id"})

        lookup_svc = LookupService(db)
        lookup_ctx = await lookup_svc.load_tables_for_execution()

        engine = MappingEngine()
        summary = engine.execute(mapping_def, file_path, params=exec_params, lookup_context=lookup_ctx)

        await collection.update_one(
            {"jobId": job_id},
            {"$set": {
                "status": summary.status.value,
                "completedAt": datetime.now(timezone.utc),
                "outputFilePath": summary.outputPath,
                "durationMs": summary.durationMs,
                "progress": {
                    "rowsProcessed": summary.rowsProcessed,
                    "rowsSkipped": summary.rowsSkipped,
                    "errorCount": summary.errorCount,
                },
            }}
        )

        await _audit_log(AuditEventType.MAPPING_EXECUTED, mapping_id=mapping_id,
                         job_id=job_id, details=summary.model_dump())
    except Exception as e:
        logger.error(f"Async mapping failed: {e}")
        await collection.update_one(
            {"jobId": job_id},
            {"$set": {
                "status": JobStatus.FAILED.value,
                "completedAt": datetime.now(timezone.utc),
                "errors": [{"errorType": "EXECUTION_ERROR", "errorMessage": str(e),
                            "rowIndex": 0, "timestamp": datetime.now(timezone.utc).isoformat()}],
            }}
        )
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


async def _create_job_record(summary: ExecutionSummary, mapping_id: str,
                             input_file: str, params: dict):
    """Create a job document for a sync execution."""
    db = get_async_db()
    now = datetime.now(timezone.utc)
    job_doc = {
        "jobId": summary.jobId,
        "mappingId": mapping_id,
        "status": summary.status.value,
        "progress": {
            "rowsProcessed": summary.rowsProcessed,
            "rowsSkipped": summary.rowsSkipped,
            "errorCount": summary.errorCount,
        },
        "startedAt": now,
        "completedAt": now,
        "inputFilePath": input_file,
        "outputFilePath": summary.outputPath,
        "executionParams": params,
        "durationMs": summary.durationMs,
        "errors": [],
    }
    await db[COLLECTIONS["mappingJobs"]].insert_one(job_doc)


# ── Job Endpoints ─────────────────────────────────────────────────

@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get job status and progress."""
    db = get_async_db()
    doc = await db[COLLECTIONS["mappingJobs"]].find_one({"jobId": job_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, f"Job {job_id} not found")
    return doc


@router.get("/jobs/{job_id}/errors")
async def get_job_errors(job_id: str, skip: int = 0, limit: int = 100):
    """Get error details for a job."""
    db = get_async_db()
    doc = await db[COLLECTIONS["mappingJobs"]].find_one({"jobId": job_id}, {"_id": 0, "errors": 1})
    if not doc:
        raise HTTPException(404, f"Job {job_id} not found")
    errors = doc.get("errors", [])
    return {"errors": errors[skip:skip + limit], "total": len(errors)}


@router.get("/jobs/{job_id}/output")
async def get_job_output(job_id: str):
    """Download output file for a completed job."""
    db = get_async_db()
    doc = await db[COLLECTIONS["mappingJobs"]].find_one({"jobId": job_id})
    if not doc:
        raise HTTPException(404, f"Job {job_id} not found")
    if doc["status"] != JobStatus.COMPLETED.value:
        raise HTTPException(400, f"Job not completed. Status: {doc['status']}")

    output_path = doc.get("outputFilePath")
    if not output_path or not os.path.exists(output_path):
        raise HTTPException(404, "Output file not found")

    return FileResponse(output_path, filename=os.path.basename(output_path))


@router.delete("/jobs/{job_id}")
async def cancel_job(job_id: str):
    """Cancel a running job."""
    db = get_async_db()
    result = await db[COLLECTIONS["mappingJobs"]].update_one(
        {"jobId": job_id, "status": {"$in": [JobStatus.PENDING.value, JobStatus.RUNNING.value]}},
        {"$set": {"status": JobStatus.CANCELLED.value, "completedAt": datetime.now(timezone.utc)}}
    )
    if result.modified_count == 0:
        raise HTTPException(400, "Job not found or not in cancellable state")
    return {"jobId": job_id, "status": "CANCELLED"}


# ── CEL Utility Endpoints ────────────────────────────────────────

@router.post("/cel/validate")
async def validate_cel(req: CelValidateRequest) -> CelValidateResponse:
    """Validate a CEL expression against a schema."""
    evaluator = CelEvaluator()
    valid, error = evaluator.validate_expression(req.expression)
    return CelValidateResponse(valid=valid, error=error)


@router.post("/cel/evaluate")
async def evaluate_cel(req: CelEvaluateRequest) -> CelEvaluateResponse:
    """Evaluate a CEL expression against sample data."""
    evaluator = CelEvaluator()
    try:
        _, prog = evaluator.compile(req.expression)
        result = evaluator.evaluate(prog, req.data, params=req.params)
        return CelEvaluateResponse(
            result=result,
            resultType=type(result).__name__,
        )
    except Exception as e:
        return CelEvaluateResponse(result=None, resultType="error", error=str(e))


@router.get("/cel/functions")
async def list_cel_functions() -> List[CelFunctionDoc]:
    """List all available CEL functions with signatures."""
    return [CelFunctionDoc(**fn) for fn in FUNCTION_DOCS]


@router.post("/cel/suggest")
async def suggest_cel(req: CelSuggestRequest):
    """AI-powered: suggest CEL expression for a field mapping."""
    from services.mapping.ai_generator import MappingAiGenerator

    generator = MappingAiGenerator()
    result = await generator.suggest_field_mapping(
        target_field=req.targetField,
        target_type=req.targetType.value,
        source_schema=req.sourceSchema,
        sample_data=req.sampleData,
        existing_mappings=req.existingMappings,
        lookup_tables=req.lookupTables,
    )
    return result.model_dump()


# ── Lookup Table Endpoints ────────────────────────────────────────

@router.post("/lookups", status_code=201)
async def upload_lookup(
    file: UploadFile = File(...),
    name: str = Form(...),
    keyField: str = Form(...),
    description: Optional[str] = Form(None),
):
    """Upload a lookup table (CSV or JSON)."""
    file_path = await _save_upload(file)
    try:
        db = get_async_db()
        svc = LookupService(db)
        result = await svc.load_table_from_file(
            file_path, name, keyField, description=description,
        )
        return result
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@router.get("/lookups")
async def list_lookups():
    """List available lookup tables."""
    db = get_async_db()
    svc = LookupService(db)
    tables = await svc.list_tables()
    for t in tables:
        t.pop("_id", None)
    return tables


@router.get("/lookups/{table_id}")
async def get_lookup(table_id: str):
    """Get lookup table metadata."""
    db = get_async_db()
    svc = LookupService(db)
    table = await svc.get_table(table_id)
    if not table:
        raise HTTPException(404, f"Lookup table {table_id} not found")
    table.pop("_id", None)
    return table


@router.delete("/lookups/{table_id}", status_code=204)
async def delete_lookup(table_id: str):
    """Delete a lookup table."""
    db = get_async_db()
    svc = LookupService(db)
    deleted = await svc.delete_table(table_id)
    if not deleted:
        raise HTTPException(404, f"Lookup table {table_id} not found")
