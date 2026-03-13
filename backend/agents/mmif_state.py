"""
MMIF-Specific Agent State for the 6-Agent MMIF Analysis Workflow.

Defines the shared state that flows through the MMIF LangGraph workflow.
Follows state.py patterns exactly, extended for MMIF regulatory filing context.
"""
import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


class MmifAnalysisPhase(str, enum.Enum):
    """Current phase of the MMIF reconciliation analysis workflow."""
    INITIATED = "INITIATED"
    L0_TOTAL_ASSETS = "L0_TOTAL_ASSETS"
    L1_SECTION_SUBTOTALS = "L1_SECTION_SUBTOTALS"
    L2_SECURITY_MATCH = "L2_SECURITY_MATCH"
    L3_MOVEMENT_RECON = "L3_MOVEMENT_RECON"
    SPECIALIST_ANALYSIS = "SPECIALIST_ANALYSIS"
    ATTESTATION = "ATTESTATION"
    ESCALATED = "ESCALATED"
    COMPLETED = "COMPLETED"


class MmifBreakDriver(str, enum.Enum):
    """Primary driver categories for MMIF breaks."""
    ASSET_MISMATCH = "ASSET_MISMATCH"
    SECTION_MISMATCH = "SECTION_MISMATCH"
    SECURITY_MISMATCH = "SECURITY_MISMATCH"
    MOVEMENT_DISCREPANCY = "MOVEMENT_DISCREPANCY"
    FX_INCONSISTENCY = "FX_INCONSISTENCY"
    MULTI_FACTOR = "MULTI_FACTOR"


@dataclass
class VarianceDetail:
    """Variance data at any MMIF reconciliation level."""
    component: str
    eagle_value: float
    mmif_value: float
    variance_absolute: float
    variance_relative: float
    is_material: bool = False
    mmif_section: Optional[str] = None
    rule_id: Optional[str] = None
    sub_details: list["VarianceDetail"] = field(default_factory=list)


@dataclass
class AgentFinding:
    """A single finding from an MMIF agent's analysis."""
    agent_name: str
    level: str
    timestamp: str = ""
    description: str = ""
    evidence: dict = field(default_factory=dict)
    confidence: float = 0.0
    recommended_action: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.utcnow().isoformat()


@dataclass
class MmifBreakInput:
    """Incoming MMIF break input from the validation engine."""
    break_id: str
    event_id: str
    fund_account: str
    fund_name: str
    filing_period: str
    rule_id: str
    rule_name: str
    severity: str
    mmif_section: Optional[str]
    eagle_value: float
    mmif_value: float
    variance: float
    tolerance: float
    metadata: dict = field(default_factory=dict)


@dataclass
class MmifEscalationReason:
    """Reason for escalating MMIF analysis to a human analyst."""
    reason_type: str  # LOW_CONFIDENCE, NOVEL_PATTERN, CRITICAL_VARIANCE, CONFLICTING_CAUSES
    description: str
    threshold_value: Optional[float] = None
    actual_value: Optional[float] = None


@dataclass
class MmifAgentState:
    """
    Shared state flowing through the MMIF LangGraph analysis workflow.
    This is the central data structure that all MMIF agents read from and write to.
    """

    # --- Input: MMIF Break ---
    mmif_break: Optional[MmifBreakInput] = None

    # --- Workflow Control ---
    phase: MmifAnalysisPhase = MmifAnalysisPhase.INITIATED
    current_agent: str = ""
    step_count: int = 0
    max_steps: int = 50

    # --- Event Context (loaded by supervisor) ---
    event_doc: Optional[dict] = None
    fund_doc: Optional[dict] = None
    mapping_config: Optional[dict] = None
    all_breaks_for_event: list[dict] = field(default_factory=list)

    # --- L0 Total Assets Results ---
    total_assets_variance: Optional[VarianceDetail] = None
    primary_driver: Optional[MmifBreakDriver] = None
    l0_findings: list[AgentFinding] = field(default_factory=list)

    # --- L1 Section Subtotals Results ---
    section_variances: list[VarianceDetail] = field(default_factory=list)
    breaking_sections: list[str] = field(default_factory=list)  # e.g. ["3.1", "3.2"]
    l1_findings: list[AgentFinding] = field(default_factory=list)

    # --- L2 Security Match Results ---
    security_variances: list[VarianceDetail] = field(default_factory=list)
    breaking_securities: list[dict] = field(default_factory=list)
    isin_coverage_pct: float = 1.0
    l2_findings: list[AgentFinding] = field(default_factory=list)

    # --- L3 Movement Recon Results ---
    movement_variances: list[VarianceDetail] = field(default_factory=list)
    balance_identity_breaks: list[dict] = field(default_factory=list)
    opening_prior_closing_breaks: list[dict] = field(default_factory=list)
    pnl_period_issues: list[dict] = field(default_factory=list)
    fx_inconsistencies: list[dict] = field(default_factory=list)
    investor_decomp_breaks: list[dict] = field(default_factory=list)
    l3_findings: list[AgentFinding] = field(default_factory=list)

    # --- Specialist Agent Results ---
    specialist_findings: list[AgentFinding] = field(default_factory=list)
    specialists_invoked: list[str] = field(default_factory=list)

    # --- Schema Mapper Findings ---
    mapping_gaps: list[dict] = field(default_factory=list)
    unmapped_gl_accounts: list[str] = field(default_factory=list)
    suggested_mappings: list[dict] = field(default_factory=list)

    # --- Balance Extractor Findings ---
    sign_convention_issues: list[dict] = field(default_factory=list)
    currency_conversion_issues: list[dict] = field(default_factory=list)
    aggregation_issues: list[dict] = field(default_factory=list)

    # --- Break Analyst Findings ---
    matched_historical_patterns: list[dict] = field(default_factory=list)
    root_cause_classification: str = ""
    break_pattern_summary: str = ""

    # --- Attestation Results ---
    attestation_readiness_score: float = 0.0
    attestation_blockers: list[dict] = field(default_factory=list)
    attestation_warnings: list[dict] = field(default_factory=list)
    filing_clearance: bool = False
    attestation_report: dict = field(default_factory=dict)

    # --- Aggregated Results ---
    all_findings: list[AgentFinding] = field(default_factory=list)
    root_causes: list[dict] = field(default_factory=list)
    overall_confidence: float = 0.0
    root_cause_narrative: str = ""

    # --- Escalation ---
    should_escalate: bool = False
    escalation_reasons: list[MmifEscalationReason] = field(default_factory=list)

    # --- Conversation Memory ---
    messages: list[dict] = field(default_factory=list)

    # --- Audit Trail ---
    agent_trace: list[dict] = field(default_factory=list)
    queries_executed: list[dict] = field(default_factory=list)

    def add_finding(self, finding: AgentFinding):
        """Add a finding and update the all_findings aggregate."""
        self.all_findings.append(finding)
        self.step_count += 1

    def add_trace(self, agent: str, action: str, details: dict = None):
        """Add an audit trace entry."""
        self.agent_trace.append({
            "agent": agent,
            "action": action,
            "timestamp": datetime.utcnow().isoformat(),
            "step": self.step_count,
            "details": details or {},
        })

    def check_escalation(
        self,
        confidence_threshold: float = 0.70,
        critical_variance_threshold: float = 100_000.0,
    ) -> bool:
        """Check if the MMIF analysis should be escalated to a human."""
        reasons = []

        if self.overall_confidence < confidence_threshold and self.phase not in (
            MmifAnalysisPhase.INITIATED, MmifAnalysisPhase.L0_TOTAL_ASSETS
        ):
            reasons.append(MmifEscalationReason(
                reason_type="LOW_CONFIDENCE",
                description=(
                    f"Confidence {self.overall_confidence:.2%} below "
                    f"threshold {confidence_threshold:.2%}"
                ),
                threshold_value=confidence_threshold,
                actual_value=self.overall_confidence,
            ))

        if self.mmif_break and abs(self.mmif_break.variance) > critical_variance_threshold:
            reasons.append(MmifEscalationReason(
                reason_type="CRITICAL_VARIANCE",
                description=(
                    f"Break variance {self.mmif_break.variance:,.2f} exceeds "
                    f"critical threshold {critical_variance_threshold:,.2f}"
                ),
                threshold_value=critical_variance_threshold,
                actual_value=abs(self.mmif_break.variance),
            ))

        if not self.matched_historical_patterns and self.phase in (
            MmifAnalysisPhase.SPECIALIST_ANALYSIS, MmifAnalysisPhase.ATTESTATION
        ):
            reasons.append(MmifEscalationReason(
                reason_type="NOVEL_PATTERN",
                description="No matching historical MMIF break patterns found",
            ))

        if len(self.root_causes) > 1:
            confidences = [rc.get("confidence", 0) for rc in self.root_causes]
            if len(confidences) >= 2:
                sorted_c = sorted(confidences, reverse=True)
                if sorted_c[0] - sorted_c[1] < 0.15:
                    reasons.append(MmifEscalationReason(
                        reason_type="CONFLICTING_CAUSES",
                        description="Multiple root causes with similar confidence scores",
                    ))

        self.escalation_reasons = reasons
        self.should_escalate = len(reasons) > 0
        return self.should_escalate
