"""
Tests for MMIF LangGraph Workflow — state conversion, routing, and graph structure.
"""
import sys
sys.path.insert(0, "/Volumes/D/Projects/ReconClareAI/backend")

import pytest
from unittest.mock import patch, MagicMock

from agents.mmif_state import (
    MmifAgentState, MmifAnalysisPhase, MmifBreakInput,
    VarianceDetail, MmifBreakDriver,
)
from agents.mmif_workflow import (
    _dict_to_state,
    _state_to_dict,
    should_continue_to_l1,
    should_continue_to_l2,
    should_continue_to_l3,
    build_mmif_workflow,
    compile_mmif_workflow,
)


# =============================================================================
# State Conversion Tests
# =============================================================================

class TestStateConversion:

    def test_dict_to_state_creates_state(self):
        d = {"phase": MmifAnalysisPhase.L0_TOTAL_ASSETS, "step_count": 5}
        state = _dict_to_state(d)
        assert isinstance(state, MmifAgentState)
        assert state.phase == MmifAnalysisPhase.L0_TOTAL_ASSETS
        assert state.step_count == 5

    def test_dict_to_state_passthrough(self):
        original = MmifAgentState()
        original.step_count = 42
        result = _dict_to_state(original)
        assert result is original
        assert result.step_count == 42

    def test_dict_to_state_ignores_unknown_keys(self):
        d = {"phase": MmifAnalysisPhase.INITIATED, "unknown_key": "value"}
        state = _dict_to_state(d)
        assert state.phase == MmifAnalysisPhase.INITIATED
        assert not hasattr(state, "unknown_key") or getattr(state, "unknown_key", None) != "value"

    def test_dict_to_state_empty_dict(self):
        state = _dict_to_state({})
        assert isinstance(state, MmifAgentState)
        assert state.phase == MmifAnalysisPhase.INITIATED

    def test_state_to_dict(self):
        state = MmifAgentState()
        state.step_count = 10
        state.phase = MmifAnalysisPhase.COMPLETED
        d = _state_to_dict(state)
        assert isinstance(d, dict)
        assert d["step_count"] == 10
        assert d["phase"] == MmifAnalysisPhase.COMPLETED

    def test_state_to_dict_includes_all_fields(self):
        state = MmifAgentState()
        d = _state_to_dict(state)
        # Verify key fields are present
        expected_keys = [
            "phase", "step_count", "max_steps", "mmif_break",
            "total_assets_variance", "primary_driver",
            "l0_findings", "l1_findings", "l2_findings", "l3_findings",
            "section_variances", "breaking_sections",
            "security_variances", "breaking_securities", "isin_coverage_pct",
            "attestation_readiness_score", "filing_clearance",
            "overall_confidence", "should_escalate",
            "all_findings", "root_causes",
        ]
        for key in expected_keys:
            assert key in d, f"Missing key: {key}"

    def test_roundtrip_conversion(self):
        state = MmifAgentState()
        state.step_count = 7
        state.phase = MmifAnalysisPhase.L1_SECTION_SUBTOTALS
        state.breaking_sections = ["3.1", "3.5"]
        state.isin_coverage_pct = 0.92

        d = _state_to_dict(state)
        restored = _dict_to_state(d)

        assert restored.step_count == 7
        assert restored.phase == MmifAnalysisPhase.L1_SECTION_SUBTOTALS
        assert restored.breaking_sections == ["3.1", "3.5"]
        assert restored.isin_coverage_pct == 0.92


# =============================================================================
# Conditional Routing Tests
# =============================================================================

class TestConditionalRouting:

    def test_should_continue_to_l1_material(self):
        state = MmifAgentState()
        state.total_assets_variance = VarianceDetail(
            component="TotalAssets", eagle_value=100, mmif_value=90,
            variance_absolute=10, variance_relative=0.1, is_material=True,
        )
        d = _state_to_dict(state)
        assert should_continue_to_l1(d) == "l1_section"

    def test_should_continue_to_l1_immaterial(self):
        state = MmifAgentState()
        state.total_assets_variance = VarianceDetail(
            component="TotalAssets", eagle_value=100, mmif_value=100,
            variance_absolute=0, variance_relative=0, is_material=False,
        )
        d = _state_to_dict(state)
        assert should_continue_to_l1(d) == "specialist_router"

    def test_should_continue_to_l1_no_variance(self):
        state = MmifAgentState()
        state.total_assets_variance = None
        d = _state_to_dict(state)
        # None variance → should skip to specialist (tv is None, tv.is_material would fail)
        # The code checks: if tv and tv.is_material → so None → specialist_router
        assert should_continue_to_l1(d) == "specialist_router"

    def test_should_continue_to_l2_with_breaking_sections(self):
        state = MmifAgentState()
        state.breaking_sections = ["3.1", "3.2"]
        d = _state_to_dict(state)
        assert should_continue_to_l2(d) == "l2_security"

    def test_should_continue_to_l2_no_breaks(self):
        state = MmifAgentState()
        state.breaking_sections = []
        d = _state_to_dict(state)
        assert should_continue_to_l2(d) == "specialist_router"

    def test_should_continue_to_l3_with_breaking_securities(self):
        state = MmifAgentState()
        state.breaking_securities = [{"isin": "IE000001"}]
        d = _state_to_dict(state)
        assert should_continue_to_l3(d) == "l3_movement"

    def test_should_continue_to_l3_low_isin_coverage(self):
        state = MmifAgentState()
        state.isin_coverage_pct = 0.90
        d = _state_to_dict(state)
        assert should_continue_to_l3(d) == "l3_movement"

    def test_should_continue_to_l3_no_issues(self):
        state = MmifAgentState()
        state.breaking_securities = []
        state.isin_coverage_pct = 0.98
        d = _state_to_dict(state)
        assert should_continue_to_l3(d) == "specialist_router"


# =============================================================================
# Workflow Graph Structure Tests
# =============================================================================

class TestWorkflowStructure:

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_build_workflow_returns_state_graph(self, mock_db):
        mock_db.return_value = MagicMock()
        workflow = build_mmif_workflow()
        assert workflow is not None

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_workflow_has_all_nodes(self, mock_db):
        mock_db.return_value = MagicMock()
        workflow = build_mmif_workflow()
        node_names = set(workflow.nodes.keys())
        expected_nodes = {
            "supervisor_init", "l0_total_assets",
            "l1_section", "l2_security", "l3_movement",
            "specialist_router", "attestation", "supervisor_finalize",
        }
        for node in expected_nodes:
            assert node in node_names, f"Missing node: {node}"

    @patch("agents.mmif_level_agents.get_sync_db")
    def test_compile_workflow_succeeds(self, mock_db):
        mock_db.return_value = MagicMock()
        app = compile_mmif_workflow()
        assert app is not None
