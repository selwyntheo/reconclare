"""
Unit tests for AI generator: prompt construction, response parsing, validation retry.
Tests don't call the actual Claude API — they test the prompt building and parsing logic.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from services.mapping.ai_generator import (
    MappingAiGenerator, GENERATION_PROMPT, SUGGEST_PROMPT,
    _format_functions_for_prompt,
)
from services.mapping.schemas import FieldSchema, FieldMapping, Confidence, FieldType


class TestPromptFormatting:
    def test_format_functions_for_prompt(self):
        result = _format_functions_for_prompt()
        assert "parseDate" in result
        assert "parseDecimal" in result
        assert "lookup" in result
        assert "coalesce" in result

    def test_generation_prompt_template(self):
        # Verify the template has expected placeholders
        assert "{source_schema}" in GENERATION_PROMPT
        assert "{sample_rows}" in GENERATION_PROMPT
        assert "{target_schema}" in GENERATION_PROMPT
        assert "{custom_functions}" in GENERATION_PROMPT
        assert "{lookup_tables}" in GENERATION_PROMPT

    def test_suggest_prompt_template(self):
        assert "{target_field}" in SUGGEST_PROMPT
        assert "{target_type}" in SUGGEST_PROMPT
        assert "{source_schema}" in SUGGEST_PROMPT


class TestAiGeneratorParsing:
    def setup_method(self):
        self.generator = MappingAiGenerator()

    @pytest.mark.asyncio
    async def test_validate_and_retry_valid(self):
        raw_mappings = [
            {
                "targetField": "account",
                "cel": "src.Fund_ID",
                "confidence": "HIGH",
                "explanation": "Direct mapping",
                "assumptions": [],
            },
        ]
        source_schema = [FieldSchema(name="Fund_ID", type=FieldType.STRING)]

        results = await self.generator._validate_and_retry(raw_mappings, source_schema)
        assert len(results) == 1
        assert results[0].targetField == "account"
        assert results[0].cel == "src.Fund_ID"
        assert results[0].validated is True
        assert results[0].confidence == Confidence.HIGH

    @pytest.mark.asyncio
    async def test_validate_and_retry_invalid_no_api(self):
        """Invalid expressions should be flagged but not crash without API."""
        raw_mappings = [
            {
                "targetField": "bad",
                "cel": "invalid @@@",
                "confidence": "LOW",
                "explanation": "Bad expression",
                "assumptions": [],
            },
        ]
        source_schema = [FieldSchema(name="Fund_ID", type=FieldType.STRING)]

        # Without API key, retry will fail silently
        results = await self.generator._validate_and_retry(raw_mappings, source_schema, max_retries=0)
        assert len(results) == 1
        assert results[0].validated is False

    @pytest.mark.asyncio
    async def test_structured_output_format(self):
        """Verify the AiFieldMapping structure."""
        raw_mappings = [
            {
                "targetField": "account",
                "cel": "src.Fund_ID",
                "confidence": "HIGH",
                "explanation": "Direct field mapping",
                "assumptions": ["Fund_ID is the account identifier"],
            },
            {
                "targetField": "amount",
                "cel": "parseDecimal(src.Net_Assets)",
                "confidence": "MEDIUM",
                "explanation": "Parse formatted number",
                "assumptions": [],
            },
        ]
        source_schema = [
            FieldSchema(name="Fund_ID", type=FieldType.STRING),
            FieldSchema(name="Net_Assets", type=FieldType.STRING),
        ]

        results = await self.generator._validate_and_retry(raw_mappings, source_schema)
        assert len(results) == 2

        # Check structured output
        for r in results:
            assert r.targetField is not None
            assert r.cel is not None
            assert r.confidence in (Confidence.HIGH, Confidence.MEDIUM, Confidence.LOW)
            assert isinstance(r.explanation, str)
            assert isinstance(r.assumptions, list)
            assert isinstance(r.validated, bool)
