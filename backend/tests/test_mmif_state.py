"""
Tests for MMIF Agent State — dataclasses, enums, and state management.
"""
import sys
sys.path.insert(0, "/Volumes/D/Projects/ReconClareAI/backend")

import pytest
from agents.mmif_state import (
    MmifAnalysisPhase,
    MmifBreakDriver,
    VarianceDetail,
    AgentFinding,
    MmifBreakInput,
    MmifEscalationReason,
    MmifAgentState,
)


# =============================================================================
# Enum Tests
# =============================================================================

class TestMmifAnalysisPhase:

    def test_has_nine_phases(self):
        assert len(MmifAnalysisPhase) == 9

    def test_all_phases_exist(self):
        values = {p.value for p in MmifAnalysisPhase}
        expected = {
            "INITIATED", "L0_TOTAL_ASSETS", "L1_SECTION_SUBTOTALS",
            "L2_SECURITY_MATCH", "L3_MOVEMENT_RECON", "SPECIALIST_ANALYSIS",
            "ATTESTATION", "ESCALATED", "COMPLETED",
        }
        assert values == expected

    def test_is_str_enum(self):
        assert isinstance(MmifAnalysisPhase.INITIATED, str)
        assert MmifAnalysisPhase.INITIATED == "INITIATED"


class TestMmifBreakDriver:

    def test_has_six_drivers(self):
        assert len(MmifBreakDriver) == 6

    def test_all_drivers_exist(self):
        values = {d.value for d in MmifBreakDriver}
        expected = {
            "ASSET_MISMATCH", "SECTION_MISMATCH", "SECURITY_MISMATCH",
            "MOVEMENT_DISCREPANCY", "FX_INCONSISTENCY", "MULTI_FACTOR",
        }
        assert values == expected


# =============================================================================
# Dataclass Tests
# =============================================================================

class TestVarianceDetail:

    def test_creation_with_required_fields(self):
        vd = VarianceDetail(
            component="TotalAssets",
            eagle_value=100.0,
            mmif_value=99.0,
            variance_absolute=1.0,
            variance_relative=0.01,
        )
        assert vd.component == "TotalAssets"
        assert vd.eagle_value == 100.0
        assert vd.mmif_value == 99.0

    def test_defaults(self):
        vd = VarianceDetail(
            component="Test", eagle_value=0, mmif_value=0,
            variance_absolute=0, variance_relative=0,
        )
        assert vd.is_material is False
        assert vd.mmif_section is None
        assert vd.rule_id is None
        assert vd.sub_details == []

    def test_with_sub_details(self):
        child = VarianceDetail(
            component="Child", eagle_value=50, mmif_value=49,
            variance_absolute=1, variance_relative=0.02,
        )
        parent = VarianceDetail(
            component="Parent", eagle_value=100, mmif_value=99,
            variance_absolute=1, variance_relative=0.01,
            sub_details=[child],
        )
        assert len(parent.sub_details) == 1
        assert parent.sub_details[0].component == "Child"

    def test_is_material_flag(self):
        vd = VarianceDetail(
            component="Test", eagle_value=100, mmif_value=50,
            variance_absolute=50, variance_relative=0.5,
            is_material=True,
        )
        assert vd.is_material is True


class TestAgentFinding:

    def test_creation(self):
        f = AgentFinding(
            agent_name="L0Agent",
            level="L0_TOTAL_ASSETS",
            description="Test finding",
            confidence=0.85,
        )
        assert f.agent_name == "L0Agent"
        assert f.level == "L0_TOTAL_ASSETS"
        assert f.confidence == 0.85

    def test_timestamp_auto_set(self):
        f = AgentFinding(agent_name="X", level="L0")
        assert f.timestamp != ""
        assert "T" in f.timestamp  # ISO format

    def test_timestamp_preserved_if_set(self):
        f = AgentFinding(agent_name="X", level="L0", timestamp="2025-01-01T00:00:00")
        assert f.timestamp == "2025-01-01T00:00:00"

    def test_defaults(self):
        f = AgentFinding(agent_name="X", level="L0")
        assert f.description == ""
        assert f.evidence == {}
        assert f.confidence == 0.0
        assert f.recommended_action == ""


class TestMmifBreakInput:

    def test_creation(self):
        brk = MmifBreakInput(
            break_id="BRK-001",
            event_id="EVT-001",
            fund_account="IE000001",
            fund_name="Test Fund",
            filing_period="Q4-2025",
            rule_id="VR_001",
            rule_name="Total Assets Tie-Out",
            severity="HARD",
            mmif_section="4.3",
            eagle_value=100000.0,
            mmif_value=99000.0,
            variance=1000.0,
            tolerance=0.0,
        )
        assert brk.break_id == "BRK-001"
        assert brk.variance == 1000.0
        assert brk.metadata == {}


class TestMmifEscalationReason:

    def test_creation(self):
        r = MmifEscalationReason(
            reason_type="LOW_CONFIDENCE",
            description="Confidence below threshold",
            threshold_value=0.70,
            actual_value=0.50,
        )
        assert r.reason_type == "LOW_CONFIDENCE"
        assert r.threshold_value == 0.70

    def test_optional_fields(self):
        r = MmifEscalationReason(
            reason_type="NOVEL_PATTERN",
            description="No historical patterns",
        )
        assert r.threshold_value is None
        assert r.actual_value is None


# =============================================================================
# MmifAgentState Tests
# =============================================================================

class TestMmifAgentState:

    def test_default_values(self):
        state = MmifAgentState()
        assert state.phase == MmifAnalysisPhase.INITIATED
        assert state.step_count == 0
        assert state.max_steps == 50
        assert state.overall_confidence == 0.0
        assert state.should_escalate is False
        assert state.filing_clearance is False
        assert state.isin_coverage_pct == 1.0
        assert state.all_findings == []
        assert state.root_causes == []
        assert state.mmif_break is None
        assert state.breaking_sections == []
        assert state.breaking_securities == []
        assert state.attestation_readiness_score == 0.0

    def test_add_finding(self):
        state = MmifAgentState()
        finding = AgentFinding(
            agent_name="TestAgent",
            level="L0_TOTAL_ASSETS",
            description="Test",
            confidence=0.85,
        )
        state.add_finding(finding)
        assert len(state.all_findings) == 1
        assert state.step_count == 1
        assert state.all_findings[0].agent_name == "TestAgent"

    def test_add_multiple_findings(self):
        state = MmifAgentState()
        for i in range(5):
            state.add_finding(AgentFinding(
                agent_name=f"Agent{i}", level="L0", confidence=0.8,
            ))
        assert len(state.all_findings) == 5
        assert state.step_count == 5

    def test_add_trace(self):
        state = MmifAgentState()
        state.add_trace("TestAgent", "test_action", {"key": "value"})
        assert len(state.agent_trace) == 1
        trace = state.agent_trace[0]
        assert trace["agent"] == "TestAgent"
        assert trace["action"] == "test_action"
        assert trace["details"] == {"key": "value"}
        assert "timestamp" in trace
        assert trace["step"] == 0

    def test_add_trace_default_details(self):
        state = MmifAgentState()
        state.add_trace("Agent", "action")
        assert state.agent_trace[0]["details"] == {}


class TestMmifAgentStateEscalation:

    def _make_break(self, variance=1000.0):
        return MmifBreakInput(
            break_id="BRK-001", event_id="EVT-001",
            fund_account="IE000001", fund_name="Test Fund",
            filing_period="Q4-2025", rule_id="VR_001",
            rule_name="Total Assets Tie-Out", severity="HARD",
            mmif_section="4.3", eagle_value=100000.0,
            mmif_value=99000.0, variance=variance, tolerance=0.0,
        )

    def test_low_confidence_escalation(self):
        state = MmifAgentState()
        state.phase = MmifAnalysisPhase.L1_SECTION_SUBTOTALS
        state.overall_confidence = 0.50
        result = state.check_escalation(confidence_threshold=0.70)
        assert result is True
        assert state.should_escalate is True
        assert any(r.reason_type == "LOW_CONFIDENCE" for r in state.escalation_reasons)

    def test_no_escalation_at_initiated_phase(self):
        state = MmifAgentState()
        state.phase = MmifAnalysisPhase.INITIATED
        state.overall_confidence = 0.50
        result = state.check_escalation(confidence_threshold=0.70)
        # LOW_CONFIDENCE not triggered at INITIATED phase
        low_conf = [r for r in state.escalation_reasons if r.reason_type == "LOW_CONFIDENCE"]
        assert len(low_conf) == 0

    def test_critical_variance_escalation(self):
        state = MmifAgentState()
        state.mmif_break = self._make_break(variance=200000.0)
        result = state.check_escalation(critical_variance_threshold=100000.0)
        assert result is True
        assert any(r.reason_type == "CRITICAL_VARIANCE" for r in state.escalation_reasons)

    def test_novel_pattern_escalation(self):
        state = MmifAgentState()
        state.phase = MmifAnalysisPhase.SPECIALIST_ANALYSIS
        state.matched_historical_patterns = []  # No patterns
        state.overall_confidence = 0.90  # High confidence to avoid LOW_CONFIDENCE trigger
        result = state.check_escalation()
        assert result is True
        assert any(r.reason_type == "NOVEL_PATTERN" for r in state.escalation_reasons)

    def test_conflicting_causes_escalation(self):
        state = MmifAgentState()
        state.phase = MmifAnalysisPhase.COMPLETED
        state.overall_confidence = 0.90
        state.matched_historical_patterns = [{"id": "1"}]
        state.root_causes = [
            {"confidence": 0.80, "description": "Cause A"},
            {"confidence": 0.75, "description": "Cause B"},  # diff = 0.05 < 0.15
        ]
        result = state.check_escalation()
        assert result is True
        assert any(r.reason_type == "CONFLICTING_CAUSES" for r in state.escalation_reasons)

    def test_no_escalation_when_confident(self):
        state = MmifAgentState()
        state.phase = MmifAnalysisPhase.COMPLETED
        state.overall_confidence = 0.90
        state.matched_historical_patterns = [{"id": "1"}]
        state.mmif_break = self._make_break(variance=500.0)
        state.root_causes = [
            {"confidence": 0.90, "description": "Cause A"},
            {"confidence": 0.50, "description": "Cause B"},  # diff = 0.40 > 0.15
        ]
        result = state.check_escalation()
        assert result is False
        assert state.should_escalate is False
        assert len(state.escalation_reasons) == 0

    def test_escalation_sets_reasons(self):
        state = MmifAgentState()
        state.phase = MmifAnalysisPhase.ATTESTATION
        state.overall_confidence = 0.40
        state.mmif_break = self._make_break(variance=500000.0)
        state.check_escalation()
        # Should have both LOW_CONFIDENCE and CRITICAL_VARIANCE
        types = {r.reason_type for r in state.escalation_reasons}
        assert "LOW_CONFIDENCE" in types
        assert "CRITICAL_VARIANCE" in types

    def test_novel_pattern_not_triggered_at_early_phase(self):
        state = MmifAgentState()
        state.phase = MmifAnalysisPhase.L0_TOTAL_ASSETS
        state.overall_confidence = 0.90
        state.matched_historical_patterns = []
        result = state.check_escalation()
        novel = [r for r in state.escalation_reasons if r.reason_type == "NOVEL_PATTERN"]
        assert len(novel) == 0
