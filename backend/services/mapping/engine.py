"""
Mapping Engine — orchestrates the read → filter → evaluate → write pipeline.
"""
import logging
import os
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from config.settings import settings
from .cel_evaluator import CelEvaluator, set_lookup_context
from .readers import get_reader
from .writers import get_writer
from .schemas import (
    MappingDefinition, MappingJob, JobStatus, JobProgress,
    RowError, ErrorStrategy, ExecutionSummary,
)

logger = logging.getLogger(__name__)


class MappingEngine:
    """Executes a mapping definition: read source → evaluate CEL → write target."""

    def __init__(self):
        self._evaluator = CelEvaluator()

    def compile(self, mapping: MappingDefinition) -> Dict[str, Any]:
        """
        Compile all CEL expressions for a mapping definition.
        Returns compilation result with field_programs, filter_programs, and errors.
        """
        field_defs = [{"targetField": fm.targetField, "cel": fm.cel} for fm in mapping.fieldMappings]
        filter_exprs = [f.cel for f in mapping.filters]

        field_programs, filter_programs, errors = self._evaluator.compile_all(field_defs, filter_exprs)

        return {
            "field_programs": field_programs,
            "filter_programs": filter_programs,
            "errors": errors,
        }

    def execute(
        self,
        mapping: MappingDefinition,
        input_file: str,
        output_dir: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
        lookup_context: Optional[Dict[str, Dict[str, Dict[str, Any]]]] = None,
    ) -> ExecutionSummary:
        """
        Execute a mapping: read input, evaluate CEL per row, write output.
        Returns an ExecutionSummary.
        """
        start_time = time.time()
        job_id = f"job_{uuid4().hex[:12]}"

        # Set lookup context for CEL functions
        if lookup_context:
            set_lookup_context(lookup_context)

        # Compile expressions
        compiled = self.compile(mapping)
        if compiled["errors"]:
            return ExecutionSummary(
                jobId=job_id,
                mappingId=mapping.mappingId or "",
                status=JobStatus.FAILED,
                rowsProcessed=0,
                rowsSkipped=0,
                errorCount=len(compiled["errors"]),
                durationMs=int((time.time() - start_time) * 1000),
            )

        field_programs = compiled["field_programs"]
        filter_programs = compiled["filter_programs"]

        # Setup reader and writer
        reader = get_reader(mapping.source.format.value)
        writer = get_writer(mapping.target.format.value)
        source_options = mapping.source.options.model_dump()
        target_options = mapping.target.options.model_dump()

        # Determine output path
        if output_dir is None:
            output_dir = settings.MAPPING_DATA_DIR
        os.makedirs(output_dir, exist_ok=True)

        ext_map = {"CSV": ".csv", "TSV": ".tsv", "JSON": ".json", "EXCEL": ".xlsx"}
        ext = ext_map.get(mapping.target.format.value, ".out")
        output_path = os.path.join(output_dir, f"{job_id}{ext}")

        # Build file metadata
        meta = {
            "fileName": os.path.basename(input_file),
            "fileDate": datetime.now(timezone.utc).isoformat(),
            "encoding": mapping.source.encoding,
        }

        # Error handling config
        error_handling = mapping.errorHandling
        on_field_error = error_handling.onFieldError
        on_row_error = error_handling.onRowError
        max_errors = error_handling.maxErrorCount
        defaults = error_handling.defaults

        # Process rows
        output_rows: List[Dict[str, Any]] = []
        errors: List[RowError] = []
        rows_processed = 0
        rows_skipped = 0

        try:
            for row_index, src_row in enumerate(reader.read(input_file, source_options)):
                # Check max error count
                if len(errors) >= max_errors:
                    if on_row_error == ErrorStrategy.FAIL_FAST:
                        break
                    elif on_row_error != ErrorStrategy.COLLECT_ERRORS:
                        break

                # Apply filters
                filtered = False
                for filter_prog in filter_programs:
                    try:
                        result = self._evaluator.evaluate(
                            filter_prog, src_row, row_index, meta, params
                        )
                        if not result:
                            filtered = True
                            break
                    except Exception as e:
                        logger.warning(f"Filter error on row {row_index}: {e}")
                        filtered = True
                        break

                if filtered:
                    rows_skipped += 1
                    continue

                # Evaluate field mappings
                target_row: Dict[str, Any] = {}
                row_has_error = False

                for target_field, program in field_programs.items():
                    try:
                        value = self._evaluator.evaluate(
                            program, src_row, row_index, meta, params
                        )
                        target_row[target_field] = value
                    except Exception as e:
                        row_has_error = True
                        error = RowError(
                            rowIndex=row_index,
                            sourceRow=src_row,
                            targetField=target_field,
                            celExpression=next(
                                (fm.cel for fm in mapping.fieldMappings if fm.targetField == target_field),
                                None
                            ),
                            errorType="EVALUATION_ERROR",
                            errorMessage=str(e),
                        )
                        errors.append(error)

                        if on_field_error == ErrorStrategy.FAIL_FAST:
                            break
                        elif on_field_error == ErrorStrategy.USE_DEFAULT:
                            target_row[target_field] = defaults.get(target_field)
                        # SKIP_AND_LOG and COLLECT_ERRORS: field left out

                if row_has_error and on_row_error == ErrorStrategy.FAIL_FAST:
                    break

                if row_has_error and on_row_error == ErrorStrategy.SKIP_AND_LOG:
                    rows_skipped += 1
                    continue

                output_rows.append(target_row)
                rows_processed += 1

        except Exception as e:
            logger.error(f"Mapping execution error: {e}")
            errors.append(RowError(
                rowIndex=rows_processed,
                errorType="EXECUTION_ERROR",
                errorMessage=str(e),
            ))

        # Write output
        field_names = [fm.targetField for fm in mapping.fieldMappings]
        try:
            writer.write(output_rows, output_path, target_options, field_names)
        except Exception as e:
            logger.error(f"Output write error: {e}")
            return ExecutionSummary(
                jobId=job_id,
                mappingId=mapping.mappingId or "",
                status=JobStatus.FAILED,
                rowsProcessed=rows_processed,
                rowsSkipped=rows_skipped,
                errorCount=len(errors),
                durationMs=int((time.time() - start_time) * 1000),
            )

        duration_ms = int((time.time() - start_time) * 1000)
        status = JobStatus.COMPLETED if not errors else (
            JobStatus.FAILED if on_row_error == ErrorStrategy.FAIL_FAST and errors else JobStatus.COMPLETED
        )

        return ExecutionSummary(
            jobId=job_id,
            mappingId=mapping.mappingId or "",
            status=status,
            rowsProcessed=rows_processed,
            rowsSkipped=rows_skipped,
            errorCount=len(errors),
            durationMs=duration_ms,
            outputPath=output_path,
        )

    def preview(
        self,
        mapping: MappingDefinition,
        sample_data: List[Dict[str, Any]],
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Preview mapping results on sample data without writing to file."""
        compiled = self.compile(mapping)
        if compiled["errors"]:
            return [{"errors": compiled["errors"]}]

        field_programs = compiled["field_programs"]
        filter_programs = compiled["filter_programs"]
        meta = {"fileName": "preview", "fileDate": datetime.now(timezone.utc).isoformat()}

        results = []
        for row_index, src_row in enumerate(sample_data):
            # Apply filters
            filtered = False
            for filter_prog in filter_programs:
                try:
                    result = self._evaluator.evaluate(filter_prog, src_row, row_index, meta, params)
                    if not result:
                        filtered = True
                        break
                except Exception:
                    filtered = True
                    break

            if filtered:
                results.append({"sourceRow": src_row, "targetRow": None, "filtered": True, "errors": []})
                continue

            target_row = {}
            row_errors = []
            for target_field, program in field_programs.items():
                try:
                    value = self._evaluator.evaluate(program, src_row, row_index, meta, params)
                    target_row[target_field] = value
                except Exception as e:
                    row_errors.append(f"{target_field}: {e}")

            results.append({
                "sourceRow": src_row,
                "targetRow": target_row,
                "filtered": False,
                "errors": row_errors,
            })

        return results
