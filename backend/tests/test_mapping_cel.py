"""
Unit tests for CEL evaluator: custom functions, expression compilation, evaluation, error handling.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from services.mapping.cel_evaluator import (
    CelEvaluator, python_to_cel, cel_to_python,
    cel_parseDecimal, cel_round, cel_abs, cel_toInt, cel_formatNumber,
    cel_padLeft, cel_padRight, cel_split, cel_join,
    cel_regexExtract, cel_regexReplace,
    cel_coalesce, cel_ifEmpty, cel_nullIf, cel_toList, cel_flatten,
    cel_upper, cel_lower, cel_trim,
    set_lookup_context, cel_lookup, cel_lookupOrDefault, cel_crossRef,
    CUSTOM_FUNCTIONS,
)
from celpy import celtypes


# ── Type Conversion Tests ─────────────────────────────────────────

class TestTypeConversion:
    def test_python_to_cel_string(self):
        result = python_to_cel("hello")
        assert isinstance(result, celtypes.StringType)
        assert str(result) == "hello"

    def test_python_to_cel_int(self):
        result = python_to_cel(42)
        assert isinstance(result, celtypes.IntType)

    def test_python_to_cel_float(self):
        result = python_to_cel(3.14)
        assert isinstance(result, celtypes.DoubleType)

    def test_python_to_cel_bool(self):
        result = python_to_cel(True)
        assert isinstance(result, celtypes.BoolType)

    def test_python_to_cel_dict(self):
        result = python_to_cel({"a": "b"})
        assert isinstance(result, celtypes.MapType)

    def test_python_to_cel_list(self):
        result = python_to_cel([1, 2, 3])
        assert isinstance(result, celtypes.ListType)

    def test_python_to_cel_none(self):
        assert python_to_cel(None) is None

    def test_cel_to_python_string(self):
        assert cel_to_python(celtypes.StringType("hello")) == "hello"

    def test_cel_to_python_int(self):
        assert cel_to_python(celtypes.IntType(42)) == 42

    def test_cel_to_python_double(self):
        assert cel_to_python(celtypes.DoubleType(3.14)) == 3.14


# ── Numeric Function Tests ────────────────────────────────────────

class TestNumericFunctions:
    def test_parse_decimal_simple(self):
        result = cel_parseDecimal(celtypes.StringType("1234.56"))
        assert float(result) == 1234.56

    def test_parse_decimal_commas(self):
        result = cel_parseDecimal(celtypes.StringType("1,234,567.89"))
        assert float(result) == 1234567.89

    def test_parse_decimal_dollar(self):
        result = cel_parseDecimal(celtypes.StringType("$1,234.56"))
        assert float(result) == 1234.56

    def test_parse_decimal_parenthetical_negative(self):
        result = cel_parseDecimal(celtypes.StringType("(1,234.56)"))
        assert float(result) == -1234.56

    def test_round(self):
        result = cel_round(celtypes.DoubleType(3.14159), celtypes.IntType(2))
        assert float(result) == 3.14

    def test_abs(self):
        result = cel_abs(celtypes.DoubleType(-42.5))
        assert float(result) == 42.5

    def test_to_int(self):
        result = cel_toInt(celtypes.StringType("42"))
        assert int(result) == 42

    def test_format_number(self):
        result = cel_formatNumber(celtypes.DoubleType(1234567.89), celtypes.StringType("#,##0.00"))
        assert str(result) == "1,234,567.89"


# ── String Function Tests ─────────────────────────────────────────

class TestStringFunctions:
    def test_pad_left(self):
        result = cel_padLeft(celtypes.StringType("42"), celtypes.IntType(5), celtypes.StringType("0"))
        assert str(result) == "00042"

    def test_pad_right(self):
        result = cel_padRight(celtypes.StringType("ABC"), celtypes.IntType(6), celtypes.StringType(" "))
        assert str(result) == "ABC   "

    def test_split(self):
        result = cel_split(celtypes.StringType("a|b|c"), celtypes.StringType("|"))
        parts = [str(x) for x in result]
        assert parts == ["a", "b", "c"]

    def test_join(self):
        lst = celtypes.ListType([celtypes.StringType("a"), celtypes.StringType("b"), celtypes.StringType("c")])
        result = cel_join(lst, celtypes.StringType(", "))
        assert str(result) == "a, b, c"

    def test_regex_extract(self):
        result = cel_regexExtract(celtypes.StringType("Fund-ABC-123"), celtypes.StringType(r"Fund-(\w+)-(\d+)"))
        assert str(result) == "ABC"

    def test_regex_replace(self):
        result = cel_regexReplace(
            celtypes.StringType("$1,234.56"),
            celtypes.StringType(r"[\$,]"),
            celtypes.StringType(""),
        )
        assert str(result) == "1234.56"

    def test_upper(self):
        assert str(cel_upper(celtypes.StringType("hello"))) == "HELLO"

    def test_lower(self):
        assert str(cel_lower(celtypes.StringType("HELLO"))) == "hello"

    def test_trim(self):
        assert str(cel_trim(celtypes.StringType("  hello  "))) == "hello"


# ── Lookup Function Tests ─────────────────────────────────────────

class TestLookupFunctions:
    def setup_method(self):
        set_lookup_context({
            "xrefAccount": {
                "ACC001": {"accountId": "ACC001", "eagleActBasis": "TRADE"},
                "ACC002": {"accountId": "ACC002", "eagleActBasis": "SETTLE"},
            },
        })

    def test_lookup(self):
        result = cel_lookup(
            celtypes.StringType("xrefAccount"),
            celtypes.StringType("ACC001"),
            celtypes.StringType("eagleActBasis"),
        )
        assert str(result) == "TRADE"

    def test_lookup_not_found(self):
        with pytest.raises(ValueError, match="not found"):
            cel_lookup(
                celtypes.StringType("xrefAccount"),
                celtypes.StringType("MISSING"),
                celtypes.StringType("eagleActBasis"),
            )

    def test_lookup_or_default(self):
        result = cel_lookupOrDefault(
            celtypes.StringType("xrefAccount"),
            celtypes.StringType("MISSING"),
            celtypes.StringType("eagleActBasis"),
            celtypes.StringType("DEFAULT"),
        )
        assert str(result) == "DEFAULT"

    def test_cross_ref(self):
        result = cel_crossRef(
            celtypes.StringType("xrefAccount"),
            celtypes.StringType("ACC001"),
        )
        assert isinstance(result, celtypes.MapType)


# ── Coercion Function Tests ──────────────────────────────────────

class TestCoercionFunctions:
    def test_coalesce(self):
        result = cel_coalesce(None, None, celtypes.StringType("found"))
        assert str(result) == "found"

    def test_coalesce_first(self):
        result = cel_coalesce(celtypes.StringType("first"), celtypes.StringType("second"))
        assert str(result) == "first"

    def test_if_empty(self):
        result = cel_ifEmpty(celtypes.StringType(""), celtypes.StringType("fallback"))
        assert str(result) == "fallback"

    def test_if_empty_non_empty(self):
        result = cel_ifEmpty(celtypes.StringType("value"), celtypes.StringType("fallback"))
        assert str(result) == "value"

    def test_null_if(self):
        result = cel_nullIf(celtypes.StringType("N/A"), celtypes.StringType("N/A"))
        assert result is None

    def test_null_if_no_match(self):
        result = cel_nullIf(celtypes.StringType("valid"), celtypes.StringType("N/A"))
        assert str(result) == "valid"

    def test_to_list(self):
        result = cel_toList(celtypes.StringType("item"))
        assert isinstance(result, celtypes.ListType)
        assert len(result) == 1

    def test_flatten(self):
        inner1 = celtypes.ListType([celtypes.StringType("a"), celtypes.StringType("b")])
        inner2 = celtypes.ListType([celtypes.StringType("c")])
        result = cel_flatten(celtypes.ListType([inner1, inner2]))
        assert len(result) == 3


# ── CelEvaluator Integration Tests ───────────────────────────────

class TestCelEvaluator:
    def setup_method(self):
        self.evaluator = CelEvaluator()

    def test_compile_valid_expression(self):
        ast, prog = self.evaluator.compile("src.name")
        assert prog is not None

    def test_compile_invalid_expression(self):
        with pytest.raises(Exception):
            self.evaluator.compile("invalid @@@ expression")

    def test_validate_valid(self):
        valid, error = self.evaluator.validate_expression("src.name")
        assert valid is True
        assert error is None

    def test_validate_invalid(self):
        valid, error = self.evaluator.validate_expression("invalid @@@")
        assert valid is False
        assert error is not None

    def test_evaluate_simple(self):
        _, prog = self.evaluator.compile("src.name")
        result = self.evaluator.evaluate(prog, {"name": "Alice"})
        assert result == "Alice"

    def test_evaluate_arithmetic(self):
        _, prog = self.evaluator.compile("parseDecimal(src.a) + parseDecimal(src.b)")
        result = self.evaluator.evaluate(prog, {"a": "10.5", "b": "20.3"})
        assert abs(result - 30.8) < 0.01

    def test_evaluate_ternary(self):
        _, prog = self.evaluator.compile("src.val == 'Y' ? 'YES' : 'NO'")
        result = self.evaluator.evaluate(prog, {"val": "Y"})
        assert result == "YES"

    def test_evaluate_with_row_index(self):
        _, prog = self.evaluator.compile("rowIndex")
        result = self.evaluator.evaluate(prog, {}, row_index=5)
        assert result == 5

    def test_evaluate_with_params(self):
        _, prog = self.evaluator.compile("params.date")
        result = self.evaluator.evaluate(prog, {}, params={"date": "2026-03-09"})
        assert result == "2026-03-09"

    def test_compile_all(self):
        field_mappings = [
            {"targetField": "name", "cel": "src.name"},
            {"targetField": "amount", "cel": "parseDecimal(src.amount)"},
        ]
        filters = ["src.name != ''"]

        field_progs, filter_progs, errors = self.evaluator.compile_all(field_mappings, filters)
        assert len(errors) == 0
        assert "name" in field_progs
        assert "amount" in field_progs
        assert len(filter_progs) == 1

    def test_compile_all_with_errors(self):
        field_mappings = [
            {"targetField": "bad", "cel": "invalid @@@"},
        ]
        _, _, errors = self.evaluator.compile_all(field_mappings, [])
        assert len(errors) > 0

    def test_expression_caching(self):
        _, prog1 = self.evaluator.compile("src.name")
        _, prog2 = self.evaluator.compile("src.name")
        assert prog1 is prog2  # Same object from cache
