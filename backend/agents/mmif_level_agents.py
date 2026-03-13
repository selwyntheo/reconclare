"""
MMIF Level Agents (L0-L3) for the MMIF 6-Agent Analysis Workflow.

Each level agent drills progressively deeper into the MMIF break:
- L0: Total Assets Tie-Out (VR-001)
- L1: Section Subtotals (VR-002 through VR-005)
- L2: Security-Level Matching (VR-012, VR-013, VR-014)
- L3: Movement Reconciliation (VR-006, VR-007, VR-010, VR-011, VR-015)

Follows level_agents.py patterns exactly, using MongoDB instead of PostgreSQL/Neo4j.
"""
from abc import abstractmethod
from datetime import datetime
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage

from agents.mmif_state import (
    MmifAgentState, MmifAnalysisPhase, MmifBreakDriver,
    VarianceDetail, AgentFinding,
)
from config.settings import settings
from db.mongodb import get_sync_db, COLLECTIONS


# =============================================================================
# MMIF Base Agent
# =============================================================================

class MmifBaseAgent:
    """
    Base class for all MMIF agents.
    Provides shared infrastructure: LLM access, MongoDB queries, finding helpers.
    Follows BaseAgent patterns but uses MmifAgentState and MongoDB.
    """

    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self._llm = None
        self._db = None

    # =========================================================================
    # Infrastructure Access
    # =========================================================================

    @property
    def llm(self):
        if self._llm is None:
            try:
                if settings.LLM_PROVIDER == "anthropic" and settings.ANTHROPIC_API_KEY:
                    from langchain_anthropic import ChatAnthropic
                    self._llm = ChatAnthropic(
                        model=settings.LLM_MODEL,
                        temperature=settings.LLM_TEMPERATURE,
                        anthropic_api_key=settings.ANTHROPIC_API_KEY,
                    )
                elif settings.OPENAI_API_KEY:
                    from langchain_openai import ChatOpenAI
                    self._llm = ChatOpenAI(
                        model=settings.LLM_MODEL,
                        temperature=settings.LLM_TEMPERATURE,
                        api_key=settings.OPENAI_API_KEY,
                    )
            except Exception as e:
                print(f"[{self.name}] Failed to initialize LLM: {e}")
                self._llm = None
        return self._llm

    @property
    def db(self):
        if self._db is None:
            self._db = get_sync_db()
        return self._db

    # =========================================================================
    # Core Agent Interface
    # =========================================================================

    @abstractmethod
    def analyze(self, state: MmifAgentState) -> MmifAgentState:
        """Execute this agent's analysis on the current MMIF state."""
        pass

    def __call__(self, state: MmifAgentState) -> MmifAgentState:
        """Make agent callable for LangGraph node integration."""
        state.current_agent = self.name
        state.add_trace(self.name, "started", {"phase": state.phase.value})
        result = self.analyze(state)
        state.add_trace(self.name, "completed", {"phase": state.phase.value})
        return result

    # =========================================================================
    # LLM Helpers
    # =========================================================================

    def llm_reason(
        self, system_prompt: str, user_prompt: str,
        structured_output: bool = False,
    ) -> str:
        """Call the LLM with a system + user prompt pair."""
        if self.llm is None:
            return "LLM unavailable — manual analysis required."

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        try:
            if structured_output:
                response = self.llm.invoke(
                    messages,
                    response_format={"type": "json_object"},
                )
            else:
                response = self.llm.invoke(messages)
            return response.content
        except Exception as e:
            return f"LLM call failed: {e}"

    def llm_classify(self, description: str, categories: list[str]) -> str:
        """Use LLM to classify a break into one of the given categories."""
        system_prompt = (
            "You are an MMIF regulatory filing expert. Classify the following "
            "reconciliation break into exactly one of the provided categories. "
            "Respond with ONLY the category name, nothing else."
        )
        user_prompt = (
            f"Break description: {description}\n\n"
            f"Categories: {', '.join(categories)}\n\n"
            f"Classification:"
        )
        return self.llm_reason(system_prompt, user_prompt).strip()

    # =========================================================================
    # MongoDB Query Helpers
    # =========================================================================

    def query_mongo(self, collection: str, query: dict, projection: dict = None) -> list[dict]:
        """Query a MongoDB collection and return results as list of dicts."""
        proj = projection or {"_id": 0}
        try:
            return list(self.db[collection].find(query, proj))
        except Exception as e:
            print(f"[{self.name}] MongoDB query failed on {collection}: {e}")
            return []

    def query_mongo_one(self, collection: str, query: dict, projection: dict = None) -> Optional[dict]:
        """Query a single MongoDB document."""
        proj = projection or {"_id": 0}
        try:
            return self.db[collection].find_one(query, proj)
        except Exception as e:
            print(f"[{self.name}] MongoDB find_one failed on {collection}: {e}")
            return None

    # =========================================================================
    # Finding Helpers
    # =========================================================================

    def create_finding(
        self,
        description: str,
        evidence: dict = None,
        confidence: float = 0.0,
        recommended_action: str = "",
        level: str = "",
    ) -> AgentFinding:
        """Create a standardized MMIF agent finding."""
        return AgentFinding(
            agent_name=self.name,
            level=level or self.name,
            description=description,
            evidence=evidence or {},
            confidence=confidence,
            recommended_action=recommended_action,
        )


# =============================================================================
# L0 Total Assets Agent
# =============================================================================

class MmifL0TotalAssetsAgent(MmifBaseAgent):
    """
    L0 Total Assets Agent — Validates total assets tie-out (VR-001).

    Responsibilities:
    - Compare Eagle TB total assets vs MMIF Section 4.3
    - Identify primary break driver from the MmifBreakDriver enum
    - Determine materiality for further drill-down
    - Create initial findings with evidence
    """

    MATERIALITY_THRESHOLD = 1.0  # Any variance > $1 in total assets is material

    def __init__(self):
        super().__init__(
            name="MmifL0_TotalAssets",
            description="VR-001 total assets tie-out and primary driver classification",
        )

    def analyze(self, state: MmifAgentState) -> MmifAgentState:
        state.phase = MmifAnalysisPhase.L0_TOTAL_ASSETS
        brk = state.mmif_break
        if not brk:
            return state

        state.add_trace(self.name, "computing_total_assets_variance", {
            "break_id": brk.break_id,
            "rule_id": brk.rule_id,
            "variance": brk.variance,
        })

        # Build variance detail from the break input
        is_material = abs(brk.variance) > self.MATERIALITY_THRESHOLD
        total_assets_variance = VarianceDetail(
            component="TotalAssets_Section4.3",
            eagle_value=brk.eagle_value,
            mmif_value=brk.mmif_value,
            variance_absolute=brk.variance,
            variance_relative=(
                brk.variance / brk.eagle_value if brk.eagle_value != 0 else 0.0
            ),
            is_material=is_material,
            mmif_section="4.3",
            rule_id="VR_001",
        )
        state.total_assets_variance = total_assets_variance

        # Fetch all breaks for this event to understand the full picture
        all_breaks = self.query_mongo(
            COLLECTIONS["mmifBreakRecords"],
            {"eventId": brk.event_id, "fundAccount": brk.fund_account},
        )
        state.all_breaks_for_event = all_breaks

        # Fetch sample data for additional context
        sample_data = self.query_mongo(
            "mmifSampleData",
            {"account": brk.fund_account, "filingPeriod": brk.filing_period},
        )

        # Classify primary break driver
        driver = self._classify_break_driver(brk, all_breaks, sample_data)
        state.primary_driver = driver

        # Use LLM for root cause classification
        llm_analysis = self._llm_classify_driver(brk, all_breaks, driver)

        finding = self.create_finding(
            description=(
                f"VR-001 Total Assets Tie-Out: Eagle TB={brk.eagle_value:,.2f}, "
                f"MMIF Section 4.3={brk.mmif_value:,.2f}, "
                f"Variance={brk.variance:,.2f} (tolerance={brk.tolerance:.2f}). "
                f"Material: {is_material}. Primary driver: {driver.value}. "
                f"Analysis: {llm_analysis[:200]}"
            ),
            evidence={
                "rule_id": brk.rule_id,
                "eagle_value": brk.eagle_value,
                "mmif_value": brk.mmif_value,
                "variance": brk.variance,
                "tolerance": brk.tolerance,
                "is_material": is_material,
                "primary_driver": driver.value,
                "total_breaks_for_event": len(all_breaks),
                "llm_analysis": llm_analysis,
            },
            confidence=0.95,
            recommended_action=(
                f"Dispatch to L1 Section Agent to decompose into "
                f"MMIF sections (3.1/3.2/3.5/4.2) with focus on {driver.value}"
            ),
            level="L0_TOTAL_ASSETS",
        )
        state.l0_findings.append(finding)
        state.add_finding(finding)

        return state

    def _classify_break_driver(
        self,
        brk,
        all_breaks: list[dict],
        sample_data: list[dict],
    ) -> MmifBreakDriver:
        """Classify the primary break driver from available break data."""
        if not all_breaks:
            return MmifBreakDriver.ASSET_MISMATCH

        # Count breaks by rule type to find dominant driver
        rule_counts: dict[str, int] = {}
        for b in all_breaks:
            rid = b.get("ruleId", "")
            rule_counts[rid] = rule_counts.get(rid, 0) + 1

        # Map rule IDs to drivers
        if rule_counts.get("VR_011", 0) > 0:
            return MmifBreakDriver.FX_INCONSISTENCY
        elif rule_counts.get("VR_007", 0) > 0 or rule_counts.get("VR_006", 0) > 0:
            return MmifBreakDriver.MOVEMENT_DISCREPANCY
        elif any(rule_counts.get(r, 0) > 0 for r in ["VR_012", "VR_013", "VR_014"]):
            return MmifBreakDriver.SECURITY_MISMATCH
        elif any(rule_counts.get(r, 0) > 0 for r in ["VR_002", "VR_003", "VR_004", "VR_005"]):
            return MmifBreakDriver.SECTION_MISMATCH
        elif rule_counts.get("VR_001", 0) > 0 and len(rule_counts) == 1:
            return MmifBreakDriver.ASSET_MISMATCH
        else:
            return MmifBreakDriver.MULTI_FACTOR

    def _llm_classify_driver(
        self, brk, all_breaks: list[dict], driver: MmifBreakDriver
    ) -> str:
        """Use LLM to provide narrative classification of the break driver."""
        breaks_summary = "\n".join(
            f"  - {b.get('ruleId', '?')}: {b.get('ruleName', '?')}, "
            f"variance={b.get('variance', 0):,.2f}, severity={b.get('severity', '?')}"
            for b in all_breaks[:10]
        )
        try:
            return self.llm_reason(
                system_prompt=(
                    "You are an MMIF regulatory filing expert. Classify the root cause "
                    "of a total assets discrepancy between Eagle accounting system and "
                    "the MMIF regulatory return. Be concise (2-3 sentences)."
                ),
                user_prompt=(
                    f"Fund: {brk.fund_name} ({brk.fund_account})\n"
                    f"Filing Period: {brk.filing_period}\n"
                    f"Total Assets Eagle: {brk.eagle_value:,.2f}\n"
                    f"Total Assets MMIF: {brk.mmif_value:,.2f}\n"
                    f"Variance: {brk.variance:,.2f}\n"
                    f"Primary Driver (rule-based): {driver.value}\n"
                    f"All breaks for this fund:\n{breaks_summary}\n\n"
                    f"Classify the root cause and indicate which MMIF sections to investigate."
                ),
            )
        except Exception:
            return f"Primary driver: {driver.value}. Further analysis required at L1."


# =============================================================================
# L1 Section Subtotals Agent
# =============================================================================

class MmifL1SectionAgent(MmifBaseAgent):
    """
    L1 Section Agent — Decomposes the break into MMIF section subtotals.

    Sections covered:
    - 3.1 Equities (VR-002)
    - 3.2 Debt Securities (VR-003)
    - 3.5 Cash & Deposits (VR-004)
    - 4.2 Derivatives (VR-005)

    Responsibilities:
    - Check each section's Eagle value vs MMIF value
    - Identify which sections are breaking
    - Quantify each section's contribution to total variance
    """

    SECTION_RULES = {
        "3.1": "VR_002",
        "3.2": "VR_003",
        "3.5": "VR_004",
        "4.2": "VR_005",
    }

    def __init__(self):
        super().__init__(
            name="MmifL1_SectionSubtotals",
            description="Decompose break into MMIF section subtotals (VR-002 through VR-005)",
        )

    def analyze(self, state: MmifAgentState) -> MmifAgentState:
        state.phase = MmifAnalysisPhase.L1_SECTION_SUBTOTALS
        brk = state.mmif_break
        if not brk:
            return state

        state.add_trace(self.name, "decomposing_into_sections", {
            "breaking_sections_expected": list(self.SECTION_RULES.keys()),
        })

        # Fetch sample data for each section
        section_variances = []
        breaking_sections = []

        for section, rule_id in self.SECTION_RULES.items():
            eagle_val, mmif_val = self._get_section_values(
                brk.fund_account, brk.filing_period, rule_id, state.all_breaks_for_event
            )
            variance_abs = eagle_val - mmif_val
            variance_rel = variance_abs / eagle_val if eagle_val != 0 else 0.0

            # Check tolerance for this rule
            tolerance = self._get_rule_tolerance(rule_id)
            is_material = abs(variance_abs) > tolerance

            vd = VarianceDetail(
                component=f"Section_{section}",
                eagle_value=eagle_val,
                mmif_value=mmif_val,
                variance_absolute=variance_abs,
                variance_relative=variance_rel,
                is_material=is_material,
                mmif_section=section,
                rule_id=rule_id,
            )
            section_variances.append(vd)

            if is_material:
                breaking_sections.append(section)
                finding = self.create_finding(
                    description=(
                        f"{rule_id} Section {section}: "
                        f"Eagle={eagle_val:,.2f}, MMIF={mmif_val:,.2f}, "
                        f"Variance={variance_abs:,.2f} "
                        f"({variance_rel:.2%}). Material."
                    ),
                    evidence={
                        "section": section,
                        "rule_id": rule_id,
                        "eagle_value": eagle_val,
                        "mmif_value": mmif_val,
                        "variance_absolute": variance_abs,
                        "variance_relative": variance_rel,
                        "tolerance": tolerance,
                        "contribution_pct": (
                            variance_abs / brk.variance * 100
                            if brk.variance != 0 else 0
                        ),
                    },
                    confidence=0.90,
                    recommended_action=(
                        f"Drill into Section {section} securities for security-level match"
                    ),
                    level="L1_SECTION_SUBTOTALS",
                )
                state.l1_findings.append(finding)
                state.add_finding(finding)

        state.section_variances = section_variances
        state.breaking_sections = breaking_sections

        # LLM analysis of section decomposition
        llm_analysis = self._llm_analyze_sections(brk, section_variances, breaking_sections)

        summary = self.create_finding(
            description=(
                f"Section decomposition: {len(breaking_sections)} breaking section(s) "
                f"out of {len(section_variances)} checked. "
                f"Breaking: {', '.join(f'S{s}' for s in breaking_sections) or 'None'}. "
                f"{llm_analysis[:200]}"
            ),
            evidence={
                "breaking_sections": breaking_sections,
                "total_sections_checked": len(section_variances),
                "llm_analysis": llm_analysis,
            },
            confidence=0.88,
            recommended_action="Dispatch to L2 Security Match Agent for ISIN-level analysis",
            level="L1_SECTION_SUBTOTALS",
        )
        state.l1_findings.append(summary)
        state.add_finding(summary)

        return state

    def _get_section_values(
        self, account: str, filing_period: str,
        rule_id: str, all_breaks: list[dict]
    ) -> tuple[float, float]:
        """Get Eagle and MMIF values for a section from break records or sample data."""
        # First try existing break records for this rule
        for b in all_breaks:
            if b.get("ruleId") == rule_id:
                return b.get("lhsValue", 0.0), b.get("rhsValue", 0.0)

        # Fall back to mmifSampleData
        sample = self.query_mongo_one(
            "mmifSampleData",
            {"account": account, "filingPeriod": filing_period, "ruleId": rule_id},
        )
        if sample:
            return sample.get("eagleValue", 0.0), sample.get("mmifValue", 0.0)

        return 0.0, 0.0

    def _get_rule_tolerance(self, rule_id: str) -> float:
        """Get tolerance for a rule from the validation rules definition."""
        tolerances = {
            "VR_002": 0.01, "VR_003": 0.01, "VR_004": 0.00, "VR_005": 0.05,
        }
        return tolerances.get(rule_id, 0.01)

    def _llm_analyze_sections(
        self, brk, section_variances: list[VarianceDetail], breaking_sections: list[str]
    ) -> str:
        """Use LLM to analyze section-level decomposition."""
        section_summary = "\n".join(
            f"  Section {vd.mmif_section}: Eagle={vd.eagle_value:,.2f}, "
            f"MMIF={vd.mmif_value:,.2f}, Var={vd.variance_absolute:,.2f}, "
            f"Breaking={vd.is_material}"
            for vd in section_variances
        )
        try:
            return self.llm_reason(
                system_prompt=(
                    "You are an MMIF regulatory filing expert. Analyze section-level "
                    "variances in an MMIF regulatory return reconciliation. "
                    "Identify the most likely root cause. Be concise (2-3 sentences)."
                ),
                user_prompt=(
                    f"Fund: {brk.fund_name}, Period: {brk.filing_period}\n"
                    f"Section variances:\n{section_summary}\n"
                    f"Breaking sections: {breaking_sections}\n"
                    f"Identify root cause and recommended investigation steps."
                ),
            )
        except Exception:
            return f"Sections {breaking_sections} require security-level investigation."


# =============================================================================
# L2 Security Match Agent
# =============================================================================

class MmifL2SecurityAgent(MmifBaseAgent):
    """
    L2 Security Match Agent — Matches Eagle positions to MMIF line items by ISIN.

    Checks:
    - VR-012: ISIN Coverage (>95% of positions have valid ISINs)
    - VR-013: Securities Lending Off-BS (Sec lending NOT in total assets)
    - VR-014: Short Position Sign (Short positions as negative asset values)

    Responsibilities:
    - Match Eagle positions to MMIF by ISIN/SEDOL/CUSIP
    - Identify unmatched/mismatched securities
    - Flag sign convention errors and missing ISINs
    """

    def __init__(self):
        super().__init__(
            name="MmifL2_SecurityMatch",
            description="ISIN-level position matching and VR-012/013/014 checks",
        )

    def analyze(self, state: MmifAgentState) -> MmifAgentState:
        state.phase = MmifAnalysisPhase.L2_SECURITY_MATCH
        brk = state.mmif_break
        if not brk:
            return state

        state.add_trace(self.name, "matching_securities_by_isin", {
            "breaking_sections": state.breaking_sections,
        })

        # Fetch Eagle positions for this fund
        positions = self._fetch_eagle_positions(brk.fund_account)

        # VR-012: ISIN Coverage
        isin_coverage, isin_issues = self._check_isin_coverage(positions)
        state.isin_coverage_pct = isin_coverage

        # VR-013: Securities Lending Off-BS
        sec_lending_breaks = self._check_securities_lending(brk, state.all_breaks_for_event)

        # VR-014: Short Position Sign
        short_sign_breaks = self._check_short_position_signs(positions, brk, state.all_breaks_for_event)

        # Build security variances
        security_variances = []
        breaking_securities = []

        # From existing break records for VR_012/013/014
        for b in state.all_breaks_for_event:
            if b.get("ruleId") in ("VR_012", "VR_013", "VR_014"):
                vd = VarianceDetail(
                    component=f"{b.get('ruleId')}_{b.get('fundAccount', '')}",
                    eagle_value=b.get("lhsValue", 0.0),
                    mmif_value=b.get("rhsValue", 0.0),
                    variance_absolute=b.get("variance", 0.0),
                    variance_relative=0.0,
                    is_material=True,
                    rule_id=b.get("ruleId"),
                )
                security_variances.append(vd)
                breaking_securities.append({
                    "rule_id": b.get("ruleId"),
                    "rule_name": b.get("ruleName"),
                    "variance": b.get("variance", 0.0),
                    "severity": b.get("severity"),
                })

        # ISIN coverage finding
        if isin_coverage < 0.95:
            finding = self.create_finding(
                description=(
                    f"VR-012 ISIN Coverage: {isin_coverage:.1%} of positions have valid ISINs "
                    f"(threshold: 95%). {len(isin_issues)} positions missing ISINs."
                ),
                evidence={
                    "isin_coverage_pct": isin_coverage,
                    "positions_checked": len(positions),
                    "missing_isin_count": len(isin_issues),
                    "sample_missing": isin_issues[:5],
                },
                confidence=0.92,
                recommended_action=(
                    "Enrich missing ISIN codes from reference data or SEDOL/CUSIP cross-reference"
                ),
                level="L2_SECURITY_MATCH",
            )
            state.l2_findings.append(finding)
            state.add_finding(finding)

        # Securities lending finding
        if sec_lending_breaks:
            finding = self.create_finding(
                description=(
                    f"VR-013 Securities Lending Off-BS: {len(sec_lending_breaks)} break(s) detected. "
                    f"Securities on loan must NOT be included in total assets."
                ),
                evidence={"breaks": sec_lending_breaks},
                confidence=0.90,
                recommended_action=(
                    "Verify securities on loan are excluded from MMIF Section 3.1/3.2 totals"
                ),
                level="L2_SECURITY_MATCH",
            )
            state.l2_findings.append(finding)
            state.add_finding(finding)

        # Short sign finding
        if short_sign_breaks:
            finding = self.create_finding(
                description=(
                    f"VR-014 Short Position Sign: {len(short_sign_breaks)} short position(s) "
                    f"not reported as negative values in MMIF return."
                ),
                evidence={"breaks": short_sign_breaks[:10]},
                confidence=0.88,
                recommended_action=(
                    "Correct sign convention: short positions must be negative in MMIF"
                ),
                level="L2_SECURITY_MATCH",
            )
            state.l2_findings.append(finding)
            state.add_finding(finding)

        state.security_variances = security_variances
        state.breaking_securities = breaking_securities

        # LLM analysis
        llm_analysis = self._llm_analyze_securities(
            brk, isin_coverage, len(sec_lending_breaks), len(short_sign_breaks)
        )

        summary = self.create_finding(
            description=(
                f"Security match analysis: ISIN coverage={isin_coverage:.1%}, "
                f"Securities lending breaks={len(sec_lending_breaks)}, "
                f"Short sign breaks={len(short_sign_breaks)}. "
                f"{llm_analysis[:200]}"
            ),
            evidence={
                "isin_coverage": isin_coverage,
                "sec_lending_break_count": len(sec_lending_breaks),
                "short_sign_break_count": len(short_sign_breaks),
                "total_positions": len(positions),
                "llm_analysis": llm_analysis,
            },
            confidence=0.87,
            recommended_action="Dispatch to L3 Movement Recon Agent for balance identity checks",
            level="L2_SECURITY_MATCH",
        )
        state.l2_findings.append(summary)
        state.add_finding(summary)

        return state

    def _fetch_eagle_positions(self, account: str) -> list[dict]:
        """Fetch Eagle positions for the fund from MongoDB."""
        return self.query_mongo(
            COLLECTIONS["dataSubLedgerPosition"],
            {"account": account},
            {"_id": 0, "assetId": 1, "isin": 1, "longShortInd": 1,
             "posMarketValueBase": 1, "posShares": 1},
        )

    def _check_isin_coverage(self, positions: list[dict]) -> tuple[float, list[dict]]:
        """Check what fraction of positions have valid ISINs."""
        if not positions:
            return 1.0, []

        missing = []
        for pos in positions:
            # Check ISIN from reference security data
            asset_id = pos.get("assetId", "")
            sec = self.query_mongo_one(
                COLLECTIONS["refSecurity"],
                {"assetId": asset_id},
                {"_id": 0, "isin": 1, "assetId": 1, "issueDescription": 1},
            )
            if not sec or not sec.get("isin"):
                missing.append({
                    "asset_id": asset_id,
                    "description": sec.get("issueDescription", "") if sec else "",
                })

        coverage = 1.0 - (len(missing) / len(positions)) if positions else 1.0
        return coverage, missing

    def _check_securities_lending(self, brk, all_breaks: list[dict]) -> list[dict]:
        """Check VR-013 from existing break records."""
        return [b for b in all_breaks if b.get("ruleId") == "VR_013"]

    def _check_short_position_signs(
        self, positions: list[dict], brk, all_breaks: list[dict]
    ) -> list[dict]:
        """Check VR-014 short position sign conventions."""
        # Check from existing breaks first
        vr014_breaks = [b for b in all_breaks if b.get("ruleId") == "VR_014"]
        if vr014_breaks:
            return vr014_breaks

        # Also check positions directly: short positions with positive market value
        sign_errors = []
        for pos in positions:
            if pos.get("longShortInd", "L") == "S":
                mv = float(pos.get("posMarketValueBase", 0))
                if mv > 0:
                    sign_errors.append({
                        "asset_id": pos.get("assetId"),
                        "long_short_ind": "S",
                        "market_value_base": mv,
                        "issue": "Short position has positive market value",
                    })
        return sign_errors

    def _llm_analyze_securities(
        self, brk, isin_coverage: float,
        sec_lending_breaks: int, short_sign_breaks: int
    ) -> str:
        """Use LLM to analyze security-level findings."""
        try:
            return self.llm_reason(
                system_prompt=(
                    "You are an MMIF regulatory filing expert. Analyze security-level "
                    "reconciliation findings for an MMIF return submission. Be concise."
                ),
                user_prompt=(
                    f"Fund: {brk.fund_name}, Period: {brk.filing_period}\n"
                    f"ISIN Coverage: {isin_coverage:.1%}\n"
                    f"Securities Lending (VR-013) Breaks: {sec_lending_breaks}\n"
                    f"Short Sign (VR-014) Breaks: {short_sign_breaks}\n"
                    f"Provide root cause assessment and next steps."
                ),
            )
        except Exception:
            return "Security-level analysis requires movement reconciliation at L3."


# =============================================================================
# L3 Movement Recon Agent
# =============================================================================

class MmifL3MovementAgent(MmifBaseAgent):
    """
    L3 Movement Recon Agent — Validates movement/flow reconciliation.

    Checks:
    - VR-007: Balance Identity (Opening + Purchases - Sales + Valuation = Closing)
    - VR-006: Opening = Prior Closing (per security)
    - VR-010: P&L Quarter-Only (not YTD cumulative)
    - VR-011: FX Consistency (quarter-end rates applied consistently)
    - VR-015: Investor Decomposition (ΔNAV = valuation + FX + flows + income)

    Responsibilities:
    - Validate the balance identity equation per security
    - Check opening position continuity from prior quarter
    - Validate P&L is quarter-only, not year-to-date
    - Check FX rate consistency across sections
    - Validate investor NAV decomposition
    """

    MOVEMENT_RULES = ["VR_006", "VR_007", "VR_010", "VR_011", "VR_015"]

    def __init__(self):
        super().__init__(
            name="MmifL3_MovementRecon",
            description=(
                "Movement reconciliation: balance identity, opening/closing, "
                "P&L period, FX consistency, investor decomposition"
            ),
        )

    def analyze(self, state: MmifAgentState) -> MmifAgentState:
        state.phase = MmifAnalysisPhase.L3_MOVEMENT_RECON
        brk = state.mmif_break
        if not brk:
            return state

        state.add_trace(self.name, "validating_movements", {
            "rules": self.MOVEMENT_RULES,
        })

        # Extract movement-related breaks from all event breaks
        movement_breaks = [
            b for b in state.all_breaks_for_event
            if b.get("ruleId") in self.MOVEMENT_RULES
        ]

        # Process each movement rule
        balance_identity_breaks = []
        opening_prior_closing_breaks = []
        pnl_period_issues = []
        fx_inconsistencies = []
        investor_decomp_breaks = []
        movement_variances = []

        for b in movement_breaks:
            rule_id = b.get("ruleId", "")
            vd = VarianceDetail(
                component=f"{rule_id}_{b.get('fundAccount', '')}",
                eagle_value=b.get("lhsValue", 0.0),
                mmif_value=b.get("rhsValue", 0.0),
                variance_absolute=b.get("variance", 0.0),
                variance_relative=0.0,
                is_material=True,
                rule_id=rule_id,
            )
            movement_variances.append(vd)

            item = {
                "rule_id": rule_id,
                "rule_name": b.get("ruleName", ""),
                "eagle_value": b.get("lhsValue", 0.0),
                "mmif_value": b.get("rhsValue", 0.0),
                "variance": b.get("variance", 0.0),
                "severity": b.get("severity", ""),
            }

            if rule_id == "VR_007":
                balance_identity_breaks.append(item)
            elif rule_id == "VR_006":
                opening_prior_closing_breaks.append(item)
            elif rule_id == "VR_010":
                pnl_period_issues.append(item)
            elif rule_id == "VR_011":
                fx_inconsistencies.append(item)
            elif rule_id == "VR_015":
                investor_decomp_breaks.append(item)

        state.movement_variances = movement_variances
        state.balance_identity_breaks = balance_identity_breaks
        state.opening_prior_closing_breaks = opening_prior_closing_breaks
        state.pnl_period_issues = pnl_period_issues
        state.fx_inconsistencies = fx_inconsistencies
        state.investor_decomp_breaks = investor_decomp_breaks

        # Create findings for each category
        if balance_identity_breaks:
            finding = self.create_finding(
                description=(
                    f"VR-007 Balance Identity: {len(balance_identity_breaks)} break(s). "
                    f"Opening + Purchases - Sales + Valuation ≠ Closing for some securities."
                ),
                evidence={"breaks": balance_identity_breaks},
                confidence=0.93,
                recommended_action=(
                    "Verify transaction completeness for the quarter: "
                    "check for missing purchases, sales, or corporate action transactions"
                ),
                level="L3_MOVEMENT_RECON",
            )
            state.l3_findings.append(finding)
            state.add_finding(finding)

        if opening_prior_closing_breaks:
            finding = self.create_finding(
                description=(
                    f"VR-006 Opening = Prior Closing: {len(opening_prior_closing_breaks)} break(s). "
                    f"Opening position does not match prior quarter closing."
                ),
                evidence={"breaks": opening_prior_closing_breaks},
                confidence=0.91,
                recommended_action=(
                    "Check roll-forward from Q-1 closing data; "
                    "verify no manual adjustments to opening balances"
                ),
                level="L3_MOVEMENT_RECON",
            )
            state.l3_findings.append(finding)
            state.add_finding(finding)

        if pnl_period_issues:
            finding = self.create_finding(
                description=(
                    f"VR-010 P&L Quarter-Only: {len(pnl_period_issues)} issue(s). "
                    f"Section 2 P&L appears to be YTD cumulative instead of quarter-only."
                ),
                evidence={"breaks": pnl_period_issues},
                confidence=0.89,
                recommended_action=(
                    "Check Eagle P&L extraction: "
                    "ensure quarterly P&L filter is applied, not YTD"
                ),
                level="L3_MOVEMENT_RECON",
            )
            state.l3_findings.append(finding)
            state.add_finding(finding)

        if fx_inconsistencies:
            finding = self.create_finding(
                description=(
                    f"VR-011 FX Consistency: {len(fx_inconsistencies)} inconsistency(ies). "
                    f"Quarter-end FX rates not applied consistently across MMIF sections."
                ),
                evidence={"breaks": fx_inconsistencies},
                confidence=0.87,
                recommended_action=(
                    "Verify a single quarter-end FX rate is applied to all sections; "
                    "check for mixed spot/average rate usage"
                ),
                level="L3_MOVEMENT_RECON",
            )
            state.l3_findings.append(finding)
            state.add_finding(finding)
            if "MmifBreakAnalystAgent" not in state.specialists_invoked:
                state.specialists_invoked.append("MmifBreakAnalystAgent")

        if investor_decomp_breaks:
            finding = self.create_finding(
                description=(
                    f"VR-015 Investor Decomposition: {len(investor_decomp_breaks)} break(s). "
                    f"ΔNAV ≠ valuation change + FX change + net investor flows + net income."
                ),
                evidence={"breaks": investor_decomp_breaks},
                confidence=0.85,
                recommended_action=(
                    "Reconcile NAV components: separate valuation, FX, subscriptions/redemptions, "
                    "and income attribution"
                ),
                level="L3_MOVEMENT_RECON",
            )
            state.l3_findings.append(finding)
            state.add_finding(finding)

        # Always invoke specialist agents
        for specialist in ["MmifSchemaMapperAgent", "MmifBreakAnalystAgent"]:
            if specialist not in state.specialists_invoked:
                state.specialists_invoked.append(specialist)

        # LLM movement analysis
        llm_analysis = self._llm_analyze_movements(brk, movement_breaks)

        summary = self.create_finding(
            description=(
                f"Movement reconciliation: {len(movement_breaks)} movement rule break(s) identified. "
                f"Balance identity={len(balance_identity_breaks)}, "
                f"Opening/closing={len(opening_prior_closing_breaks)}, "
                f"P&L period={len(pnl_period_issues)}, "
                f"FX={len(fx_inconsistencies)}, "
                f"Investor decomp={len(investor_decomp_breaks)}. "
                f"{llm_analysis[:200]}"
            ),
            evidence={
                "total_movement_breaks": len(movement_breaks),
                "balance_identity": len(balance_identity_breaks),
                "opening_closing": len(opening_prior_closing_breaks),
                "pnl_period": len(pnl_period_issues),
                "fx": len(fx_inconsistencies),
                "investor_decomp": len(investor_decomp_breaks),
                "specialists_invoked": state.specialists_invoked,
                "llm_analysis": llm_analysis,
            },
            confidence=0.88,
            recommended_action="Dispatch to Specialist Agents for schema mapping and break pattern analysis",
            level="L3_MOVEMENT_RECON",
        )
        state.l3_findings.append(summary)
        state.add_finding(summary)

        return state

    def _llm_analyze_movements(self, brk, movement_breaks: list[dict]) -> str:
        """Use LLM to analyze movement-level findings."""
        breaks_summary = "\n".join(
            f"  - {b.get('ruleId')}: {b.get('ruleName')}, var={b.get('variance', 0):,.2f}"
            for b in movement_breaks[:10]
        )
        try:
            return self.llm_reason(
                system_prompt=(
                    "You are an MMIF regulatory filing expert specializing in fund flow "
                    "reconciliation. Analyze movement-level breaks in an MMIF return. "
                    "Be concise (2-3 sentences)."
                ),
                user_prompt=(
                    f"Fund: {brk.fund_name}, Period: {brk.filing_period}\n"
                    f"Movement breaks detected:\n{breaks_summary or 'None'}\n"
                    f"Identify root causes and remediation steps."
                ),
            )
        except Exception:
            return "Movement reconciliation findings require specialist review."
