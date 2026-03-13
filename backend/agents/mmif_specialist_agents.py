"""
MMIF Specialist Agents for the MMIF 6-Agent Analysis Workflow.

Four specialist agents invoked after the L0-L3 pipeline:
- MmifSchemaMapperAgent: Analyzes GL→MMIF mapping gaps and suggests fixes
- MmifBalanceExtractorAgent: Validates data extraction quality
- MmifBreakAnalystAgent: Pattern matching and root cause synthesis
- MmifAttestationAgent: Generates attestation report and filing clearance check

Follows specialist_agents.py patterns exactly, using MongoDB and MmifAgentState.
"""
import json
from datetime import datetime
from typing import Optional

from agents.mmif_level_agents import MmifBaseAgent
from agents.mmif_state import (
    MmifAgentState, MmifAnalysisPhase, AgentFinding,
)
from db.mongodb import COLLECTIONS


# =============================================================================
# Schema Mapper Agent
# =============================================================================

class MmifSchemaMapperAgent(MmifBaseAgent):
    """
    Schema Mapper Agent — Analyzes GL→MMIF section mapping gaps.

    Responsibilities:
    - Identify Eagle GL accounts not mapped to any MMIF section
    - Flag accounts mapped to wrong MMIF sections
    - Suggest GL→MMIF section mappings based on GL description and category
    - Highlight accounts causing the section subtotal breaks
    """

    def __init__(self):
        super().__init__(
            name="MmifSchemaMapperAgent",
            description="Analyze GL→MMIF mapping gaps and suggest section mappings",
        )

    def analyze(self, state: MmifAgentState) -> MmifAgentState:
        state.add_trace(self.name, "analyzing_mapping_gaps", {
            "breaking_sections": state.breaking_sections,
        })

        brk = state.mmif_break
        if not brk:
            return state

        # Fetch mapping configuration for this event/fund
        mapping_config = state.mapping_config or self.query_mongo_one(
            COLLECTIONS["mmifMappingConfigs"],
            {"eventId": brk.event_id, "account": brk.fund_account},
        )

        # Identify unmapped GL accounts
        unmapped_accounts = []
        mapping_gaps = []
        suggested_mappings = []

        if mapping_config:
            unmapped_accounts = mapping_config.get("unmappedAccounts", [])
            existing_mappings = mapping_config.get("mappings", [])

            # Find GL accounts that are mapped but to wrong MMIF section
            # based on the breaking sections from L1
            for m in existing_mappings:
                mapped_section = m.get("mmifSection", "")
                if mapped_section in state.breaking_sections:
                    mapping_gaps.append({
                        "eagle_gl_pattern": m.get("eagleGlPattern", ""),
                        "current_mmif_section": mapped_section,
                        "eagle_source_table": m.get("eagleSourceTable", ""),
                        "eagle_source_field": m.get("eagleSourceField", ""),
                        "issue": f"Section {mapped_section} is breaking — mapping may be incorrect",
                    })

        # Fetch Eagle GL accounts for context
        eagle_gl_accounts = self.query_mongo(
            COLLECTIONS["refEagleGLAccounts"] if "refEagleGLAccounts" in COLLECTIONS
            else "refEagleGLAccounts",
            {},
            {"_id": 0},
        )

        # Use LLM to suggest mappings for unmapped/problematic accounts
        if unmapped_accounts or mapping_gaps:
            llm_suggestions = self._llm_suggest_mappings(
                brk, unmapped_accounts, mapping_gaps, eagle_gl_accounts, state.breaking_sections
            )
            suggested_mappings = llm_suggestions

        state.mapping_gaps = mapping_gaps
        state.unmapped_gl_accounts = unmapped_accounts
        state.suggested_mappings = suggested_mappings

        # Create findings
        if unmapped_accounts:
            finding = self.create_finding(
                description=(
                    f"Schema mapping: {len(unmapped_accounts)} Eagle GL account(s) "
                    f"have no MMIF section mapping. These balances are excluded from "
                    f"the MMIF return, potentially causing section subtotal breaks."
                ),
                evidence={
                    "unmapped_accounts": unmapped_accounts[:20],
                    "total_unmapped": len(unmapped_accounts),
                    "breaking_sections": state.breaking_sections,
                },
                confidence=0.92,
                recommended_action=(
                    "Map unmapped GL accounts to appropriate MMIF sections. "
                    "Review suggested mappings and update mmifMappingConfigs."
                ),
                level="SPECIALIST_SCHEMA_MAPPER",
            )
            state.specialist_findings.append(finding)
            state.add_finding(finding)

        if mapping_gaps:
            finding = self.create_finding(
                description=(
                    f"Schema mapping: {len(mapping_gaps)} GL account(s) may be mapped "
                    f"to incorrect MMIF sections (cross-referencing breaking sections: "
                    f"{state.breaking_sections})."
                ),
                evidence={
                    "mapping_gaps": mapping_gaps[:10],
                    "suggested_mappings": suggested_mappings[:5],
                },
                confidence=0.84,
                recommended_action=(
                    "Review and correct GL→MMIF section mappings for identified accounts"
                ),
                level="SPECIALIST_SCHEMA_MAPPER",
            )
            state.specialist_findings.append(finding)
            state.add_finding(finding)

        # Summary finding even if no gaps
        summary_conf = 0.90 if (unmapped_accounts or mapping_gaps) else 0.95
        finding = self.create_finding(
            description=(
                f"Schema mapping analysis complete: "
                f"{len(unmapped_accounts)} unmapped accounts, "
                f"{len(mapping_gaps)} suspect mappings, "
                f"{len(suggested_mappings)} mapping suggestions generated."
            ),
            evidence={
                "mapping_config_found": mapping_config is not None,
                "unmapped_count": len(unmapped_accounts),
                "gap_count": len(mapping_gaps),
                "suggestion_count": len(suggested_mappings),
            },
            confidence=summary_conf,
            recommended_action="Apply suggested mappings and re-run MMIF validation",
            level="SPECIALIST_SCHEMA_MAPPER",
        )
        state.specialist_findings.append(finding)
        state.add_finding(finding)

        return state

    def _llm_suggest_mappings(
        self,
        brk,
        unmapped_accounts: list[str],
        mapping_gaps: list[dict],
        eagle_gl_accounts: list[dict],
        breaking_sections: list[str],
    ) -> list[dict]:
        """Use LLM to suggest GL→MMIF section mappings."""
        accounts_str = ", ".join(unmapped_accounts[:15]) if unmapped_accounts else "None"
        gaps_str = "\n".join(
            f"  - {g['eagle_gl_pattern']} → Section {g['current_mmif_section']} (suspect)"
            for g in mapping_gaps[:10]
        ) if mapping_gaps else "None"

        section_guide = (
            "3.1=Equities, 3.2=DebtSecurities, 3.5=CashDeposits, "
            "4.2=Derivatives, 4.3=TotalAssets, 2=P&L, 5.1=FundShares"
        )

        try:
            raw = self.llm_reason(
                system_prompt=(
                    "You are an MMIF regulatory filing mapping expert. "
                    "Suggest correct MMIF section mappings for Eagle GL accounts. "
                    "Return a JSON array of objects with fields: "
                    "'eagle_gl_pattern', 'suggested_mmif_section', 'rationale'. "
                    "Respond with ONLY valid JSON."
                ),
                user_prompt=(
                    f"Fund type: {brk.fund_name}\n"
                    f"Breaking MMIF sections: {breaking_sections}\n"
                    f"Section guide: {section_guide}\n"
                    f"Unmapped GL accounts: {accounts_str}\n"
                    f"Suspect mappings:\n{gaps_str}\n"
                    f"Suggest corrections as JSON array."
                ),
                structured_output=True,
            )
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict):
                # LLM may wrap in an object
                for v in parsed.values():
                    if isinstance(v, list):
                        return v
            return []
        except Exception:
            # Fallback: generate basic suggestions
            suggestions = []
            for account in unmapped_accounts[:5]:
                account_lower = account.lower()
                if any(k in account_lower for k in ["equity", "stock", "share"]):
                    section = "3.1"
                elif any(k in account_lower for k in ["bond", "note", "debt", "fixed"]):
                    section = "3.2"
                elif any(k in account_lower for k in ["cash", "deposit", "bank"]):
                    section = "3.5"
                elif any(k in account_lower for k in ["deriv", "swap", "option", "future"]):
                    section = "4.2"
                else:
                    section = "4.3"
                suggestions.append({
                    "eagle_gl_pattern": account,
                    "suggested_mmif_section": section,
                    "rationale": "Rule-based classification from GL account description",
                })
            return suggestions


# =============================================================================
# Balance Extractor Agent
# =============================================================================

class MmifBalanceExtractorAgent(MmifBaseAgent):
    """
    Balance Extractor Agent — Validates data extraction quality from Eagle.

    Responsibilities:
    - Check sign conventions applied during Eagle TB extraction
    - Validate currency conversion to base currency (EUR)
    - Verify correct aggregation rules (sum of lines vs. net)
    - Flag extraction-level issues that cause MMIF discrepancies
    """

    def __init__(self):
        super().__init__(
            name="MmifBalanceExtractorAgent",
            description="Validate Eagle TB data extraction: signs, currency, aggregation",
        )

    def analyze(self, state: MmifAgentState) -> MmifAgentState:
        state.add_trace(self.name, "validating_data_extraction")

        brk = state.mmif_break
        if not brk:
            return state

        # Fetch mapping config for extraction rules
        mapping_config = state.mapping_config or self.query_mongo_one(
            COLLECTIONS["mmifMappingConfigs"],
            {"eventId": brk.event_id, "account": brk.fund_account},
        )

        sign_issues = []
        currency_issues = []
        aggregation_issues = []

        if mapping_config:
            mappings = mapping_config.get("mappings", [])

            for m in mappings:
                # Check sign conventions (signConvention=1 means as-is, -1 means flip)
                sign_conv = m.get("signConvention", 1)
                mmif_section = m.get("mmifSection", "")
                mmif_field = m.get("mmifField", "")

                # Liabilities and short positions should typically have sign flipped
                if mmif_section in ["4.1", "5.3", "5.4"] and sign_conv != -1:
                    sign_issues.append({
                        "mmif_section": mmif_section,
                        "mmif_field": mmif_field,
                        "current_sign_convention": sign_conv,
                        "expected_sign_convention": -1,
                        "issue": (
                            f"Section {mmif_section} (liability/overdraft) "
                            f"should use sign convention -1 (flip)"
                        ),
                    })

                # Check for currency conversion in transformation
                transformation = m.get("transformation", "") or ""
                if "FX" in transformation.upper() or "CONVERT" in transformation.upper():
                    # Verify base currency is EUR
                    base_currency = mapping_config.get("baseCurrency", "EUR")
                    if base_currency not in ("EUR", "USD", "GBP"):
                        currency_issues.append({
                            "mmif_section": mmif_section,
                            "transformation": transformation,
                            "base_currency": base_currency,
                            "issue": f"Unexpected base currency: {base_currency}",
                        })

        # Check for FX inconsistency issues from L3
        if state.fx_inconsistencies:
            currency_issues.append({
                "source": "VR_011",
                "count": len(state.fx_inconsistencies),
                "issue": "FX rates applied inconsistently across sections (detected by L3)",
                "details": state.fx_inconsistencies[:3],
            })

        # Check aggregation: are sub-totals summed correctly?
        # VR-007 balance identity breaks indicate aggregation issues
        if state.balance_identity_breaks:
            aggregation_issues.append({
                "rule": "VR_007",
                "break_count": len(state.balance_identity_breaks),
                "issue": (
                    "Balance identity not satisfied — may indicate missing transactions "
                    "or incorrect aggregation in movement schedule"
                ),
                "details": state.balance_identity_breaks[:3],
            })

        state.sign_convention_issues = sign_issues
        state.currency_conversion_issues = currency_issues
        state.aggregation_issues = aggregation_issues

        # LLM analysis
        llm_analysis = self._llm_analyze_extraction(
            brk, sign_issues, currency_issues, aggregation_issues
        )

        if sign_issues:
            finding = self.create_finding(
                description=(
                    f"Sign convention issues: {len(sign_issues)} mapping(s) have "
                    f"incorrect sign conventions. Liability sections may be reported "
                    f"as positive values instead of negative."
                ),
                evidence={"sign_issues": sign_issues},
                confidence=0.88,
                recommended_action=(
                    "Correct signConvention in mmifMappingConfigs for liability "
                    "and short position mappings"
                ),
                level="SPECIALIST_BALANCE_EXTRACTOR",
            )
            state.specialist_findings.append(finding)
            state.add_finding(finding)

        if currency_issues:
            finding = self.create_finding(
                description=(
                    f"Currency conversion issues: {len(currency_issues)} potential "
                    f"FX rate inconsistency(ies) detected in Eagle extraction."
                ),
                evidence={"currency_issues": currency_issues},
                confidence=0.85,
                recommended_action=(
                    "Verify consistent quarter-end FX rates are used for all sections; "
                    "check Eagle FX rate table for the filing period"
                ),
                level="SPECIALIST_BALANCE_EXTRACTOR",
            )
            state.specialist_findings.append(finding)
            state.add_finding(finding)

        if aggregation_issues:
            finding = self.create_finding(
                description=(
                    f"Aggregation issues: {len(aggregation_issues)} potential "
                    f"miscalculation(s) in movement/balance aggregation."
                ),
                evidence={"aggregation_issues": aggregation_issues},
                confidence=0.82,
                recommended_action=(
                    "Verify transaction completeness in the quarter and "
                    "confirm opening/closing balance aggregation logic"
                ),
                level="SPECIALIST_BALANCE_EXTRACTOR",
            )
            state.specialist_findings.append(finding)
            state.add_finding(finding)

        summary = self.create_finding(
            description=(
                f"Balance extraction validation: {len(sign_issues)} sign issues, "
                f"{len(currency_issues)} currency issues, "
                f"{len(aggregation_issues)} aggregation issues. "
                f"{llm_analysis[:200]}"
            ),
            evidence={
                "sign_issue_count": len(sign_issues),
                "currency_issue_count": len(currency_issues),
                "aggregation_issue_count": len(aggregation_issues),
                "llm_analysis": llm_analysis,
            },
            confidence=0.86,
            recommended_action="Apply extraction fixes and re-run MMIF validation",
            level="SPECIALIST_BALANCE_EXTRACTOR",
        )
        state.specialist_findings.append(summary)
        state.add_finding(summary)

        return state

    def _llm_analyze_extraction(
        self, brk, sign_issues: list, currency_issues: list, aggregation_issues: list
    ) -> str:
        """Use LLM to analyze extraction quality issues."""
        try:
            return self.llm_reason(
                system_prompt=(
                    "You are an MMIF data extraction expert. Analyze extraction quality "
                    "issues in an Eagle-to-MMIF data pipeline. Be concise."
                ),
                user_prompt=(
                    f"Fund: {brk.fund_name}, Period: {brk.filing_period}\n"
                    f"Sign convention issues: {len(sign_issues)}\n"
                    f"Currency/FX issues: {len(currency_issues)}\n"
                    f"Aggregation issues: {len(aggregation_issues)}\n"
                    f"Provide: root cause, extraction fix recommendations."
                ),
            )
        except Exception:
            return "Extraction quality issues identified — review mapping configuration."


# =============================================================================
# Break Analyst Agent
# =============================================================================

class MmifBreakAnalystAgent(MmifBaseAgent):
    """
    Break Analyst Agent — Pattern matching against historical breaks and root cause synthesis.

    Responsibilities:
    - Match current break profile against historical MMIF break patterns
    - Synthesize findings from L0-L3 and other specialists into root cause narrative
    - Classify the break into a canonical break category
    - Provide confidence-weighted root cause ranking
    """

    def __init__(self):
        super().__init__(
            name="MmifBreakAnalystAgent",
            description="Historical pattern matching and root cause synthesis for MMIF breaks",
        )

    def analyze(self, state: MmifAgentState) -> MmifAgentState:
        state.add_trace(self.name, "pattern_matching_and_synthesis")

        brk = state.mmif_break
        if not brk:
            return state

        # Query historical breaks with similar profile
        historical_patterns = self._find_historical_patterns(brk, state)

        # Classify the break pattern
        root_cause_classification = self._classify_break_pattern(state)

        # Synthesize all findings into root causes
        root_causes = self._synthesize_root_causes(state)

        state.matched_historical_patterns = historical_patterns
        state.root_cause_classification = root_cause_classification

        if historical_patterns:
            finding = self.create_finding(
                description=(
                    f"Historical pattern matching: {len(historical_patterns)} similar "
                    f"break(s) found in historical MMIF records. "
                    f"Pattern: {root_cause_classification}"
                ),
                evidence={
                    "patterns": historical_patterns[:5],
                    "pattern_count": len(historical_patterns),
                },
                confidence=0.85,
                recommended_action=(
                    "Apply resolution from most similar historical break: "
                    + (historical_patterns[0].get("resolution", "Manual review") if historical_patterns else "Manual review")
                ),
                level="SPECIALIST_BREAK_ANALYST",
            )
            state.specialist_findings.append(finding)
            state.add_finding(finding)

        # Generate break pattern summary using LLM
        break_pattern_summary = self._llm_synthesize_root_cause(state, root_causes)
        state.break_pattern_summary = break_pattern_summary

        finding = self.create_finding(
            description=(
                f"Break analysis synthesis: {len(root_causes)} root cause(s) identified. "
                f"Classification: {root_cause_classification}. "
                f"Summary: {break_pattern_summary[:250]}"
            ),
            evidence={
                "root_causes": root_causes,
                "classification": root_cause_classification,
                "historical_matches": len(historical_patterns),
                "full_summary": break_pattern_summary,
            },
            confidence=0.87,
            recommended_action="Review root cause narrative and initiate remediation steps",
            level="SPECIALIST_BREAK_ANALYST",
        )
        state.specialist_findings.append(finding)
        state.add_finding(finding)

        # Update state root causes
        state.root_causes = root_causes

        return state

    def _find_historical_patterns(self, brk, state: MmifAgentState) -> list[dict]:
        """Query historical MMIF breaks for similar patterns."""
        try:
            # Search for past breaks with same rule and similar variance range
            variance = abs(brk.variance)
            historical = self.query_mongo(
                COLLECTIONS["mmifBreakRecords"],
                {
                    "ruleId": brk.rule_id,
                    "state": {"$in": ["RESOLVED", "CLOSED", "APPROVED"]},
                    "eventId": {"$ne": brk.event_id},
                },
                {"_id": 0, "breakId": 1, "fundName": 1, "ruleId": 1,
                 "variance": 1, "state": 1, "humanAnnotation": 1},
            )

            # Score by variance proximity
            scored = []
            for h in historical:
                h_variance = abs(h.get("variance", 0))
                similarity = 1.0 - min(abs(h_variance - variance) / max(variance, 1), 1.0)
                annotation = h.get("humanAnnotation") or {}
                scored.append({
                    "break_id": h.get("breakId"),
                    "fund_name": h.get("fundName"),
                    "rule_id": h.get("ruleId"),
                    "variance": h.get("variance"),
                    "similarity_score": similarity,
                    "resolution": annotation.get("notes", "No resolution notes"),
                    "resolution_category": annotation.get("resolutionCategory", "UNKNOWN"),
                })

            scored.sort(key=lambda x: x["similarity_score"], reverse=True)
            return scored[:5]
        except Exception:
            return []

    def _classify_break_pattern(self, state: MmifAgentState) -> str:
        """Classify the break into a canonical category."""
        # Build classification from findings
        if state.fx_inconsistencies or state.currency_conversion_issues:
            return "FX_RATE_INCONSISTENCY"
        elif state.mapping_gaps or state.unmapped_gl_accounts:
            return "MAPPING_GAP"
        elif state.balance_identity_breaks:
            return "MOVEMENT_COMPLETENESS"
        elif state.opening_prior_closing_breaks:
            return "ROLL_FORWARD_ERROR"
        elif state.pnl_period_issues:
            return "YTD_VS_QTD_ERROR"
        elif state.sign_convention_issues:
            return "SIGN_CONVENTION_ERROR"
        elif state.breaking_sections:
            return "SECTION_SUBTOTAL_MISMATCH"
        elif state.isin_coverage_pct < 0.95:
            return "ISIN_COVERAGE_GAP"
        else:
            return "TOTAL_ASSETS_UNEXPLAINED"

    def _synthesize_root_causes(self, state: MmifAgentState) -> list[dict]:
        """Aggregate root causes from all findings."""
        root_causes = []
        seen = set()

        sorted_findings = sorted(
            state.all_findings,
            key=lambda f: f.confidence,
            reverse=True,
        )

        for finding in sorted_findings:
            if finding.confidence < 0.60:
                continue
            desc_key = finding.description[:80].lower()
            if desc_key in seen:
                continue
            seen.add(desc_key)
            root_causes.append({
                "agent": finding.agent_name,
                "level": finding.level,
                "description": finding.description,
                "confidence": finding.confidence,
                "evidence": finding.evidence,
                "recommended_action": finding.recommended_action,
            })

        return root_causes[:10]

    def _llm_synthesize_root_cause(
        self, state: MmifAgentState, root_causes: list[dict]
    ) -> str:
        """Use LLM to synthesize findings into a root cause narrative."""
        brk = state.mmif_break
        if not brk:
            return "No break context available."

        findings_summary = "\n".join(
            f"- [{rc['level']}] {rc['description'][:150]} (confidence: {rc['confidence']:.0%})"
            for rc in root_causes[:6]
        )

        try:
            return self.llm_reason(
                system_prompt=(
                    "You are a senior MMIF regulatory filing analyst. Write a clear, "
                    "concise root cause analysis for an MMIF reconciliation break. "
                    "Format: 1) Summary sentence, 2) Root Cause(s) with evidence, "
                    "3) Recommended Actions. Use plain language for operations managers."
                ),
                user_prompt=(
                    f"Fund: {brk.fund_name} ({brk.fund_account})\n"
                    f"Filing Period: {brk.filing_period}\n"
                    f"Rule: {brk.rule_id} — {brk.rule_name}\n"
                    f"Eagle Value: {brk.eagle_value:,.2f}, MMIF Value: {brk.mmif_value:,.2f}\n"
                    f"Variance: {brk.variance:,.2f}\n"
                    f"Break Classification: {state.root_cause_classification}\n\n"
                    f"Agent Findings:\n{findings_summary}\n\n"
                    f"Generate the root cause narrative."
                ),
            )
        except Exception:
            causes = "; ".join(rc["description"][:80] for rc in root_causes[:3])
            return (
                f"Analysis identified {len(root_causes)} root cause(s) for "
                f"{brk.rule_name} variance of {brk.variance:,.2f}: {causes}"
            )


# =============================================================================
# Attestation Agent
# =============================================================================

class MmifAttestationAgent(MmifBaseAgent):
    """
    Attestation Agent — Generates attestation report and filing readiness assessment.

    Responsibilities:
    - Compute attestation readiness score (0-1) based on break severity
    - Identify hard blockers vs. soft warnings for filing
    - Generate structured attestation report
    - Determine filing clearance (can file vs. cannot file)
    - Summarize outstanding issues for regulatory submission
    """

    HARD_BLOCK_RULES = {"VR_001", "VR_002", "VR_003", "VR_004",
                        "VR_006", "VR_007", "VR_009", "VR_010",
                        "VR_013", "VR_014"}
    SOFT_WARN_RULES = {"VR_005", "VR_008", "VR_011", "VR_015"}
    ADVISORY_RULES = {"VR_012"}

    def __init__(self):
        super().__init__(
            name="MmifAttestationAgent",
            description="Generate MMIF attestation report, readiness score, and filing clearance",
        )

    def analyze(self, state: MmifAgentState) -> MmifAgentState:
        state.phase = MmifAnalysisPhase.ATTESTATION
        state.add_trace(self.name, "generating_attestation_report")

        brk = state.mmif_break
        if not brk:
            return state

        # Classify all breaks as blockers or warnings
        blockers = []
        warnings = []

        for b in state.all_breaks_for_event:
            rule_id = b.get("ruleId", "")
            item = {
                "rule_id": rule_id,
                "rule_name": b.get("ruleName", ""),
                "severity": b.get("severity", ""),
                "variance": b.get("variance", 0.0),
                "fund_account": b.get("fundAccount", ""),
            }
            if rule_id in self.HARD_BLOCK_RULES:
                blockers.append(item)
            elif rule_id in self.SOFT_WARN_RULES:
                warnings.append(item)
            # ADVISORY — skip for clearance determination

        # Include mapping-level blockers
        if state.unmapped_gl_accounts:
            blockers.append({
                "rule_id": "MAPPING",
                "rule_name": "GL Account Mapping Gap",
                "severity": "HARD",
                "variance": 0.0,
                "fund_account": brk.fund_account,
                "detail": f"{len(state.unmapped_gl_accounts)} unmapped GL accounts",
            })

        state.attestation_blockers = blockers
        state.attestation_warnings = warnings

        # Calculate readiness score
        # Start at 1.0, deduct for each blocker/warning
        hard_deduction = min(len(blockers) * 0.15, 0.75)
        soft_deduction = min(len(warnings) * 0.05, 0.20)
        readiness_score = max(1.0 - hard_deduction - soft_deduction, 0.0)
        state.attestation_readiness_score = readiness_score

        # Filing clearance: no hard blockers required
        filing_clearance = len(blockers) == 0
        state.filing_clearance = filing_clearance

        # Generate attestation report structure
        attestation_report = self._build_attestation_report(
            brk, state, blockers, warnings, readiness_score, filing_clearance
        )
        state.attestation_report = attestation_report

        # LLM summary
        llm_summary = self._llm_generate_attestation_summary(
            brk, state, blockers, warnings, readiness_score, filing_clearance
        )

        # Main attestation finding
        clearance_str = "CLEARED FOR FILING" if filing_clearance else "BLOCKED — CANNOT FILE"
        finding = self.create_finding(
            description=(
                f"Attestation Assessment: {clearance_str}. "
                f"Readiness score: {readiness_score:.0%}. "
                f"Hard blockers: {len(blockers)}, "
                f"Soft warnings: {len(warnings)}. "
                f"{llm_summary[:200]}"
            ),
            evidence={
                "filing_clearance": filing_clearance,
                "readiness_score": readiness_score,
                "blocker_count": len(blockers),
                "warning_count": len(warnings),
                "blockers": blockers[:5],
                "warnings": warnings[:5],
                "attestation_report": attestation_report,
                "llm_summary": llm_summary,
            },
            confidence=0.95,
            recommended_action=(
                "Resolve all hard blockers before filing" if not filing_clearance
                else "Review soft warnings and proceed with filing"
            ),
            level="SPECIALIST_ATTESTATION",
        )
        state.specialist_findings.append(finding)
        state.add_finding(finding)

        return state

    def _build_attestation_report(
        self,
        brk,
        state: MmifAgentState,
        blockers: list[dict],
        warnings: list[dict],
        readiness_score: float,
        filing_clearance: bool,
    ) -> dict:
        """Build the structured attestation report."""
        return {
            "reportId": f"ATT-{brk.event_id}-{brk.fund_account}",
            "generatedAt": datetime.utcnow().isoformat(),
            "eventId": brk.event_id,
            "fundAccount": brk.fund_account,
            "fundName": brk.fund_name,
            "filingPeriod": brk.filing_period,
            "readinessScore": round(readiness_score, 4),
            "filingClearance": filing_clearance,
            "clearanceStatus": "CLEARED" if filing_clearance else "BLOCKED",
            "hardBlockers": blockers,
            "softWarnings": warnings,
            "breakSummary": {
                "totalBreaks": len(state.all_breaks_for_event),
                "breakingSections": state.breaking_sections,
                "breakingSecurities": len(state.breaking_securities),
                "movementBreaks": (
                    len(state.balance_identity_breaks) +
                    len(state.opening_prior_closing_breaks) +
                    len(state.pnl_period_issues) +
                    len(state.fx_inconsistencies)
                ),
                "isinCoverage": round(state.isin_coverage_pct, 4),
            },
            "rootCauses": state.root_causes[:5],
            "rootCauseClassification": state.root_cause_classification,
            "recommendedActions": [
                rc.get("recommended_action", "")
                for rc in state.root_causes[:5]
                if rc.get("recommended_action")
            ],
            "breakPatternSummary": state.break_pattern_summary,
            "overallConfidence": round(state.overall_confidence, 4),
        }

    def _llm_generate_attestation_summary(
        self,
        brk,
        state: MmifAgentState,
        blockers: list[dict],
        warnings: list[dict],
        readiness_score: float,
        filing_clearance: bool,
    ) -> str:
        """Use LLM to generate an attestation summary narrative."""
        blockers_str = "\n".join(
            f"  - {b['rule_id']}: {b['rule_name']} (var={b['variance']:,.2f})"
            for b in blockers[:5]
        ) or "None"
        warnings_str = "\n".join(
            f"  - {w['rule_id']}: {w['rule_name']}"
            for w in warnings[:3]
        ) or "None"

        try:
            return self.llm_reason(
                system_prompt=(
                    "You are a senior MMIF compliance officer generating an attestation "
                    "summary for a regulatory filing. Write a clear, professional summary "
                    "stating whether the fund is cleared to file and what must be done "
                    "before filing. Be direct and specific."
                ),
                user_prompt=(
                    f"Fund: {brk.fund_name} ({brk.fund_account})\n"
                    f"Filing Period: {brk.filing_period}\n"
                    f"Readiness Score: {readiness_score:.0%}\n"
                    f"Filing Clearance: {'YES' if filing_clearance else 'NO'}\n"
                    f"Hard Blockers ({len(blockers)}):\n{blockers_str}\n"
                    f"Soft Warnings ({len(warnings)}):\n{warnings_str}\n"
                    f"Root Cause: {state.root_cause_classification}\n\n"
                    f"Generate attestation summary (2-3 sentences)."
                ),
            )
        except Exception:
            if filing_clearance:
                return (
                    f"Fund {brk.fund_name} is cleared to file for {brk.filing_period}. "
                    f"Readiness score: {readiness_score:.0%}. "
                    f"{len(warnings)} soft warning(s) noted for review."
                )
            else:
                return (
                    f"Fund {brk.fund_name} CANNOT file for {brk.filing_period}. "
                    f"{len(blockers)} hard blocker(s) must be resolved. "
                    f"Readiness score: {readiness_score:.0%}."
                )
