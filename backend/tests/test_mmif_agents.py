"""
Tests for MMIF Agents — L0-L3, specialists, and supervisor.
All MongoDB and LLM calls are mocked.
"""
import sys
sys.path.insert(0, "/Volumes/D/Projects/ReconClareAI/backend")

import pytest
from unittest.mock import patch, MagicMock

from agents.mmif_state import (
    MmifAgentState, MmifAnalysisPhase, MmifBreakDriver,
    MmifBreakInput, AgentFinding, VarianceDetail,
)
from agents.mmif_level_agents import (
    MmifBaseAgent,
    MmifL0TotalAssetsAgent,
    MmifL1SectionAgent,
    MmifL2SecurityAgent,
    MmifL3MovementAgent,
)
from agents.mmif_specialist_agents import (
    MmifSchemaMapperAgent,
    MmifBalanceExtractorAgent,
    MmifBreakAnalystAgent,
    MmifAttestationAgent,
)
from agents.mmif_supervisor import MmifSupervisorAgent


# =============================================================================
# Helpers
# =============================================================================

def _make_break(**overrides):
    defaults = dict(
        break_id="BRK-TEST-001",
        event_id="EVT-TEST-001",
        fund_account="IE000001",
        fund_name="Test UCITS Fund",
        filing_period="Q4-2025",
        rule_id="VR_001",
        rule_name="Total Assets Tie-Out",
        severity="HARD",
        mmif_section="4.3",
        eagle_value=100000000.0,
        mmif_value=99985000.0,
        variance=15000.0,
        tolerance=0.0,
    )
    defaults.update(overrides)
    return MmifBreakInput(**defaults)


def _make_state(**overrides):
    state = MmifAgentState()
    state.mmif_break = _make_break()
    for k, v in overrides.items():
        setattr(state, k, v)
    return state


def _mock_db():
    """Return a mock MongoDB that returns empty results by default."""
    mock = MagicMock()
    mock.__getitem__ = MagicMock(return_value=MagicMock(
        find=MagicMock(return_value=MagicMock(to_list=MagicMock(return_value=[]))),
        find_one=MagicMock(return_value=None),
    ))
    return mock


# =============================================================================
# MmifBaseAgent Tests
# =============================================================================

class TestMmifBaseAgent:

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_create_finding(self, mock_db):
        class ConcreteAgent(MmifBaseAgent):
            def analyze(self, state):
                return state

        agent = ConcreteAgent(name="TestAgent", description="Test")
        finding = agent.create_finding(
            description="Test finding",
            evidence={"key": "val"},
            confidence=0.85,
            recommended_action="Fix it",
            level="L0_TOTAL_ASSETS",
        )
        assert isinstance(finding, AgentFinding)
        assert finding.agent_name == "TestAgent"
        assert finding.level == "L0_TOTAL_ASSETS"
        assert finding.confidence == 0.85

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_create_finding_default_level(self, mock_db):
        class ConcreteAgent(MmifBaseAgent):
            def analyze(self, state):
                return state

        agent = ConcreteAgent(name="MyAgent", description="Test")
        finding = agent.create_finding(description="Test")
        assert finding.level == "MyAgent"

    @patch("agents.mmif_level_agents.settings")
    def test_llm_reason_returns_fallback_when_no_llm(self, mock_settings):
        mock_settings.LLM_PROVIDER = ""
        mock_settings.ANTHROPIC_API_KEY = ""
        mock_settings.OPENAI_API_KEY = ""

        class ConcreteAgent(MmifBaseAgent):
            def analyze(self, state):
                return state

        agent = ConcreteAgent(name="X", description="X")
        agent._llm = None
        result = agent.llm_reason("system", "user")
        assert "unavailable" in result.lower() or "manual" in result.lower()

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_call_sets_current_agent_and_trace(self, mock_get_db):
        mock_get_db.return_value = _mock_db()

        class ConcreteAgent(MmifBaseAgent):
            def analyze(self, state):
                return state

        agent = ConcreteAgent(name="TestAgent", description="Test")
        state = MmifAgentState()
        result = agent(state)
        assert result.current_agent == "TestAgent"
        # Should have "started" and "completed" trace entries
        actions = [t["action"] for t in result.agent_trace]
        assert "started" in actions
        assert "completed" in actions

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_query_mongo_returns_empty_on_error(self, mock_get_db):
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(side_effect=Exception("DB error"))
        mock_get_db.return_value = mock_db

        class ConcreteAgent(MmifBaseAgent):
            def analyze(self, state):
                return state

        agent = ConcreteAgent(name="X", description="X")
        result = agent.query_mongo("collection", {})
        assert result == []

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_query_mongo_one_returns_none_on_error(self, mock_get_db):
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(side_effect=Exception("DB error"))
        mock_get_db.return_value = mock_db

        class ConcreteAgent(MmifBaseAgent):
            def analyze(self, state):
                return state

        agent = ConcreteAgent(name="X", description="X")
        result = agent.query_mongo_one("collection", {})
        assert result is None


# =============================================================================
# L0 Total Assets Agent Tests
# =============================================================================

class TestL0TotalAssetsAgent:

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_sets_variance(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifL0TotalAssetsAgent()
        agent._llm = None  # Disable LLM
        state = _make_state()
        result = agent.analyze(state)
        assert result.total_assets_variance is not None
        assert result.total_assets_variance.eagle_value == 100000000.0
        assert result.total_assets_variance.mmif_value == 99985000.0
        assert result.total_assets_variance.is_material is True

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_sets_primary_driver(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifL0TotalAssetsAgent()
        agent._llm = None
        state = _make_state()
        result = agent.analyze(state)
        assert result.primary_driver is not None
        assert isinstance(result.primary_driver, MmifBreakDriver)

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_creates_findings(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifL0TotalAssetsAgent()
        agent._llm = None
        state = _make_state()
        result = agent.analyze(state)
        assert len(result.l0_findings) > 0
        assert len(result.all_findings) > 0

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_sets_phase(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifL0TotalAssetsAgent()
        agent._llm = None
        state = _make_state()
        result = agent.analyze(state)
        assert result.phase == MmifAnalysisPhase.L0_TOTAL_ASSETS

    def test_classify_break_driver_no_breaks(self):
        agent = MmifL0TotalAssetsAgent()
        result = agent._classify_break_driver(_make_break(), [], [])
        assert result == MmifBreakDriver.ASSET_MISMATCH

    def test_classify_break_driver_fx(self):
        agent = MmifL0TotalAssetsAgent()
        breaks = [{"ruleId": "VR_011"}]
        result = agent._classify_break_driver(_make_break(), breaks, [])
        assert result == MmifBreakDriver.FX_INCONSISTENCY

    def test_classify_break_driver_movement(self):
        agent = MmifL0TotalAssetsAgent()
        breaks = [{"ruleId": "VR_007"}]
        result = agent._classify_break_driver(_make_break(), breaks, [])
        assert result == MmifBreakDriver.MOVEMENT_DISCREPANCY

    def test_classify_break_driver_security(self):
        agent = MmifL0TotalAssetsAgent()
        breaks = [{"ruleId": "VR_012"}]
        result = agent._classify_break_driver(_make_break(), breaks, [])
        assert result == MmifBreakDriver.SECURITY_MISMATCH

    def test_classify_break_driver_section(self):
        agent = MmifL0TotalAssetsAgent()
        breaks = [{"ruleId": "VR_002"}]
        result = agent._classify_break_driver(_make_break(), breaks, [])
        assert result == MmifBreakDriver.SECTION_MISMATCH

    def test_classify_break_driver_multi_factor(self):
        agent = MmifL0TotalAssetsAgent()
        breaks = [{"ruleId": "VR_001"}, {"ruleId": "VR_008"}]
        result = agent._classify_break_driver(_make_break(), breaks, [])
        assert result == MmifBreakDriver.MULTI_FACTOR

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_no_break_returns_state(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifL0TotalAssetsAgent()
        state = MmifAgentState()  # No mmif_break
        result = agent.analyze(state)
        assert result.total_assets_variance is None

    def test_materiality_threshold(self):
        assert MmifL0TotalAssetsAgent.MATERIALITY_THRESHOLD == 1.0


# =============================================================================
# L1 Section Agent Tests
# =============================================================================

class TestL1SectionAgent:

    def test_section_rules(self):
        agent = MmifL1SectionAgent()
        assert agent.SECTION_RULES == {
            "3.1": "VR_002", "3.2": "VR_003",
            "3.5": "VR_004", "4.2": "VR_005",
        }

    def test_get_rule_tolerance(self):
        agent = MmifL1SectionAgent()
        assert agent._get_rule_tolerance("VR_002") == 0.01
        assert agent._get_rule_tolerance("VR_003") == 0.01
        assert agent._get_rule_tolerance("VR_004") == 0.00
        assert agent._get_rule_tolerance("VR_005") == 0.05
        assert agent._get_rule_tolerance("VR_999") == 0.01  # default

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_creates_section_variances(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifL1SectionAgent()
        agent._llm = None
        state = _make_state()
        result = agent.analyze(state)
        assert len(result.section_variances) == 4
        assert result.phase == MmifAnalysisPhase.L1_SECTION_SUBTOTALS

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_no_break_returns_state(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifL1SectionAgent()
        state = MmifAgentState()
        result = agent.analyze(state)
        assert result.section_variances == []

    def test_get_section_values_from_breaks(self):
        agent = MmifL1SectionAgent()
        all_breaks = [
            {"ruleId": "VR_002", "lhsValue": 500.0, "rhsValue": 490.0},
        ]
        eagle, mmif = agent._get_section_values("IE000001", "Q4-2025", "VR_002", all_breaks)
        assert eagle == 500.0
        assert mmif == 490.0


# =============================================================================
# L2 Security Agent Tests
# =============================================================================

class TestL2SecurityAgent:

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_sets_phase(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifL2SecurityAgent()
        agent._llm = None
        state = _make_state()
        result = agent.analyze(state)
        assert result.phase == MmifAnalysisPhase.L2_SECURITY_MATCH

    def test_check_isin_coverage_no_positions(self):
        agent = MmifL2SecurityAgent()
        coverage, missing = agent._check_isin_coverage([])
        assert coverage == 1.0
        assert missing == []

    def test_check_securities_lending(self):
        agent = MmifL2SecurityAgent()
        breaks = [
            {"ruleId": "VR_013", "fundAccount": "IE000001"},
            {"ruleId": "VR_001", "fundAccount": "IE000001"},
        ]
        result = agent._check_securities_lending(_make_break(), breaks)
        assert len(result) == 1
        assert result[0]["ruleId"] == "VR_013"

    def test_check_short_positions_from_breaks(self):
        agent = MmifL2SecurityAgent()
        breaks = [{"ruleId": "VR_014", "variance": 5000.0}]
        result = agent._check_short_position_signs([], _make_break(), breaks)
        assert len(result) == 1

    def test_check_short_positions_from_positions(self):
        agent = MmifL2SecurityAgent()
        positions = [
            {"assetId": "A1", "longShortInd": "S", "posMarketValueBase": 100.0},
            {"assetId": "A2", "longShortInd": "L", "posMarketValueBase": 200.0},
        ]
        result = agent._check_short_position_signs(positions, _make_break(), [])
        assert len(result) == 1  # Only the short position with positive value


# =============================================================================
# L3 Movement Agent Tests
# =============================================================================

class TestL3MovementAgent:

    def test_movement_rules(self):
        agent = MmifL3MovementAgent()
        assert set(agent.MOVEMENT_RULES) == {"VR_006", "VR_007", "VR_010", "VR_011", "VR_015"}

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_categorizes_breaks(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifL3MovementAgent()
        agent._llm = None
        state = _make_state(all_breaks_for_event=[
            {"ruleId": "VR_007", "ruleName": "Balance Identity",
             "lhsValue": 100, "rhsValue": 99, "variance": 1, "severity": "DERIVED",
             "fundAccount": "IE000001"},
            {"ruleId": "VR_011", "ruleName": "FX Consistency",
             "lhsValue": 1.12, "rhsValue": 1.10, "variance": 0.02, "severity": "SOFT",
             "fundAccount": "IE000001"},
        ])
        result = agent.analyze(state)
        assert len(result.balance_identity_breaks) == 1
        assert len(result.fx_inconsistencies) == 1
        assert result.phase == MmifAnalysisPhase.L3_MOVEMENT_RECON


# =============================================================================
# Specialist Agent Tests
# =============================================================================

class TestSchemaMapperAgent:

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_no_break_returns_state(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifSchemaMapperAgent()
        state = MmifAgentState()
        result = agent.analyze(state)
        assert result.mapping_gaps == []
        assert result.unmapped_gl_accounts == []

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_with_break_creates_summary(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifSchemaMapperAgent()
        agent._llm = None
        state = _make_state()
        result = agent.analyze(state)
        # Should always create at least a summary finding
        assert len(result.specialist_findings) > 0


class TestBreakAnalystAgent:

    def test_classify_fx_inconsistency(self):
        agent = MmifBreakAnalystAgent()
        state = MmifAgentState()
        state.fx_inconsistencies = [{"issue": "FX rate mismatch"}]
        result = agent._classify_break_pattern(state)
        assert result == "FX_RATE_INCONSISTENCY"

    def test_classify_mapping_gap(self):
        agent = MmifBreakAnalystAgent()
        state = MmifAgentState()
        state.mapping_gaps = [{"issue": "missing mapping"}]
        result = agent._classify_break_pattern(state)
        assert result == "MAPPING_GAP"

    def test_classify_movement_completeness(self):
        agent = MmifBreakAnalystAgent()
        state = MmifAgentState()
        state.balance_identity_breaks = [{"issue": "identity break"}]
        result = agent._classify_break_pattern(state)
        assert result == "MOVEMENT_COMPLETENESS"

    def test_classify_roll_forward_error(self):
        agent = MmifBreakAnalystAgent()
        state = MmifAgentState()
        state.opening_prior_closing_breaks = [{"issue": "mismatch"}]
        result = agent._classify_break_pattern(state)
        assert result == "ROLL_FORWARD_ERROR"

    def test_classify_ytd_vs_qtd(self):
        agent = MmifBreakAnalystAgent()
        state = MmifAgentState()
        state.pnl_period_issues = [{"issue": "YTD detected"}]
        result = agent._classify_break_pattern(state)
        assert result == "YTD_VS_QTD_ERROR"

    def test_classify_sign_convention(self):
        agent = MmifBreakAnalystAgent()
        state = MmifAgentState()
        state.sign_convention_issues = [{"issue": "wrong sign"}]
        result = agent._classify_break_pattern(state)
        assert result == "SIGN_CONVENTION_ERROR"

    def test_classify_section_subtotal(self):
        agent = MmifBreakAnalystAgent()
        state = MmifAgentState()
        state.breaking_sections = ["3.1"]
        result = agent._classify_break_pattern(state)
        assert result == "SECTION_SUBTOTAL_MISMATCH"

    def test_classify_isin_coverage(self):
        agent = MmifBreakAnalystAgent()
        state = MmifAgentState()
        state.isin_coverage_pct = 0.90
        result = agent._classify_break_pattern(state)
        assert result == "ISIN_COVERAGE_GAP"

    def test_classify_unexplained(self):
        agent = MmifBreakAnalystAgent()
        state = MmifAgentState()
        result = agent._classify_break_pattern(state)
        assert result == "TOTAL_ASSETS_UNEXPLAINED"

    def test_synthesize_root_causes_filters_low_confidence(self):
        agent = MmifBreakAnalystAgent()
        state = MmifAgentState()
        state.all_findings = [
            AgentFinding(agent_name="A", level="L0", description="High conf", confidence=0.90),
            AgentFinding(agent_name="B", level="L0", description="Low conf", confidence=0.30),
        ]
        causes = agent._synthesize_root_causes(state)
        assert len(causes) == 1
        assert causes[0]["confidence"] == 0.90

    def test_synthesize_deduplicates(self):
        agent = MmifBreakAnalystAgent()
        state = MmifAgentState()
        state.all_findings = [
            AgentFinding(agent_name="A", level="L0", description="Same finding text", confidence=0.90),
            AgentFinding(agent_name="B", level="L1", description="Same finding text", confidence=0.85),
        ]
        causes = agent._synthesize_root_causes(state)
        assert len(causes) == 1

    def test_synthesize_limits_to_ten(self):
        agent = MmifBreakAnalystAgent()
        state = MmifAgentState()
        state.all_findings = [
            AgentFinding(
                agent_name=f"Agent{i}", level="L0",
                description=f"Unique finding number {i}",
                confidence=0.90 - i * 0.01,
            )
            for i in range(15)
        ]
        causes = agent._synthesize_root_causes(state)
        assert len(causes) <= 10


class TestAttestationAgent:

    def test_hard_block_rules(self):
        expected = {"VR_001", "VR_002", "VR_003", "VR_004",
                    "VR_006", "VR_007", "VR_009", "VR_010",
                    "VR_013", "VR_014"}
        assert MmifAttestationAgent.HARD_BLOCK_RULES == expected

    def test_soft_warn_rules(self):
        expected = {"VR_005", "VR_008", "VR_011", "VR_015"}
        assert MmifAttestationAgent.SOFT_WARN_RULES == expected

    def test_advisory_rules(self):
        assert MmifAttestationAgent.ADVISORY_RULES == {"VR_012"}

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_readiness_score_no_breaks(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifAttestationAgent()
        agent._llm = None
        state = _make_state(all_breaks_for_event=[])
        result = agent.analyze(state)
        assert result.attestation_readiness_score == 1.0
        assert result.filing_clearance is True

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_readiness_score_with_hard_blockers(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifAttestationAgent()
        agent._llm = None
        state = _make_state(all_breaks_for_event=[
            {"ruleId": "VR_001", "ruleName": "Total Assets", "severity": "HARD",
             "variance": 1000, "fundAccount": "IE000001"},
            {"ruleId": "VR_002", "ruleName": "Equity Subtotal", "severity": "HARD",
             "variance": 500, "fundAccount": "IE000001"},
        ])
        result = agent.analyze(state)
        assert result.filing_clearance is False
        assert len(result.attestation_blockers) == 2
        # 2 blockers × 0.15 = 0.30 deduction → score = 0.70
        assert result.attestation_readiness_score == pytest.approx(0.70, abs=0.01)

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_readiness_score_with_soft_warnings(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifAttestationAgent()
        agent._llm = None
        state = _make_state(all_breaks_for_event=[
            {"ruleId": "VR_005", "ruleName": "Derivative Net", "severity": "SOFT",
             "variance": 100, "fundAccount": "IE000001"},
        ])
        result = agent.analyze(state)
        assert result.filing_clearance is True  # Soft breaks don't block
        assert len(result.attestation_warnings) == 1
        # 1 warning × 0.05 = 0.05 deduction → score = 0.95
        assert result.attestation_readiness_score == pytest.approx(0.95, abs=0.01)

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_readiness_score_capped_deductions(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifAttestationAgent()
        agent._llm = None
        # 10 hard blockers → deduction capped at 0.75
        hard_breaks = [
            {"ruleId": "VR_001", "ruleName": f"Rule {i}", "severity": "HARD",
             "variance": 1000, "fundAccount": "IE000001"}
            for i in range(10)
        ]
        state = _make_state(all_breaks_for_event=hard_breaks)
        result = agent.analyze(state)
        assert result.attestation_readiness_score >= 0.0
        # 10 × 0.15 = 1.50 → capped at 0.75 → score = 0.25
        assert result.attestation_readiness_score == pytest.approx(0.25, abs=0.01)

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_unmapped_accounts_add_blocker(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifAttestationAgent()
        agent._llm = None
        state = _make_state(
            all_breaks_for_event=[],
            unmapped_gl_accounts=["GL-101", "GL-102"],
        )
        result = agent.analyze(state)
        assert result.filing_clearance is False
        mapping_blockers = [b for b in result.attestation_blockers if b["rule_id"] == "MAPPING"]
        assert len(mapping_blockers) == 1

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_advisory_breaks_ignored(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifAttestationAgent()
        agent._llm = None
        state = _make_state(all_breaks_for_event=[
            {"ruleId": "VR_012", "ruleName": "ISIN Coverage", "severity": "ADVISORY",
             "variance": 0.05, "fundAccount": "IE000001"},
        ])
        result = agent.analyze(state)
        assert result.filing_clearance is True
        assert len(result.attestation_blockers) == 0
        assert len(result.attestation_warnings) == 0

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_attestation_report_structure(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifAttestationAgent()
        agent._llm = None
        state = _make_state()
        result = agent.analyze(state)
        report = result.attestation_report
        assert "reportId" in report
        assert "eventId" in report
        assert "filingClearance" in report
        assert "readinessScore" in report
        assert "hardBlockers" in report
        assert "softWarnings" in report
        assert "breakSummary" in report


# =============================================================================
# Supervisor Agent Tests
# =============================================================================

class TestSupervisorAgent:

    def test_determine_strategy_critical(self):
        agent = MmifSupervisorAgent()
        brk = _make_break(severity="HARD", variance=200000.0)
        assert agent._determine_strategy(brk) == "CRITICAL_FULL_ANALYSIS"

    def test_determine_strategy_standard(self):
        agent = MmifSupervisorAgent()
        brk = _make_break(severity="HARD", variance=5000.0)
        assert agent._determine_strategy(brk) == "STANDARD_FULL_ANALYSIS"

    def test_determine_strategy_soft(self):
        agent = MmifSupervisorAgent()
        brk = _make_break(severity="SOFT", variance=100.0)
        assert agent._determine_strategy(brk) == "SOFT_BREAK_ANALYSIS"

    def test_determine_strategy_derived(self):
        agent = MmifSupervisorAgent()
        brk = _make_break(severity="DERIVED", variance=100.0)
        assert agent._determine_strategy(brk) == "DERIVED_BREAK_ANALYSIS"

    def test_determine_strategy_advisory(self):
        agent = MmifSupervisorAgent()
        brk = _make_break(severity="ADVISORY", variance=0.05)
        assert agent._determine_strategy(brk) == "ADVISORY_QUICK_CHECK"

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_init_phase(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifSupervisorAgent()
        agent._llm = None
        state = _make_state(phase=MmifAnalysisPhase.INITIATED)
        result = agent.analyze(state)
        # Should add a supervisor message
        assert len(result.messages) > 0
        assert "initiated" in result.messages[0]["content"].lower()

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_finalize_phase(self, mock_get_db):
        mock_db = _mock_db()
        # Make update_one available for persist
        mock_collection = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)
        mock_get_db.return_value = mock_db

        agent = MmifSupervisorAgent()
        agent._llm = None
        state = _make_state(phase=MmifAnalysisPhase.SPECIALIST_ANALYSIS)
        state.all_findings = [
            AgentFinding(agent_name="L0", level="L0_TOTAL_ASSETS",
                         description="Test", confidence=0.85),
        ]
        result = agent.analyze(state)
        assert result.overall_confidence > 0

    def test_calculate_confidence_empty(self):
        agent = MmifSupervisorAgent()
        state = MmifAgentState()
        assert agent._calculate_confidence(state) == 0.0

    def test_calculate_confidence_weighted(self):
        agent = MmifSupervisorAgent()
        state = MmifAgentState()
        state.all_findings = [
            AgentFinding(agent_name="L0", level="L0_TOTAL_ASSETS",
                         description="F1", confidence=0.90),
            AgentFinding(agent_name="L1", level="L1_SECTION_SUBTOTALS",
                         description="F2", confidence=0.80),
        ]
        conf = agent._calculate_confidence(state)
        assert 0 < conf <= 1.0

    def test_aggregate_root_causes_filters_low_confidence(self):
        agent = MmifSupervisorAgent()
        state = MmifAgentState()
        state.all_findings = [
            AgentFinding(agent_name="A", level="L0", description="High", confidence=0.90),
            AgentFinding(agent_name="B", level="L0", description="Low", confidence=0.40),
        ]
        causes = agent._aggregate_root_causes(state)
        assert len(causes) == 1
        assert causes[0]["confidence"] == 0.90

    def test_generate_narrative_no_causes(self):
        agent = MmifSupervisorAgent()
        agent._llm = None
        state = MmifAgentState()
        narrative = agent._generate_narrative(state)
        assert "No root causes" in narrative

    def test_level_weights_defined(self):
        weights = MmifSupervisorAgent.LEVEL_WEIGHTS
        assert "L0_TOTAL_ASSETS" in weights
        assert "L1_SECTION_SUBTOTALS" in weights
        assert "L2_SECURITY_MATCH" in weights
        assert "L3_MOVEMENT_RECON" in weights
        assert "SPECIALIST_SCHEMA_MAPPER" in weights
        assert "SPECIALIST_BALANCE_EXTRACTOR" in weights
        assert "SPECIALIST_BREAK_ANALYST" in weights
        assert "SPECIALIST_ATTESTATION" in weights


# =============================================================================
# Balance Extractor Tests
# =============================================================================

class TestBalanceExtractorAgent:

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_no_break_returns_state(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifBalanceExtractorAgent()
        state = MmifAgentState()
        result = agent.analyze(state)
        assert result.sign_convention_issues == []

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_analyze_creates_summary_finding(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifBalanceExtractorAgent()
        agent._llm = None
        state = _make_state()
        result = agent.analyze(state)
        assert len(result.specialist_findings) > 0

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_fx_inconsistencies_flagged(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifBalanceExtractorAgent()
        agent._llm = None
        state = _make_state(fx_inconsistencies=[{"issue": "FX mismatch"}])
        result = agent.analyze(state)
        assert len(result.currency_conversion_issues) > 0

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_balance_identity_breaks_flagged(self, mock_get_db):
        mock_get_db.return_value = _mock_db()
        agent = MmifBalanceExtractorAgent()
        agent._llm = None
        state = _make_state(balance_identity_breaks=[{"issue": "identity break"}])
        result = agent.analyze(state)
        assert len(result.aggregation_issues) > 0
