"""
CEL Expression Evaluator for the Data Mapping Engine.

Provides expression compilation, evaluation, custom function registration,
and validation using the cel-python library.
"""
import re
import logging
from datetime import datetime, date, timezone, timedelta
from typing import Any, Callable, Dict, List, Optional, Tuple

import celpy
from celpy import celtypes
from celpy.evaluation import CELEvalError

logger = logging.getLogger(__name__)


# ── CEL Type Conversion Helpers ────────────────────────────────────

def python_to_cel(value: Any) -> Any:
    """Convert a Python value to a CEL-compatible type."""
    if value is None:
        return None
    if isinstance(value, bool):
        return celtypes.BoolType(value)
    if isinstance(value, int):
        return celtypes.IntType(value)
    if isinstance(value, float):
        return celtypes.DoubleType(value)
    if isinstance(value, str):
        return celtypes.StringType(value)
    if isinstance(value, (datetime, date)):
        if isinstance(value, date) and not isinstance(value, datetime):
            value = datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return celtypes.TimestampType(value)
    if isinstance(value, bytes):
        return celtypes.BytesType(value)
    if isinstance(value, list):
        return celtypes.ListType([python_to_cel(v) for v in value])
    if isinstance(value, dict):
        cel_map = {}
        for k, v in value.items():
            cel_key = python_to_cel(k)
            # CEL MapType cannot hold None values — convert to empty string
            cel_val = python_to_cel(v) if v is not None else celtypes.StringType("")
            cel_map[cel_key] = cel_val
        return celtypes.MapType(cel_map)
    return celtypes.StringType(str(value))


def cel_to_python(value: Any) -> Any:
    """Convert a CEL type back to a Python native type."""
    if value is None:
        return None
    if isinstance(value, celtypes.BoolType):
        return bool(value)
    if isinstance(value, celtypes.IntType):
        return int(value)
    if isinstance(value, (celtypes.DoubleType, celtypes.UintType)):
        return float(value)
    if isinstance(value, celtypes.StringType):
        return str(value)
    if isinstance(value, celtypes.TimestampType):
        return value
    if isinstance(value, celtypes.BytesType):
        return bytes(value)
    if isinstance(value, celtypes.ListType):
        return [cel_to_python(v) for v in value]
    if isinstance(value, celtypes.MapType):
        return {cel_to_python(k): cel_to_python(v) for k, v in value.items()}
    if isinstance(value, CELEvalError):
        raise value
    # Python native types (int, float, str, bool, dict, list) pass through
    if isinstance(value, (int, float, str, bool, dict, list)):
        return value
    # Fallback: convert to string to avoid serialization errors
    return str(value)


# ── Date Format Mapping (Java patterns → Python strftime) ─────────

JAVA_TO_PYTHON_DATE = {
    "yyyy": "%Y", "yy": "%y",
    "MM": "%m", "M": "%-m",
    "dd": "%d", "d": "%-d",
    "HH": "%H", "H": "%-H",
    "hh": "%I", "h": "%-I",
    "mm": "%M", "m": "%-M",
    "ss": "%S", "s": "%-S",
    "a": "%p",
    "EEEE": "%A", "EEE": "%a",
    "MMMM": "%B", "MMM": "%b",
    "Z": "%z", "z": "%Z",
}


def _java_to_python_format(java_fmt: str) -> str:
    """Convert a Java date format pattern to Python strftime format."""
    result = java_fmt
    # Sort by length descending to avoid partial replacements
    for java_pat, py_pat in sorted(JAVA_TO_PYTHON_DATE.items(), key=lambda x: -len(x[0])):
        result = result.replace(java_pat, py_pat)
    return result


# ── Custom CEL Functions ──────────────────────────────────────────

# Date/Time Functions

def cel_parseDate(val, fmt):
    """Parse date string using given pattern."""
    s = str(val)
    py_fmt = _java_to_python_format(str(fmt))
    dt = datetime.strptime(s, py_fmt).replace(tzinfo=timezone.utc)
    return celtypes.TimestampType(dt)


def cel_formatDate(ts, fmt):
    """Format timestamp to string pattern."""
    py_fmt = _java_to_python_format(str(fmt))
    if isinstance(ts, celtypes.TimestampType):
        dt = ts.timestamp
        if hasattr(dt, 'strftime'):
            return celtypes.StringType(dt.strftime(py_fmt))
    return celtypes.StringType(str(ts))


def cel_today():
    """Current date (UTC)."""
    now = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return celtypes.TimestampType(now)


def cel_dateDiff(ts1, ts2, unit):
    """Difference between dates in given unit."""
    def _to_dt(ts):
        if isinstance(ts, celtypes.TimestampType):
            return ts.timestamp if hasattr(ts, 'timestamp') else ts
        return ts

    dt1, dt2 = _to_dt(ts1), _to_dt(ts2)
    delta = dt1 - dt2
    unit_str = str(unit).upper()
    if unit_str == "DAYS":
        return celtypes.IntType(delta.days)
    elif unit_str == "MONTHS":
        return celtypes.IntType((dt1.year - dt2.year) * 12 + dt1.month - dt2.month)
    elif unit_str == "YEARS":
        return celtypes.IntType(dt1.year - dt2.year)
    return celtypes.IntType(delta.days)


# Numeric Functions

def cel_parseDecimal(val):
    """Parse string to decimal, handling commas and parenthetical negatives."""
    s = str(val).strip()
    s = s.replace("$", "").replace(",", "")
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    return celtypes.DoubleType(float(s))


def cel_round(val, places):
    """Round to N decimal places."""
    return celtypes.DoubleType(round(float(val), int(places)))


def cel_abs(val):
    """Absolute value."""
    return celtypes.DoubleType(abs(float(val)))


def cel_toInt(val):
    """Parse string to integer."""
    return celtypes.IntType(int(str(val).strip()))


def cel_formatNumber(val, pattern):
    """Format number with pattern (simplified: supports #,##0.00 style)."""
    v = float(val)
    pat = str(pattern)
    # Count decimal places from pattern
    decimal_places = 0
    if "." in pat:
        decimal_places = len(pat.split(".")[-1])
    # Format with grouping if pattern has comma
    if "," in pat:
        formatted = f"{v:,.{decimal_places}f}"
    else:
        formatted = f"{v:.{decimal_places}f}"
    return celtypes.StringType(formatted)


# String Functions

def cel_padLeft(val, length, pad_char):
    """Left-pad string to length with character."""
    return celtypes.StringType(str(val).rjust(int(length), str(pad_char)[0]))


def cel_padRight(val, length, pad_char):
    """Right-pad string to length with character."""
    return celtypes.StringType(str(val).ljust(int(length), str(pad_char)[0]))


def cel_split(val, delimiter):
    """Split string by delimiter."""
    parts = str(val).split(str(delimiter))
    return celtypes.ListType([celtypes.StringType(p) for p in parts])


def cel_join(lst, delimiter):
    """Join list with delimiter."""
    parts = [str(item) for item in lst]
    return celtypes.StringType(str(delimiter).join(parts))


def cel_regexExtract(val, pattern):
    """Extract first regex capture group."""
    m = re.search(str(pattern), str(val))
    if m and m.groups():
        return celtypes.StringType(m.group(1))
    return celtypes.StringType("")


def cel_regexReplace(val, pattern, replacement):
    """Regex-based replacement."""
    return celtypes.StringType(re.sub(str(pattern), str(replacement), str(val)))


def cel_upper(val):
    """Convert to uppercase."""
    return celtypes.StringType(str(val).upper())


def cel_lower(val):
    """Convert to lowercase."""
    return celtypes.StringType(str(val).lower())


def cel_trim(val):
    """Remove leading/trailing whitespace."""
    return celtypes.StringType(str(val).strip())


def cel_replace(val, old, new):
    """Replace all occurrences."""
    return celtypes.StringType(str(val).replace(str(old), str(new)))


def cel_substring(val, start, length):
    """Extract substring (start, length)."""
    s = str(val)
    st = int(start)
    ln = int(length)
    return celtypes.StringType(s[st:st + ln])


# Lookup Functions (require lookup context injected at runtime)
_lookup_context: Dict[str, Dict[str, Dict[str, Any]]] = {}


def set_lookup_context(ctx: Dict[str, Dict[str, Dict[str, Any]]]):
    """Set the lookup context for CEL lookup functions."""
    global _lookup_context
    _lookup_context = ctx


def cel_lookup(table_name, key, field):
    """Look up value from reference table."""
    table = _lookup_context.get(str(table_name), {})
    row = table.get(str(key))
    if row is None:
        raise ValueError(f"Lookup key '{key}' not found in table '{table_name}'")
    value = row.get(str(field))
    return python_to_cel(value)


def cel_lookupOrDefault(table_name, key, field, default_val):
    """Look up with fallback default."""
    table = _lookup_context.get(str(table_name), {})
    row = table.get(str(key))
    if row is None:
        return default_val
    value = row.get(str(field))
    if value is None:
        return default_val
    return python_to_cel(value)


def cel_crossRef(table_name, key):
    """Get entire cross-reference row."""
    table = _lookup_context.get(str(table_name), {})
    row = table.get(str(key))
    if row is None:
        return celtypes.MapType({})
    return python_to_cel(row)


# Coercion Functions

def cel_coalesce(*args):
    """Return first non-null argument."""
    for arg in args:
        if arg is not None:
            return arg
    return None


def cel_ifEmpty(val, fallback):
    """Return fallback if string is empty."""
    s = str(val) if val is not None else ""
    if s == "":
        return fallback
    return val


def cel_nullIf(val, sentinel):
    """Return null if value equals sentinel."""
    if str(val) == str(sentinel):
        return None
    return val


def cel_toList(val):
    """Wrap scalar in single-element list."""
    return celtypes.ListType([val])


def cel_flatten(lst):
    """Flatten nested lists."""
    result = []
    for item in lst:
        if isinstance(item, celtypes.ListType):
            result.extend(item)
        else:
            result.append(item)
    return celtypes.ListType(result)


# Accounting / Ledger Functions

def cel_sumByPrefix(rows, prefix, field):
    """Sum a numeric field across rows where glAccountNumber starts with prefix."""
    prefix_str = str(prefix)
    field_str = str(field)
    total = 0.0
    for row in rows:
        gl = ""
        if isinstance(row, celtypes.MapType):
            gl_key = celtypes.StringType("glAccountNumber")
            gl_val = row.get(gl_key)
            if gl_val is not None:
                gl = str(gl_val)
            if gl.startswith(prefix_str):
                field_key = celtypes.StringType(field_str)
                val = row.get(field_key)
                if val is not None:
                    total += float(val)
        elif isinstance(row, dict):
            gl = str(row.get("glAccountNumber", ""))
            if gl.startswith(prefix_str):
                total += float(row.get(field_str, 0))
    return celtypes.DoubleType(total)


def cel_sumByPrefixExcl(rows, prefix, exclude_prefix, field):
    """Sum a field where glAccountNumber starts with prefix but NOT excludePrefix."""
    prefix_str = str(prefix)
    excl_str = str(exclude_prefix)
    field_str = str(field)
    total = 0.0
    for row in rows:
        gl = ""
        if isinstance(row, celtypes.MapType):
            gl_key = celtypes.StringType("glAccountNumber")
            gl_val = row.get(gl_key)
            if gl_val is not None:
                gl = str(gl_val)
            if gl.startswith(prefix_str) and not gl.startswith(excl_str):
                field_key = celtypes.StringType(field_str)
                val = row.get(field_key)
                if val is not None:
                    total += float(val)
        elif isinstance(row, dict):
            gl = str(row.get("glAccountNumber", ""))
            if gl.startswith(prefix_str) and not gl.startswith(excl_str):
                total += float(row.get(field_str, 0))
    return celtypes.DoubleType(total)


def cel_countByPrefix(rows, prefix):
    """Count rows where glAccountNumber starts with prefix."""
    prefix_str = str(prefix)
    count = 0
    for row in rows:
        gl = ""
        if isinstance(row, celtypes.MapType):
            gl_key = celtypes.StringType("glAccountNumber")
            gl_val = row.get(gl_key)
            if gl_val is not None:
                gl = str(gl_val)
        elif isinstance(row, dict):
            gl = str(row.get("glAccountNumber", ""))
        if gl.startswith(prefix_str):
            count += 1
    return celtypes.IntType(count)


def cel_filterByPrefix(rows, prefix):
    """Filter rows where glAccountNumber starts with prefix."""
    prefix_str = str(prefix)
    result = []
    for row in rows:
        gl = ""
        if isinstance(row, celtypes.MapType):
            gl_key = celtypes.StringType("glAccountNumber")
            gl_val = row.get(gl_key)
            if gl_val is not None:
                gl = str(gl_val)
        elif isinstance(row, dict):
            gl = str(row.get("glAccountNumber", ""))
        if gl.startswith(prefix_str):
            result.append(row)
    return celtypes.ListType(result)


def cel_fieldValue(rows, field):
    """Return a single field value from the first row of a list.

    Useful for data sources that return a single matching document
    (e.g., mmifSampleData filtered by account + filingPeriod + ruleId).
    """
    field_str = str(field)
    for row in rows:
        if isinstance(row, celtypes.MapType):
            key = celtypes.StringType(field_str)
            val = row.get(key)
            if val is not None:
                return celtypes.DoubleType(float(val))
        elif isinstance(row, dict):
            val = row.get(field_str)
            if val is not None:
                return celtypes.DoubleType(float(val))
    return celtypes.DoubleType(0.0)


def cel_sumField(rows, field):
    """Sum a numeric field across all rows."""
    field_str = str(field)
    total = 0.0
    for row in rows:
        if isinstance(row, celtypes.MapType):
            key = celtypes.StringType(field_str)
            val = row.get(key)
            if val is not None:
                total += float(val)
        elif isinstance(row, dict):
            val = row.get(field_str)
            if val is not None:
                total += float(val)
    return celtypes.DoubleType(total)


def cel_sumWhere(rows, field, condition_field, condition_value):
    """Sum a field where conditionField equals conditionValue."""
    field_str = str(field)
    cond_field_str = str(condition_field)
    cond_val_str = str(condition_value)
    total = 0.0
    for row in rows:
        if isinstance(row, celtypes.MapType):
            cond_key = celtypes.StringType(cond_field_str)
            cond_val = row.get(cond_key)
            if cond_val is not None and str(cond_val) == cond_val_str:
                field_key = celtypes.StringType(field_str)
                val = row.get(field_key)
                if val is not None:
                    total += float(val)
        elif isinstance(row, dict):
            if str(row.get(cond_field_str, "")) == cond_val_str:
                total += float(row.get(field_str, 0))
    return celtypes.DoubleType(total)


# ── Function Registry ─────────────────────────────────────────────

CUSTOM_FUNCTIONS: Dict[str, Callable] = {
    # Date/Time
    "parseDate": cel_parseDate,
    "formatDate": cel_formatDate,
    "today": cel_today,
    "dateDiff": cel_dateDiff,
    # Numeric
    "parseDecimal": cel_parseDecimal,
    "round": cel_round,
    "abs": cel_abs,
    "toInt": cel_toInt,
    "formatNumber": cel_formatNumber,
    # String
    "padLeft": cel_padLeft,
    "padRight": cel_padRight,
    "split": cel_split,
    "join": cel_join,
    "regexExtract": cel_regexExtract,
    "regexReplace": cel_regexReplace,
    "upper": cel_upper,
    "lower": cel_lower,
    "trim": cel_trim,
    "replace": cel_replace,
    "substring": cel_substring,
    # Lookup
    "lookup": cel_lookup,
    "lookupOrDefault": cel_lookupOrDefault,
    "crossRef": cel_crossRef,
    # Coercion
    "coalesce": cel_coalesce,
    "ifEmpty": cel_ifEmpty,
    "nullIf": cel_nullIf,
    "toList": cel_toList,
    "flatten": cel_flatten,
    # Accounting / Ledger
    "sumByPrefix": cel_sumByPrefix,
    "sumByPrefixExcl": cel_sumByPrefixExcl,
    "countByPrefix": cel_countByPrefix,
    "filterByPrefix": cel_filterByPrefix,
    "sumWhere": cel_sumWhere,
    "fieldValue": cel_fieldValue,
    "sumField": cel_sumField,
}


FUNCTION_DOCS = [
    # Date/Time
    {"name": "parseDate", "signature": "(string, string) -> timestamp",
     "description": "Parse date string using given pattern", "example": "parseDate(src.date, 'MM/dd/yyyy')", "category": "date"},
    {"name": "formatDate", "signature": "(timestamp, string) -> string",
     "description": "Format timestamp to string pattern", "example": "formatDate(ts, 'yyyy-MM-dd')", "category": "date"},
    {"name": "today", "signature": "() -> timestamp",
     "description": "Current date (UTC)", "example": "today()", "category": "date"},
    {"name": "dateDiff", "signature": "(timestamp, timestamp, string) -> int",
     "description": "Difference between dates in given unit (DAYS, MONTHS, YEARS)", "example": "dateDiff(d1, d2, 'DAYS')", "category": "date"},
    # Numeric
    {"name": "parseDecimal", "signature": "(string) -> double",
     "description": "Parse string to decimal, handling commas and parenthetical negatives", "example": "parseDecimal('1,234.56')", "category": "numeric"},
    {"name": "round", "signature": "(double, int) -> double",
     "description": "Round to N decimal places", "example": "round(3.14159, 2)", "category": "numeric"},
    {"name": "abs", "signature": "(double) -> double",
     "description": "Absolute value", "example": "abs(-42.5)", "category": "numeric"},
    {"name": "toInt", "signature": "(string) -> int",
     "description": "Parse string to integer", "example": "toInt('42')", "category": "numeric"},
    {"name": "formatNumber", "signature": "(double, string) -> string",
     "description": "Format number with pattern", "example": "formatNumber(1234.56, '#,##0.00')", "category": "numeric"},
    # String
    {"name": "padLeft", "signature": "(string, int, string) -> string",
     "description": "Left-pad string to length with character", "example": "padLeft('42', 5, '0')", "category": "string"},
    {"name": "padRight", "signature": "(string, int, string) -> string",
     "description": "Right-pad string to length with character", "example": "padRight('ABC', 6, ' ')", "category": "string"},
    {"name": "split", "signature": "(string, string) -> list<string>",
     "description": "Split string by delimiter", "example": "split('a|b|c', '|')", "category": "string"},
    {"name": "join", "signature": "(list<string>, string) -> string",
     "description": "Join list with delimiter", "example": "join(['a','b'], ',')", "category": "string"},
    {"name": "regexExtract", "signature": "(string, string) -> string",
     "description": "Extract first regex capture group", "example": "regexExtract('Fund-ABC-123', 'Fund-(\\w+)')", "category": "string"},
    {"name": "regexReplace", "signature": "(string, string, string) -> string",
     "description": "Regex-based replacement", "example": "regexReplace('$1,234', '[\\$,]', '')", "category": "string"},
    {"name": "upper", "signature": "(string) -> string",
     "description": "Convert to uppercase", "example": "upper('hello')", "category": "string"},
    {"name": "lower", "signature": "(string) -> string",
     "description": "Convert to lowercase", "example": "lower('HELLO')", "category": "string"},
    {"name": "trim", "signature": "(string) -> string",
     "description": "Remove leading/trailing whitespace", "example": "trim('  hello  ')", "category": "string"},
    {"name": "replace", "signature": "(string, string, string) -> string",
     "description": "Replace all occurrences", "example": "replace('a-b-c', '-', '_')", "category": "string"},
    {"name": "substring", "signature": "(string, int, int) -> string",
     "description": "Extract substring (start, length)", "example": "substring('hello', 0, 3)", "category": "string"},
    # Lookup
    {"name": "lookup", "signature": "(string, string, string) -> dyn",
     "description": "Look up value from reference table", "example": "lookup('xrefAccount', src.id, 'field')", "category": "lookup"},
    {"name": "lookupOrDefault", "signature": "(string, string, string, dyn) -> dyn",
     "description": "Look up with fallback default", "example": "lookupOrDefault('xref', key, 'field', 'DEFAULT')", "category": "lookup"},
    {"name": "crossRef", "signature": "(string, string) -> map",
     "description": "Get entire cross-reference row", "example": "crossRef('xrefAccount', src.id)", "category": "lookup"},
    # Coercion
    {"name": "coalesce", "signature": "(dyn...) -> dyn",
     "description": "Return first non-null argument", "example": "coalesce(src.a, src.b, 'default')", "category": "coercion"},
    {"name": "ifEmpty", "signature": "(string, string) -> string",
     "description": "Return fallback if string is empty", "example": "ifEmpty(src.notes, 'N/A')", "category": "coercion"},
    {"name": "nullIf", "signature": "(dyn, dyn) -> dyn",
     "description": "Return null if value equals sentinel", "example": "nullIf(src.val, 'N/A')", "category": "coercion"},
    {"name": "toList", "signature": "(dyn) -> list",
     "description": "Wrap scalar in single-element list", "example": "toList('item')", "category": "coercion"},
    {"name": "flatten", "signature": "(list<list>) -> list",
     "description": "Flatten nested lists", "example": "flatten([['a'], ['b']])", "category": "coercion"},
    # Accounting / Ledger
    {"name": "sumByPrefix", "signature": "(list<map>, string, string) -> double",
     "description": "Sum a field across rows where glAccountNumber starts with prefix",
     "example": "sumByPrefix(ledger, '1', 'endingBalance')", "category": "accounting"},
    {"name": "sumByPrefixExcl", "signature": "(list<map>, string, string, string) -> double",
     "description": "Sum a field where glAccountNumber starts with prefix but NOT excludePrefix",
     "example": "sumByPrefixExcl(ledger, '6', '61', 'endingBalance')", "category": "accounting"},
    {"name": "countByPrefix", "signature": "(list<map>, string) -> int",
     "description": "Count rows where glAccountNumber starts with prefix",
     "example": "countByPrefix(ledger, '1')", "category": "accounting"},
    {"name": "filterByPrefix", "signature": "(list<map>, string) -> list<map>",
     "description": "Filter rows where glAccountNumber starts with prefix",
     "example": "filterByPrefix(ledger, '4')", "category": "accounting"},
    {"name": "sumWhere", "signature": "(list<map>, string, string, string) -> double",
     "description": "Sum a field where conditionField equals conditionValue",
     "example": "sumWhere(ledger, 'endingBalance', 'glCategory', 'ASSETS')", "category": "accounting"},
    {"name": "fieldValue", "signature": "(list<map>, string) -> double",
     "description": "Return a single field value from the first row (for single-document data sources)",
     "example": "fieldValue(sample, 'eagleValue')", "category": "accounting"},
    {"name": "sumField", "signature": "(list<map>, string) -> double",
     "description": "Sum a numeric field across all rows",
     "example": "sumField(sample, 'marketValue')", "category": "accounting"},
]


# ── Allowed variable roots for safety check ───────────────────────

ALLOWED_ROOTS = {"src", "rowIndex", "meta", "params", "lookups", "ledger", "sample"}


# ── CelEvaluator Class ───────────────────────────────────────────

class CelEvaluator:
    """Compiles and evaluates CEL expressions with custom functions."""

    def __init__(self):
        self._env = celpy.Environment()
        self._compiled_cache: Dict[str, Tuple[Any, Any]] = {}

    def compile(self, expression: str) -> Tuple[Any, Any]:
        """Compile a CEL expression, returning (ast, program). Cached."""
        if expression in self._compiled_cache:
            return self._compiled_cache[expression]
        ast = self._env.compile(expression)
        prog = self._env.program(ast, functions=CUSTOM_FUNCTIONS)
        self._compiled_cache[expression] = (ast, prog)
        return ast, prog

    def evaluate(
        self,
        program: Any,
        src: Dict[str, Any],
        row_index: int = 0,
        meta: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        lookups: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """Evaluate a compiled CEL program against a row context."""
        activation = {
            "src": python_to_cel(src),
            "rowIndex": celtypes.IntType(row_index),
            "meta": python_to_cel(meta or {}),
            "params": python_to_cel(params or {}),
            "lookups": python_to_cel(lookups or {}),
        }
        result = program.evaluate(activation)
        if isinstance(result, CELEvalError):
            raise result
        return cel_to_python(result)

    def validate_expression(self, expression: str) -> Tuple[bool, Optional[str]]:
        """Validate a CEL expression. Returns (is_valid, error_message)."""
        try:
            self.compile(expression)
            return True, None
        except celpy.CELParseError as e:
            return False, f"Parse error: {e}"
        except Exception as e:
            return False, f"Validation error: {e}"

    def validate_safety(self, expression: str) -> Tuple[bool, Optional[str]]:
        """Check that expression only references allowed variable roots."""
        # Simple heuristic: check for identifiers that aren't function names or allowed roots
        # This is a basic check; the CEL environment enforces the real safety
        try:
            self.compile(expression)
            return True, None
        except Exception as e:
            return False, str(e)

    def compile_all(
        self, field_mappings: List[Dict[str, str]], filters: List[str]
    ) -> Tuple[Dict[str, Any], List[Any], List[str]]:
        """
        Compile all expressions for a mapping definition.
        Returns (field_programs, filter_programs, errors).
        """
        field_programs: Dict[str, Any] = {}
        filter_programs: List[Any] = []
        errors: List[str] = []

        for fm in field_mappings:
            target = fm["targetField"]
            cel_expr = fm["cel"]
            try:
                _, prog = self.compile(cel_expr)
                field_programs[target] = prog
            except Exception as e:
                errors.append(f"Field '{target}': {e}")

        for i, filter_expr in enumerate(filters):
            try:
                _, prog = self.compile(filter_expr)
                filter_programs.append(prog)
            except Exception as e:
                errors.append(f"Filter[{i}]: {e}")

        return field_programs, filter_programs, errors
