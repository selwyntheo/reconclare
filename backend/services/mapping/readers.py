"""
Source file readers for the Data Mapping Engine.

Each reader normalizes input rows into dict[str, Any] for CEL evaluation.
"""
import json
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)


class SourceReader(ABC):
    """Base class for source file readers."""

    @abstractmethod
    def read(self, file_path: str, options: Dict[str, Any]) -> Iterator[Dict[str, Any]]:
        """Read rows from a source file, yielding dicts."""
        ...

    @abstractmethod
    def count_rows(self, file_path: str, options: Dict[str, Any]) -> Optional[int]:
        """Return total row count if available, else None."""
        ...

    @abstractmethod
    def infer_schema(self, file_path: str, options: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Infer field schemas from a sample of the file."""
        ...


class CsvReader(SourceReader):
    """CSV/TSV reader using pandas."""

    def read(self, file_path: str, options: Dict[str, Any]) -> Iterator[Dict[str, Any]]:
        delimiter = options.get("delimiter", ",")
        quote_char = options.get("quoteChar", '"')
        has_header = options.get("hasHeader", True)
        skip_rows = options.get("skipRows", 0)
        null_values = options.get("nullValues", [""])
        encoding = options.get("encoding", "UTF-8")
        trim_values = options.get("trimValues", True)

        df = pd.read_csv(
            file_path,
            sep=delimiter,
            quotechar=quote_char,
            header=0 if has_header else None,
            skiprows=skip_rows if skip_rows > 0 else None,
            na_values=null_values,
            keep_default_na=False,
            encoding=encoding,
            dtype=str,
        )

        if not has_header:
            df.columns = [f"col_{i}" for i in range(len(df.columns))]

        for _, row in df.iterrows():
            record = {}
            for col in df.columns:
                val = row[col]
                if pd.isna(val):
                    record[col] = None
                elif trim_values and isinstance(val, str):
                    record[col] = val.strip()
                else:
                    record[col] = val
            yield record

    def count_rows(self, file_path: str, options: Dict[str, Any]) -> Optional[int]:
        skip_rows = options.get("skipRows", 0)
        has_header = options.get("hasHeader", True)
        with open(file_path, "r", encoding=options.get("encoding", "UTF-8")) as f:
            total = sum(1 for _ in f)
        return total - skip_rows - (1 if has_header else 0)

    def infer_schema(self, file_path: str, options: Dict[str, Any]) -> List[Dict[str, Any]]:
        delimiter = options.get("delimiter", ",")
        encoding = options.get("encoding", "UTF-8")
        has_header = options.get("hasHeader", True)

        df = pd.read_csv(
            file_path, sep=delimiter, header=0 if has_header else None,
            nrows=100, encoding=encoding, dtype=str, keep_default_na=False,
        )
        if not has_header:
            df.columns = [f"col_{i}" for i in range(len(df.columns))]

        fields = []
        for col in df.columns:
            samples = df[col].dropna().head(5).tolist()
            inferred_type = _infer_field_type(samples)
            null_count = int(df[col].isna().sum())
            distinct_count = int(df[col].nunique())
            fields.append({
                "name": col,
                "inferredType": inferred_type,
                "sampleValues": samples,
                "nullCount": null_count,
                "distinctCount": distinct_count,
            })
        return fields


class JsonReader(SourceReader):
    """JSON array reader with optional root path navigation."""

    def read(self, file_path: str, options: Dict[str, Any]) -> Iterator[Dict[str, Any]]:
        root_path = options.get("rootPath", "$")

        with open(file_path, "r", encoding=options.get("encoding", "UTF-8")) as f:
            data = json.load(f)

        records = _navigate_json_path(data, root_path)
        if not isinstance(records, list):
            records = [records]

        for record in records:
            if isinstance(record, dict):
                yield {k: _json_value(v) for k, v in record.items()}
            else:
                yield {"value": record}

    def count_rows(self, file_path: str, options: Dict[str, Any]) -> Optional[int]:
        root_path = options.get("rootPath", "$")
        with open(file_path, "r", encoding=options.get("encoding", "UTF-8")) as f:
            data = json.load(f)
        records = _navigate_json_path(data, root_path)
        return len(records) if isinstance(records, list) else 1

    def infer_schema(self, file_path: str, options: Dict[str, Any]) -> List[Dict[str, Any]]:
        rows = list(self.read(file_path, options))
        sample = rows[:100]
        if not sample:
            return []

        all_keys = set()
        for row in sample:
            all_keys.update(row.keys())

        fields = []
        for key in sorted(all_keys):
            samples = [row.get(key) for row in sample[:5] if row.get(key) is not None]
            str_samples = [str(s) for s in samples]
            fields.append({
                "name": key,
                "inferredType": _infer_field_type(str_samples),
                "sampleValues": samples[:5],
                "nullCount": sum(1 for row in sample if row.get(key) is None),
                "distinctCount": len(set(str(row.get(key, "")) for row in sample)),
            })
        return fields


class ExcelReader(SourceReader):
    """Excel reader using openpyxl."""

    def read(self, file_path: str, options: Dict[str, Any]) -> Iterator[Dict[str, Any]]:
        sheet_name = options.get("sheetName", None)
        sheet_index = options.get("sheetIndex", 0)
        header_row = options.get("headerRow", 0)
        data_start_row = options.get("dataStartRow", 1)
        null_values = set(options.get("nullValues", [""]))

        target_sheet = sheet_name if sheet_name else sheet_index
        df = pd.read_excel(
            file_path,
            sheet_name=target_sheet,
            header=header_row,
            skiprows=range(header_row + 1, data_start_row) if data_start_row > header_row + 1 else None,
            dtype=str,
            engine="openpyxl",
        )

        for _, row in df.iterrows():
            record = {}
            for col in df.columns:
                val = row[col]
                if pd.isna(val) or str(val) in null_values:
                    record[str(col)] = None
                else:
                    record[str(col)] = str(val).strip()
            yield record

    def count_rows(self, file_path: str, options: Dict[str, Any]) -> Optional[int]:
        sheet_name = options.get("sheetName", None)
        sheet_index = options.get("sheetIndex", 0)
        target_sheet = sheet_name if sheet_name else sheet_index
        df = pd.read_excel(file_path, sheet_name=target_sheet, engine="openpyxl")
        return len(df)

    def infer_schema(self, file_path: str, options: Dict[str, Any]) -> List[Dict[str, Any]]:
        sheet_name = options.get("sheetName", None)
        sheet_index = options.get("sheetIndex", 0)
        target_sheet = sheet_name if sheet_name else sheet_index

        df = pd.read_excel(
            file_path, sheet_name=target_sheet, nrows=100,
            dtype=str, engine="openpyxl",
        )

        fields = []
        for col in df.columns:
            samples = df[str(col)].dropna().head(5).tolist()
            fields.append({
                "name": str(col),
                "inferredType": _infer_field_type([str(s) for s in samples]),
                "sampleValues": samples,
                "nullCount": int(df[str(col)].isna().sum()),
                "distinctCount": int(df[str(col)].nunique()),
            })
        return fields


# ── Reader Factory ────────────────────────────────────────────────

READERS = {
    "CSV": CsvReader,
    "TSV": CsvReader,
    "JSON": JsonReader,
    "EXCEL": ExcelReader,
}


def get_reader(format_name: str) -> SourceReader:
    """Get a reader instance for the given format."""
    reader_cls = READERS.get(format_name.upper())
    if reader_cls is None:
        raise ValueError(f"Unsupported source format: {format_name}")
    return reader_cls()


# ── Helpers ───────────────────────────────────────────────────────

def _navigate_json_path(data: Any, path: str) -> Any:
    """Simple JSONPath-like navigation (supports $.field.field and $ root)."""
    if path == "$" or path == "":
        return data
    parts = path.lstrip("$").lstrip(".").split(".")
    current = data
    for part in parts:
        if not part:
            continue
        if isinstance(current, dict):
            current = current[part]
        elif isinstance(current, list) and part.isdigit():
            current = current[int(part)]
        else:
            raise ValueError(f"Cannot navigate path '{path}' at '{part}'")
    return current


def _json_value(v: Any) -> Any:
    """Convert JSON value to string for consistent CEL evaluation."""
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        return v
    return str(v)


def _infer_field_type(samples: List[str]) -> str:
    """Infer field type from sample string values."""
    if not samples:
        return "STRING"

    # Check if all are integers
    try:
        for s in samples:
            if s:
                int(s.replace(",", ""))
        return "INT"
    except (ValueError, AttributeError):
        pass

    # Check if all are decimals
    try:
        for s in samples:
            if s:
                float(s.replace(",", "").replace("$", "").replace("(", "").replace(")", ""))
        return "DECIMAL"
    except (ValueError, AttributeError):
        pass

    # Check if all look like dates
    import re
    date_pattern = re.compile(r"^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$")
    if all(date_pattern.match(str(s)) for s in samples if s):
        return "DATE"

    # Check booleans
    bool_vals = {"true", "false", "yes", "no", "y", "n", "1", "0"}
    if all(str(s).lower() in bool_vals for s in samples if s):
        return "BOOL"

    return "STRING"
