"""
Target file writers for the Data Mapping Engine.

Each writer serializes evaluated row dicts to the target format.
"""
import csv
import json
import logging
from abc import ABC, abstractmethod
from datetime import datetime, date
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class TargetWriter(ABC):
    """Base class for target file writers."""

    @abstractmethod
    def write(self, rows: List[Dict[str, Any]], output_path: str, options: Dict[str, Any],
              field_names: Optional[List[str]] = None) -> str:
        """Write rows to target file. Returns the output file path."""
        ...


class CsvWriter(TargetWriter):
    """CSV output writer."""

    def write(self, rows: List[Dict[str, Any]], output_path: str, options: Dict[str, Any],
              field_names: Optional[List[str]] = None) -> str:
        delimiter = options.get("delimiter", ",")
        encoding = options.get("encoding", "UTF-8")

        if not rows:
            Path(output_path).write_text("", encoding=encoding)
            return output_path

        headers = field_names or list(rows[0].keys())

        with open(output_path, "w", newline="", encoding=encoding) as f:
            writer = csv.DictWriter(f, fieldnames=headers, delimiter=delimiter,
                                    extrasaction="ignore")
            writer.writeheader()
            for row in rows:
                writer.writerow({k: _serialize_value(v) for k, v in row.items()})

        return output_path


class JsonWriter(TargetWriter):
    """JSON output writer."""

    def write(self, rows: List[Dict[str, Any]], output_path: str, options: Dict[str, Any],
              field_names: Optional[List[str]] = None) -> str:
        pretty = options.get("prettyPrint", False)
        array_wrapper = options.get("arrayWrapper", True)
        encoding = options.get("encoding", "UTF-8")

        serializable_rows = [_make_serializable(row) for row in rows]
        output = serializable_rows if array_wrapper else (serializable_rows[0] if serializable_rows else {})

        with open(output_path, "w", encoding=encoding) as f:
            json.dump(output, f, indent=2 if pretty else None, default=str)

        return output_path


class ExcelWriter(TargetWriter):
    """Excel XLSX output writer using openpyxl."""

    def write(self, rows: List[Dict[str, Any]], output_path: str, options: Dict[str, Any],
              field_names: Optional[List[str]] = None) -> str:
        from openpyxl import Workbook

        sheet_name = options.get("sheetName", "Sheet1")
        wb = Workbook()
        ws = wb.active
        ws.title = sheet_name

        if not rows:
            wb.save(output_path)
            return output_path

        headers = field_names or list(rows[0].keys())
        ws.append(headers)

        for row in rows:
            ws.append([_serialize_value(row.get(h)) for h in headers])

        wb.save(output_path)
        return output_path


# ── Writer Factory ────────────────────────────────────────────────

WRITERS = {
    "CSV": CsvWriter,
    "TSV": CsvWriter,
    "JSON": JsonWriter,
    "EXCEL": ExcelWriter,
}


def get_writer(format_name: str) -> TargetWriter:
    """Get a writer instance for the given format."""
    writer_cls = WRITERS.get(format_name.upper())
    if writer_cls is None:
        raise ValueError(f"Unsupported target format: {format_name}")
    return writer_cls()


# ── Helpers ───────────────────────────────────────────────────────

def _serialize_value(value: Any) -> Any:
    """Convert a value to a serializable form."""
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=str)
    return value


def _make_serializable(row: Dict[str, Any]) -> Dict[str, Any]:
    """Make a row dict JSON-serializable."""
    result = {}
    for k, v in row.items():
        if isinstance(v, (datetime, date)):
            result[k] = v.isoformat()
        elif isinstance(v, bytes):
            result[k] = v.decode("utf-8", errors="replace")
        else:
            result[k] = v
    return result
