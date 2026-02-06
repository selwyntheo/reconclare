"""
Data Validation Models - InvestOne to Eagle conversion validation framework.
Encodes the multi-level reconciliation validation matrix (LHS vs RHS)
and derived subledger rollup rules from the validation specification.
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


class ValidationRuleType(str, enum.Enum):
    """Top-level validation rule categories."""
    NAV_TO_LEDGER = "NAV_TO_LEDGER"
    LEDGER_BS_TO_INCST = "LEDGER_BS_TO_INCST"
    LEDGER_TF_TO_CLASS = "LEDGER_TF_TO_CLASS"
    POSITION_TO_LOT = "POSITION_TO_LOT"
    LEDGER_TO_SUBLEDGER = "LEDGER_TO_SUBLEDGER"
    BASIS_LOT_CHECK = "BASIS_LOT_CHECK"


class DerivedRollupCategory(str, enum.Enum):
    """Derived subledger rollup rule categories."""
    CAPITAL_SUBSCRIPTIONS = "CAPITAL_SUBSCRIPTIONS"
    DISTRIBUTION = "DISTRIBUTION"
    FORWARDS = "FORWARDS"
    REPO = "REPO"
    SECURITIES = "SECURITIES"
    LEDGER_LOAD = "LEDGER_LOAD"
    FUTURES_INCOME_UNREALIZED = "FUTURES_INCOME_UNREALIZED"


class ValidationStatus(str, enum.Enum):
    """Validation execution status."""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PASSED = "PASSED"
    FAILED = "FAILED"
    WARNING = "WARNING"
    SKIPPED = "SKIPPED"


class ValidationRule(Base, AuditMixin):
    """
    Validation matrix rule definition. Each rule compares an LHS dataset
    to an RHS dataset using defined keys, comparison fields, and filters.
    Maps directly to §1 of the Data Validation specification.
    """
    __tablename__ = "validation_rule"

    rule_id: Mapped[str] = mapped_column(
        String(100), primary_key=True,
        comment="Unique rule identifier (e.g., VAL-1.1)"
    )
    rule_name: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Human-readable rule name"
    )
    rule_type: Mapped[ValidationRuleType] = mapped_column(
        Enum(ValidationRuleType), nullable=False,
        comment="Validation rule category"
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Detailed rule description"
    )

    # --- LHS Definition ---
    lhs_source: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="LHS data source table/view"
    )
    lhs_keys: Mapped[str] = mapped_column(
        String(500), nullable=False,
        comment="Pipe-delimited LHS join keys"
    )
    lhs_display_fields: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True,
        comment="Pipe-delimited LHS display fields"
    )
    lhs_compare_fields: Mapped[str] = mapped_column(
        String(500), nullable=False,
        comment="Pipe-delimited LHS comparison fields"
    )
    lhs_filter: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="SQL-style LHS filter expression"
    )

    # --- RHS Definition ---
    rhs_source: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="RHS data source table/view"
    )
    rhs_keys: Mapped[str] = mapped_column(
        String(500), nullable=False,
        comment="Pipe-delimited RHS join keys"
    )
    rhs_display_fields: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True,
        comment="Pipe-delimited RHS display fields"
    )
    rhs_compare_fields: Mapped[str] = mapped_column(
        String(500), nullable=False,
        comment="Pipe-delimited RHS comparison fields"
    )
    rhs_filter: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="SQL-style RHS filter expression"
    )

    # --- Thresholds ---
    tolerance_absolute: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True, default=Decimal("0.01"),
        comment="Absolute tolerance for comparison"
    )
    tolerance_relative: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 8), nullable=True,
        comment="Relative tolerance as decimal (e.g., 0.0001 = 0.01%)"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
        comment="Whether this rule is currently active"
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Display sort order"
    )

    # --- Relationships ---
    results: Mapped[list["ValidationResult"]] = relationship(
        back_populates="rule", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_val_rule_type", "rule_type"),
        Index("ix_val_rule_active", "is_active"),
        {"comment": "Validation matrix rule definitions (LHS vs RHS)"},
    )


class ValidationResult(Base, AuditMixin):
    """
    Execution result of a validation rule for a specific valuation date and account.
    """
    __tablename__ = "validation_result"

    result_id: Mapped[str] = mapped_column(
        String(100), primary_key=True,
        comment="Unique result identifier"
    )
    rule_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("validation_rule.rule_id"), nullable=False,
        comment="Parent validation rule"
    )
    valuation_dt: Mapped[date] = mapped_column(
        Date, nullable=False,
        comment="NAV date of validation run"
    )
    account: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Fund/portfolio account"
    )

    # --- Result ---
    status: Mapped[ValidationStatus] = mapped_column(
        Enum(ValidationStatus), nullable=False, default=ValidationStatus.PENDING,
        comment="Validation result status"
    )
    lhs_row_count: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True,
        comment="Number of LHS rows evaluated"
    )
    rhs_row_count: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True,
        comment="Number of RHS rows evaluated"
    )
    matched_count: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True,
        comment="Number of matched rows"
    )
    break_count: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True,
        comment="Number of break rows"
    )
    total_variance: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True,
        comment="Total variance across all breaks"
    )
    max_variance: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True,
        comment="Maximum single-row variance"
    )

    # --- Execution ---
    executed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="When validation was executed"
    )
    execution_duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True,
        comment="Execution duration in milliseconds"
    )
    break_details: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True,
        comment="Detailed break rows (JSON array)"
    )

    # --- Relationships ---
    rule: Mapped["ValidationRule"] = relationship(back_populates="results")

    __table_args__ = (
        Index("ix_val_result_rule", "rule_id"),
        Index("ix_val_result_date", "valuation_dt"),
        Index("ix_val_result_account", "account"),
        Index("ix_val_result_status", "status"),
        Index("ix_val_result_rule_date", "rule_id", "valuation_dt"),
        {"comment": "Validation execution results per rule/date/account"},
    )


class DerivedSubledgerRollupRule(Base, AuditMixin):
    """
    Derived subledger rollup rules used in Ledger-to-Subledger validation.
    Maps directly to §2 of the Data Validation specification.
    """
    __tablename__ = "derived_subledger_rollup_rule"

    rollup_rule_id: Mapped[str] = mapped_column(
        String(100), primary_key=True,
        comment="Unique rollup rule identifier"
    )
    rule_name: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Human-readable rule name"
    )
    category: Mapped[DerivedRollupCategory] = mapped_column(
        Enum(DerivedRollupCategory), nullable=False,
        comment="Rollup rule category"
    )

    # --- Rule Definition ---
    source_table: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="Source data table"
    )
    ledger_account: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Target ledger account number or field reference"
    )
    data_expression: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Data derivation expression"
    )
    filter_expression: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Optional filter expression"
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
        comment="Whether this rule is currently active"
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Display sort order"
    )

    __table_args__ = (
        Index("ix_rollup_category", "category"),
        Index("ix_rollup_active", "is_active"),
        {"comment": "Derived subledger rollup rules for Ledger-to-Subledger validation"},
    )
