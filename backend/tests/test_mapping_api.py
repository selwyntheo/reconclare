"""
Integration tests for mapping API endpoints.
Tests the router logic using FastAPI TestClient.
Note: Requires MongoDB connection for full integration tests.
These tests verify request/response structures and validation logic.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import pytest
from services.mapping.schemas import (
    MappingCreateRequest, SourceConfig, TargetConfig,
    SourceOptions, TargetOptions,
    FieldMapping, FilterExpression, ErrorHandling,
    FileFormat, FieldSchema,
    CelValidateRequest, CelEvaluateRequest,
)
from services.mapping.cel_evaluator import CelEvaluator, FUNCTION_DOCS


class TestSchemaValidation:
    """Test that Pydantic models validate correctly."""

    def test_mapping_create_request(self):
        req = MappingCreateRequest(
            name="Test Mapping",
            source=SourceConfig(format=FileFormat.CSV, schema_fields=[
                FieldSchema(name="Fund_ID", type="STRING"),
            ]),
            target=TargetConfig(format=FileFormat.JSON, schema_fields=[
                FieldSchema(name="account", type="STRING", required=True),
            ]),
            fieldMappings=[
                FieldMapping(targetField="account", cel="src.Fund_ID"),
            ],
        )
        assert req.name == "Test Mapping"
        assert req.source.format == FileFormat.CSV
        assert len(req.fieldMappings) == 1

    def test_mapping_create_with_all_options(self):
        req = MappingCreateRequest(
            name="Full Test",
            description="Complete mapping test",
            tags=["test", "csv"],
            source=SourceConfig(
                format=FileFormat.CSV,
                options=SourceOptions(
                    delimiter="|",
                    quoteChar="'",
                    hasHeader=True,
                    skipRows=2,
                    nullValues=["", "NULL"],
                ),
            ),
            target=TargetConfig(
                format=FileFormat.JSON,
                options=TargetOptions(prettyPrint=True, arrayWrapper=True),
            ),
            fieldMappings=[
                FieldMapping(targetField="a", cel="src.x"),
            ],
            filters=[
                FilterExpression(cel="src.x != ''"),
            ],
            errorHandling=ErrorHandling(
                onFieldError="USE_DEFAULT",
                onRowError="SKIP_AND_LOG",
                maxErrorCount=500,
                defaults={"a": "default"},
            ),
        )
        assert req.source.options.delimiter == "|"
        assert req.errorHandling.maxErrorCount == 500

    def test_cel_validate_request(self):
        req = CelValidateRequest(
            expression="src.Fund_ID",
            sourceSchema=[FieldSchema(name="Fund_ID", type="STRING")],
        )
        assert req.expression == "src.Fund_ID"

    def test_cel_evaluate_request(self):
        req = CelEvaluateRequest(
            expression="src.a + src.b",
            data={"a": "hello", "b": " world"},
        )
        assert req.data["a"] == "hello"


class TestCelEndpointLogic:
    """Test CEL validation and evaluation logic (no HTTP server needed)."""

    def setup_method(self):
        self.evaluator = CelEvaluator()

    def test_validate_valid_expression(self):
        valid, error = self.evaluator.validate_expression("src.Fund_ID")
        assert valid is True
        assert error is None

    def test_validate_invalid_expression(self):
        valid, error = self.evaluator.validate_expression("@@@ invalid")
        assert valid is False
        assert error is not None

    def test_evaluate_string_concat(self):
        _, prog = self.evaluator.compile("src.a + ' ' + src.b")
        result = self.evaluator.evaluate(prog, {"a": "hello", "b": "world"})
        assert result == "hello world"

    def test_evaluate_custom_function(self):
        _, prog = self.evaluator.compile("parseDecimal(src.amount)")
        result = self.evaluator.evaluate(prog, {"amount": "1,234.56"})
        assert abs(result - 1234.56) < 0.01

    def test_function_docs_complete(self):
        assert len(FUNCTION_DOCS) >= 25
        categories = set(fn["category"] for fn in FUNCTION_DOCS)
        assert "date" in categories
        assert "numeric" in categories
        assert "string" in categories
        assert "lookup" in categories
        assert "coercion" in categories

    def test_all_docs_have_required_fields(self):
        for fn in FUNCTION_DOCS:
            assert "name" in fn
            assert "signature" in fn
            assert "description" in fn
            assert "category" in fn
