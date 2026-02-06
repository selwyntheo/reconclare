"""
Reconciliation-Specific Models - RECON-AI break tracking, analysis, and resolution.
These tables are NOT part of the canonical model but are specific to the
AI reconciliation agent system for tracking breaks, analyses, and patterns.
"""
import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey, Index,
    Integer, JSON, Numeric, String, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, AuditMixin


class BreakLevel(str, enum.Enum):
    """Reconciliation hierarchy levels."""
    L0_NAV = "L0_NAV"
    L1_GL = "L1_GL"
    L2_SUBLEDGER = "L2_SUBLEDGER"
    L3_TRANSACTION = "L3_TRANSACTION"


class BreakCategory(str, enum.Enum):
    """Break classification taxonomy - top-level categories."""
    TIMING = "TIMING"
    METHODOLOGY = "METHODOLOGY"
    DATA = "DATA"
    PRICING = "PRICING"
    CONFIGURATION = "CONFIGURATION"
    ROUNDING = "ROUNDING"


class BreakStatus(str, enum.Enum):
    """Break lifecycle status."""
    DETECTED = "DETECTED"
    ANALYZING = "ANALYZING"
    ROOT_CAUSE_IDENTIFIED = "ROOT_CAUSE_IDENTIFIED"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"
    ACCEPTED = "ACCEPTED"  # Known/expected difference


class ResolutionType(str, enum.Enum):
    """How the break was resolved."""
    CONFIG_FIX = "CONFIG_FIX"
    TIMING_DIFFERENCE = "TIMING_DIFFERENCE"
    CORRECTION_JE = "CORRECTION_JE"
    DATA_FIX = "DATA_FIX"
    ACCEPTED_DIFFERENCE = "ACCEPTED_DIFFERENCE"
    MANUAL_OVERRIDE = "MANUAL_OVERRIDE"


class ReconciliationBreak(Base, AuditMixin):
    """
    Primary break tracking table. One row per detected break per NAV cycle.
    Tracks the full lifecycle from detection through resolution.
    """
    __tablename__ = "reconciliation_break"

    break_id: Mapped[str] = mapped_column(
        String(100), primary_key=True,
        comment="Unique break identifier"
    )

    # --- Break Context ---
    valuation_dt: Mapped[date] = mapped_column(
        Date, nullable=False,
        comment="NAV date of the break"
    )
    account: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Fund/portfolio account"
    )
    share_class: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Share class"
    )

    # --- Break Classification ---
    break_level: Mapped[BreakLevel] = mapped_column(
        Enum(BreakLevel), nullable=False,
        comment="Reconciliation hierarchy level (L0-L3)"
    )
    break_category: Mapped[Optional[BreakCategory]] = mapped_column(
        Enum(BreakCategory), nullable=True,
        comment="Break classification category"
    )
    break_sub_category: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True,
        comment="Break sub-category (e.g., Trade Date vs Settlement Date)"
    )
    status: Mapped[BreakStatus] = mapped_column(
        Enum(BreakStatus), nullable=False, default=BreakStatus.DETECTED,
        comment="Current break lifecycle status"
    )

    # --- Variance Data ---
    cpu_value: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True,
        comment="CPU system value"
    )
    incumbent_value: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True,
        comment="Incumbent system value"
    )
    variance_absolute: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True,
        comment="Absolute variance (CPU - Incumbent)"
    )
    variance_relative: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 10), nullable=True,
        comment="Relative variance as percentage"
    )
    is_material: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="Whether break exceeds materiality threshold"
    )

    # --- Drill-Down Context ---
    gl_account_number: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="GL account (for L1+ breaks)"
    )
    asset_id: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="Security identifier (for L2+ breaks)"
    )
    transaction_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True,
        comment="Transaction identifier (for L3 breaks)"
    )

    # --- AI Analysis ---
    confidence_score: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 4), nullable=True,
        comment="AI confidence in root cause (0.0000 to 1.0000)"
    )
    root_cause_summary: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Plain-language root cause explanation"
    )
    evidence_chain: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True,
        comment="Structured evidence chain (JSON)"
    )
    agent_trace: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True,
        comment="Full agent execution trace for audit"
    )

    # --- Relationships ---
    analyses: Mapped[list["BreakAnalysis"]] = relationship(
        back_populates="break_record", cascade="all, delete-orphan"
    )
    resolution: Mapped[Optional["BreakResolution"]] = relationship(
        back_populates="break_record", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_break_valuation", "valuation_dt"),
        Index("ix_break_account", "account"),
        Index("ix_break_status", "status"),
        Index("ix_break_category", "break_category"),
        Index("ix_break_level", "break_level"),
        Index("ix_break_acct_date", "account", "valuation_dt"),
        Index("ix_break_material", "is_material"),
        {"comment": "Primary break tracking table"},
    )


class BreakAnalysis(Base, AuditMixin):
    """
    Individual analysis steps performed by agents on a break.
    One row per agent analysis step, providing full audit trail.
    """
    __tablename__ = "break_analysis"

    analysis_id: Mapped[str] = mapped_column(
        String(100), primary_key=True,
        comment="Unique analysis step identifier"
    )
    break_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("reconciliation_break.break_id"), nullable=False,
        comment="Parent break identifier"
    )

    # --- Agent Context ---
    agent_name: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="Name of the agent that performed this analysis"
    )
    agent_level: Mapped[BreakLevel] = mapped_column(
        Enum(BreakLevel), nullable=False,
        comment="Reconciliation level of this analysis"
    )
    step_sequence: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="Sequence number within the analysis workflow"
    )

    # --- Analysis Content ---
    action_description: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Description of the analysis action taken"
    )
    findings: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True,
        comment="Structured findings from this analysis step"
    )
    queries_executed: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True,
        comment="Database/graph queries executed (for audit)"
    )
    data_examined: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True,
        comment="Summary of data examined"
    )

    # --- Outcome ---
    conclusion: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Conclusion from this analysis step"
    )
    next_action: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True,
        comment="Recommended next action (dispatch to next agent, escalate, etc.)"
    )
    confidence_delta: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 4), nullable=True,
        comment="Change in confidence from this step"
    )

    # --- Timing ---
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        comment="When this analysis step started"
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="When this analysis step completed"
    )

    # --- Relationships ---
    break_record: Mapped["ReconciliationBreak"] = relationship(
        back_populates="analyses"
    )

    __table_args__ = (
        Index("ix_analysis_break", "break_id"),
        Index("ix_analysis_agent", "agent_name"),
        Index("ix_analysis_level", "agent_level"),
        {"comment": "Individual analysis steps performed by agents"},
    )


class BreakResolution(Base, AuditMixin):
    """
    Resolution record for a break. One row per resolved break.
    """
    __tablename__ = "break_resolution"

    resolution_id: Mapped[str] = mapped_column(
        String(100), primary_key=True,
        comment="Unique resolution identifier"
    )
    break_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("reconciliation_break.break_id"),
        nullable=False, unique=True,
        comment="Parent break identifier"
    )

    # --- Resolution Details ---
    resolution_type: Mapped[ResolutionType] = mapped_column(
        Enum(ResolutionType), nullable=False,
        comment="How the break was resolved"
    )
    resolution_description: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Description of the resolution"
    )
    resolved_by: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="Agent or user who resolved the break"
    )
    resolved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
        comment="When the break was resolved"
    )

    # --- Resolution Artifacts ---
    config_diff: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True,
        comment="Configuration diff if resolution is config fix"
    )
    correction_je: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True,
        comment="Correction journal entry if applicable"
    )
    evidence_pack: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True,
        comment="Supporting evidence package"
    )

    # --- Human Review ---
    human_reviewed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="Whether a human reviewed this resolution"
    )
    reviewer: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True,
        comment="Human reviewer identifier"
    )
    review_outcome: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Review outcome: ACCEPTED, MODIFIED, REJECTED"
    )
    review_notes: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Reviewer notes"
    )

    # --- Relationships ---
    break_record: Mapped["ReconciliationBreak"] = relationship(
        back_populates="resolution"
    )

    __table_args__ = (
        Index("ix_resolution_break", "break_id"),
        Index("ix_resolution_type", "resolution_type"),
        {"comment": "Resolution records for breaks"},
    )


class BreakPattern(Base, AuditMixin):
    """
    Accumulated break patterns for GraphRAG pattern matching.
    Represents learned patterns from resolved breaks.
    """
    __tablename__ = "break_pattern"

    pattern_id: Mapped[str] = mapped_column(
        String(100), primary_key=True,
        comment="Unique pattern identifier"
    )

    # --- Pattern Definition ---
    pattern_name: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Human-readable pattern name"
    )
    pattern_description: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Detailed pattern description"
    )
    break_category: Mapped[BreakCategory] = mapped_column(
        Enum(BreakCategory), nullable=False,
        comment="Pattern break category"
    )
    break_sub_category: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True,
        comment="Pattern sub-category"
    )

    # --- Pattern Characteristics ---
    fund_type_filter: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="Fund type this pattern applies to (Equity/FI/Multi-Asset)"
    )
    security_type_filter: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Security type this pattern applies to"
    )
    typical_variance_range_min: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True,
        comment="Typical minimum variance for this pattern"
    )
    typical_variance_range_max: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True,
        comment="Typical maximum variance for this pattern"
    )

    # --- Pattern Matching ---
    matching_criteria: Mapped[dict] = mapped_column(
        JSON, nullable=False,
        comment="Structured criteria for matching breaks to this pattern"
    )
    resolution_template: Mapped[dict] = mapped_column(
        JSON, nullable=False,
        comment="Template resolution steps for this pattern"
    )
    prevention_rule: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True,
        comment="Prevention rule to avoid this break type"
    )

    # --- Statistics ---
    occurrence_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Number of times this pattern has been observed"
    )
    last_seen_dt: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Last date this pattern was observed"
    )
    avg_confidence: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 4), nullable=True,
        comment="Average confidence when this pattern is matched"
    )
    is_systematic: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="Whether this is a systematic (recurring) issue"
    )

    # --- Graph Reference ---
    graph_node_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True,
        comment="Corresponding node ID in Neo4j break pattern graph"
    )
    graph_community_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True,
        comment="Community ID in the break pattern graph"
    )

    __table_args__ = (
        Index("ix_pattern_category", "break_category"),
        Index("ix_pattern_systematic", "is_systematic"),
        Index("ix_pattern_fund_type", "fund_type_filter"),
        {"comment": "Accumulated break patterns for GraphRAG pattern matching"},
    )
