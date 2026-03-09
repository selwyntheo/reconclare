"""
AI-powered CEL expression generation using Claude (Anthropic API).
"""
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from config.settings import settings
from .cel_evaluator import CelEvaluator, FUNCTION_DOCS
from .schemas import (
    AiFieldMapping, AiGenerationResult, Confidence,
    FieldSchema, FieldMapping,
)

logger = logging.getLogger(__name__)

# Prompt template for full mapping generation
GENERATION_PROMPT = """You are a data mapping specialist for the RECON-AI fund administration platform.
Given the following source file schema, sample data, and target canonical schema,
generate CEL expressions to map each source field to the target schema.

Source Schema:
{source_schema}

Source Sample Data (first {sample_count} rows):
{sample_rows}

Target Schema:
{target_schema}

Target Sample Data (showing expected output shape):
{target_sample_rows}

Available Lookup Tables:
{lookup_tables}

Available Custom CEL Functions:
{custom_functions}

For each target field, provide a JSON object with:
- "targetField": the target field name
- "cel": the CEL expression
- "confidence": "HIGH" | "MEDIUM" | "LOW"
- "explanation": brief explanation of the mapping logic
- "assumptions": array of any assumptions made

Rules:
- Use ONLY the declared custom functions and standard CEL operations
- Handle null/empty values with has() checks or coalesce()
- Use parseDecimal() for all financial amounts (handles commas, $, parenthetical negatives)
- Use parseDate() with explicit format patterns for dates
- Reference lookup tables for cross-reference mappings using lookup() function
- Prefer explicit type handling over implicit coercion
- Source fields are accessed via src.fieldName or src["field name"]
- Standard CEL: contains, startsWith, endsWith, matches, size, +, -, *, /, ==, !=, <, >, &&, ||, !, ? :, has()

Respond with ONLY a JSON array of mapping objects. No additional text."""

# Prompt template for single field suggestion
SUGGEST_PROMPT = """You are a data mapping specialist. Suggest a CEL expression for mapping a single target field.

Target Field: {target_field} (type: {target_type})
Source Schema: {source_schema}
Sample Data: {sample_data}
Existing Mappings: {existing_mappings}
Available Lookup Tables: {lookup_tables}

Available Custom CEL Functions:
{custom_functions}

Respond with ONLY a JSON object:
{{"cel": "<expression>", "confidence": "HIGH|MEDIUM|LOW", "explanation": "<brief explanation>", "assumptions": []}}"""


def _format_functions_for_prompt() -> str:
    """Format function docs for inclusion in the AI prompt."""
    lines = []
    for fn in FUNCTION_DOCS:
        lines.append(f"- {fn['name']}{fn['signature']}: {fn['description']}  Example: {fn.get('example', '')}")
    return "\n".join(lines)


class MappingAiGenerator:
    """Generates CEL mapping expressions using Claude."""

    def __init__(self):
        self._evaluator = CelEvaluator()
        self._client = None

    def _get_client(self):
        """Lazy-init Anthropic client."""
        if self._client is None:
            try:
                import anthropic
                api_key = settings.ANTHROPIC_API_KEY
                if not api_key:
                    raise ValueError("ANTHROPIC_API_KEY not configured")
                self._client = anthropic.Anthropic(api_key=api_key)
            except ImportError:
                raise RuntimeError("anthropic package not installed. Run: pip install anthropic")
        return self._client

    async def generate_mappings(
        self,
        source_schema: List[FieldSchema],
        sample_data: List[Dict[str, Any]],
        target_schema: List[FieldSchema],
        lookup_tables: Optional[List[str]] = None,
        target_sample_data: Optional[List[Dict[str, Any]]] = None,
    ) -> AiGenerationResult:
        """Generate CEL expressions for all target fields."""
        prompt = GENERATION_PROMPT.format(
            source_schema=json.dumps([f.model_dump() for f in source_schema], indent=2),
            sample_count=len(sample_data),
            sample_rows=json.dumps(sample_data[:5], indent=2, default=str),
            target_schema=json.dumps([f.model_dump() for f in target_schema], indent=2),
            target_sample_rows=json.dumps(target_sample_data[:3], indent=2, default=str) if target_sample_data else "(none provided)",
            lookup_tables=json.dumps(lookup_tables or []),
            custom_functions=_format_functions_for_prompt(),
        )

        raw_mappings = await self._call_claude(prompt)
        validated_mappings = await self._validate_and_retry(raw_mappings, source_schema)

        return AiGenerationResult(
            mappings=validated_mappings,
            generatedAt=datetime.now(timezone.utc),
        )

    async def suggest_field_mapping(
        self,
        target_field: str,
        target_type: str,
        source_schema: List[FieldSchema],
        sample_data: Optional[List[Dict[str, Any]]] = None,
        existing_mappings: Optional[List[FieldMapping]] = None,
        lookup_tables: Optional[List[str]] = None,
    ) -> AiFieldMapping:
        """Suggest a CEL expression for a single target field."""
        prompt = SUGGEST_PROMPT.format(
            target_field=target_field,
            target_type=target_type,
            source_schema=json.dumps([f.model_dump() for f in source_schema], indent=2),
            sample_data=json.dumps((sample_data or [])[:3], indent=2, default=str),
            existing_mappings=json.dumps(
                [fm.model_dump() for fm in (existing_mappings or [])], indent=2
            ),
            lookup_tables=json.dumps(lookup_tables or []),
            custom_functions=_format_functions_for_prompt(),
        )

        result = await self._call_claude(prompt)
        if isinstance(result, list):
            result = result[0] if result else {}

        mapping = AiFieldMapping(
            targetField=target_field,
            cel=result.get("cel", f"src.{target_field}"),
            confidence=Confidence(result.get("confidence", "LOW")),
            explanation=result.get("explanation", ""),
            assumptions=result.get("assumptions", []),
        )

        # Validate
        valid, error = self._evaluator.validate_expression(mapping.cel)
        mapping.validated = valid
        if not valid:
            # Retry once with error feedback
            mapping = await self._retry_single(mapping, error, source_schema)

        return mapping

    async def _call_claude(self, prompt: str) -> Any:
        """Call Claude API and parse JSON response."""
        client = self._get_client()

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text.strip()

        # Extract JSON from response (handle markdown code blocks)
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            json_lines = []
            in_block = False
            for line in lines:
                if line.startswith("```") and not in_block:
                    in_block = True
                    continue
                elif line.startswith("```") and in_block:
                    break
                elif in_block:
                    json_lines.append(line)
            response_text = "\n".join(json_lines)

        return json.loads(response_text)

    async def _validate_and_retry(
        self,
        raw_mappings: Any,
        source_schema: List[FieldSchema],
        max_retries: int = 2,
    ) -> List[AiFieldMapping]:
        """Validate each AI-generated CEL expression; retry failures."""
        if not isinstance(raw_mappings, list):
            raw_mappings = [raw_mappings]

        results = []
        for item in raw_mappings:
            mapping = AiFieldMapping(
                targetField=item.get("targetField", ""),
                cel=item.get("cel", ""),
                confidence=Confidence(item.get("confidence", "LOW")),
                explanation=item.get("explanation", ""),
                assumptions=item.get("assumptions", []),
            )

            valid, error = self._evaluator.validate_expression(mapping.cel)
            if valid:
                mapping.validated = True
                results.append(mapping)
                continue

            # Retry
            for attempt in range(max_retries):
                mapping = await self._retry_single(mapping, error, source_schema)
                if mapping.validated:
                    break

            results.append(mapping)

        return results

    async def _retry_single(
        self,
        mapping: AiFieldMapping,
        error: Optional[str],
        source_schema: List[FieldSchema],
    ) -> AiFieldMapping:
        """Retry generating a single field mapping with error feedback."""
        retry_prompt = f"""The CEL expression you generated for field '{mapping.targetField}' is invalid.

Expression: {mapping.cel}
Error: {error}

Source Schema: {json.dumps([f.model_dump() for f in source_schema], indent=2)}

Available Custom CEL Functions:
{_format_functions_for_prompt()}

Please provide a corrected CEL expression. Respond with ONLY a JSON object:
{{"cel": "<corrected expression>", "confidence": "HIGH|MEDIUM|LOW", "explanation": "<explanation>"}}"""

        try:
            result = await self._call_claude(retry_prompt)
            if isinstance(result, list):
                result = result[0]
            mapping.cel = result.get("cel", mapping.cel)
            mapping.confidence = Confidence(result.get("confidence", "LOW"))
            mapping.explanation = result.get("explanation", mapping.explanation)

            valid, _ = self._evaluator.validate_expression(mapping.cel)
            mapping.validated = valid
        except Exception as e:
            logger.warning(f"Retry failed for {mapping.targetField}: {e}")

        return mapping
