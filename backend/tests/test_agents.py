"""
Tests for RECON-AI Agent System.
Validates agent state, workflow structure, and calculation tools.
"""
import pytest
from datetime import date
from decimal import Decimal

from src.agents.state import (
    AgentState, AnalysisPhase, BreakDriver, BreakAlert,
    VarianceDetail, AgentFinding, EscalationReason,
)
from src.agents.tools import CalculationTools


# =============================================================================
# Agent State Tests
# =============================================================================

class TestAgentState:
    """Verify AgentState data model and helper methods."""

    def test_initial_state(self):
        state = AgentState()
        assert state.phase == AnalysisPhase.INITIATED
        assert state.step_count == 0
        assert state.overall_confidence == 0.0
        assert not state.should_escalate
        assert state.all_findings == []

    def test_add_finding(self):
        state = AgentState()
        finding = AgentFinding(
            agent_name="TestAgent",
            level="L0_NAV",
            description="Test finding",
            confidence=0.85,
        )
        state.add_finding(finding)
        assert len(state.all_findings) == 1
        assert state.step_count == 1
        assert state.all_findings[0].agent_name == "TestAgent"

    def test_add_trace(self):
        state = AgentState()
        state.add_trace("TestAgent", "test_action", {"key": "value"})
        assert len(state.agent_trace) == 1
        assert state.agent_trace[0]["agent"] == "TestAgent"
        assert state.agent_trace[0]["action"] == "test_action"

    def test_escalation_low_confidence(self):
        state = AgentState()
        state.phase = AnalysisPhase.L1_GL_ANALYSIS
        state.overall_confidence = 0.50
        result = state.check_escalation(confidence_threshold=0.70)
        assert result is True
        assert state.should_escalate is True
        assert any(r.reason_type == "LOW_CONFIDENCE" for r in state.escalation_reasons)

    def test_escalation_critical_magnitude(self):
        state = AgentState()
        state.break_alert = BreakAlert(
            break_id="TEST-001",
            account="FUND_ABC",
            share_class="CLASS_A",
            valuation_dt=date(2026, 2, 5),
            cpu_nav=204500000.0,
            incumbent_nav=204524500.0,
            variance_absolute=-24500.0,
            variance_relative=-0.0012,
            shares_outstanding=10000000.0,
            nav_per_share_variance=-0.00245,
        )
        result = state.check_escalation(critical_nav_threshold=0.0005)
        assert result is True
        assert any(r.reason_type == "CRITICAL_MAGNITUDE" for r in state.escalation_reasons)

    def test_no_escalation_when_confident(self):
        state = AgentState()
        state.phase = AnalysisPhase.REPORT_GENERATION
        state.overall_confidence = 0.90
        state.matched_patterns = [{"pattern_id": "P1"}]
        state.break_alert = BreakAlert(
            break_id="TEST-002",
            account="FUND_XYZ",
            share_class="CLASS_A",
            valuation_dt=date(2026, 2, 5),
            cpu_nav=100000000.0,
            incumbent_nav=100000100.0,
            variance_absolute=-100.0,
            variance_relative=-0.000001,
            shares_outstanding=5000000.0,
            nav_per_share_variance=-0.00002,
        )
        result = state.check_escalation()
        assert result is False


# =============================================================================
# Break Alert Tests
# =============================================================================

class TestBreakAlert:
    """Verify BreakAlert data model."""

    def test_break_alert_creation(self):
        alert = BreakAlert(
            break_id="BRK-2026-02-05-001",
            account="FUND_ABC",
            share_class="CLASS_A",
            valuation_dt=date(2026, 2, 5),
            cpu_nav=204500000.0,
            incumbent_nav=204524500.0,
            variance_absolute=-24500.0,
            variance_relative=-0.00012,
            shares_outstanding=10000000.0,
            nav_per_share_variance=-0.00245,
            fund_type="FIXED_INCOME",
        )
        assert alert.break_id == "BRK-2026-02-05-001"
        assert alert.variance_absolute == -24500.0
        assert alert.fund_type == "FIXED_INCOME"


# =============================================================================
# Variance Detail Tests
# =============================================================================

class TestVarianceDetail:
    """Verify VarianceDetail data model."""

    def test_variance_detail(self):
        v = VarianceDetail(
            component="ACCRUED_INCOME",
            cpu_value=150000.0,
            incumbent_value=132000.0,
            variance_absolute=18000.0,
            variance_relative=0.1364,
            is_material=True,
        )
        assert v.component == "ACCRUED_INCOME"
        assert v.is_material is True

    def test_variance_with_sub_details(self):
        parent = VarianceDetail(
            component="ASSET",
            cpu_value=204500000.0,
            incumbent_value=204520000.0,
            variance_absolute=-20000.0,
            variance_relative=-0.0001,
            is_material=True,
            sub_details=[
                VarianceDetail(
                    component="CUSIP_123456789",
                    cpu_value=50000000.0,
                    incumbent_value=50015200.0,
                    variance_absolute=-15200.0,
                    variance_relative=-0.0003,
                    is_material=True,
                ),
            ],
        )
        assert len(parent.sub_details) == 1
        assert parent.sub_details[0].component == "CUSIP_123456789"


# =============================================================================
# Calculation Tools Tests (Deterministic)
# =============================================================================

class TestCalculationTools:
    """Verify all deterministic calculation tools per Appendix A."""

    def test_nav_per_share(self):
        result = CalculationTools.nav_per_share(204500000.0, 10000000.0)
        assert result == pytest.approx(20.45, rel=1e-4)

    def test_nav_per_share_zero_shares(self):
        result = CalculationTools.nav_per_share(204500000.0, 0.0)
        assert result == 0.0

    def test_unrealized_gain_loss(self):
        result = CalculationTools.unrealized_gain_loss(105000.0, 100000.0)
        assert result == 5000.0

    def test_daily_accrual_simple(self):
        # $50M face, 5.25% coupon, 1 day, 360 basis
        result = CalculationTools.daily_accrual_simple(
            50000000.0, 0.0525, 1, 360
        )
        assert result == pytest.approx(7291.67, rel=1e-2)

    def test_daily_amortization_straight_line(self):
        # Par $100, Cost $95, 365 days to maturity
        result = CalculationTools.daily_amortization_straight_line(
            100.0, 95.0, 365
        )
        assert result == pytest.approx(0.01370, rel=1e-2)

    def test_daily_variation_margin(self):
        result = CalculationTools.daily_variation_margin(
            today_settlement=2500.0,
            yesterday_settlement=2495.0,
            contract_size=50.0,
            num_contracts=10.0,
        )
        assert result == pytest.approx(2500.0, rel=1e-4)

    def test_day_count_30_360(self):
        result = CalculationTools.day_count_30_360(
            date(2026, 1, 15), date(2026, 2, 15)
        )
        assert result == 30

    def test_day_count_actual(self):
        result = CalculationTools.day_count_actual(
            date(2026, 1, 15), date(2026, 2, 15)
        )
        assert result == 31

    def test_accrual_variance_estimate(self):
        """Test the key accrual variance calculation (Architecture §7.1 Step 5)."""
        result = CalculationTools.accrual_variance_estimate(
            principal=50000000.0,
            annual_rate=0.0525,
            cpu_day_count="ACT/ACT",
            incumbent_day_count="30/360",
            start_date=date(2026, 1, 15),
            end_date=date(2026, 2, 15),
        )
        assert result["cpu_days"] == 31  # Actual days
        assert result["incumbent_days"] == 30  # 30/360 convention
        assert result["day_difference"] == 1
        assert result["variance"] != 0  # There should be a variance
        # CPU accrual should be higher (31 days vs 30 days)
        assert result["cpu_accrual"] > result["incumbent_accrual"]


# =============================================================================
# Analysis Phase Tests
# =============================================================================

class TestAnalysisPhases:
    """Verify all analysis phases are defined per Architecture Spec §7.1."""

    def test_all_phases_exist(self):
        phases = [p.value for p in AnalysisPhase]
        assert "INITIATED" in phases
        assert "L0_NAV_ANALYSIS" in phases
        assert "L1_GL_ANALYSIS" in phases
        assert "L2_SUBLEDGER_ANALYSIS" in phases
        assert "L3_TRANSACTION_ANALYSIS" in phases
        assert "SPECIALIST_ANALYSIS" in phases
        assert "PATTERN_MATCHING" in phases
        assert "REPORT_GENERATION" in phases
        assert "ESCALATED" in phases
        assert "COMPLETED" in phases

    def test_break_drivers(self):
        drivers = [d.value for d in BreakDriver]
        assert "INCOME_DRIVEN" in drivers
        assert "EXPENSE_DRIVEN" in drivers
        assert "POSITION_DRIVEN" in drivers
        assert "CAPITAL_ACTIVITY_DRIVEN" in drivers
        assert "MULTI_FACTOR" in drivers
