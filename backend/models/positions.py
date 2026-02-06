"""
Position and Holdings Tables - §3 of Canonical Model
Table: dataSubLedgerPosition
Grain: One row per position per valuation date
"""
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, AuditMixin


class SubLedgerPosition(Base, AuditMixin):
    """
    dataSubLedgerPosition - Position-level holdings data showing current positions
    with market values, income accruals, and unrealized gains/losses.
    """
    __tablename__ = "data_sub_ledger_position"

    # --- Key Fields (Composite PK) ---
    valuation_dt: Mapped[date] = mapped_column(
        Date, primary_key=True,
        comment="Valuation or reporting date"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Source of reporting data"
    )
    account: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Portfolio account identifier"
    )
    acct_basis: Mapped[str] = mapped_column(
        String(20), primary_key=True,
        comment="Code identifying the accounting basis"
    )
    share_class: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Class code/identifier"
    )
    asset_id: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Primary security identifier"
    )
    long_short_ind: Mapped[str] = mapped_column(
        String(1), primary_key=True,
        comment="Indicator of whether the lot is held long or short (L/S)"
    )

    # --- Position Quantity Fields ---
    pos_shares: Mapped[Decimal] = mapped_column(
        Numeric(18, 6), nullable=False,
        comment="Position shares, current face"
    )
    pos_original_face: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True,
        comment="Position original face (for factor securities)"
    )

    # --- Position Cost Fields ---
    pos_orig_cost_local: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Position original local cost"
    )
    pos_orig_cost_base: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Position original base cost"
    )
    pos_book_value_local: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Position current amortized local cost"
    )
    pos_book_value_base: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Position current amortized base cost"
    )

    # --- Position Market Value Fields ---
    pos_market_value_local: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Position current local market value"
    )
    pos_market_value_base: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Position current base market value"
    )
    pos_market_price: Mapped[Decimal] = mapped_column(
        Numeric(18, 6), nullable=False,
        comment="Position current market price"
    )
    pos_unrealized_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Position current local unrealized value (market - book)"
    )
    pos_unrealized_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Position current base unrealized value (market - book)"
    )

    # --- Income Recognition Fields ---
    pos_income_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Position net accrued income local"
    )
    pos_income_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Position net accrued income base"
    )
    pos_income_market: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Market value of position net accrued income base"
    )
    pos_ins_tax_expense_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Local value of position withholding tax expense"
    )
    pos_ins_tax_expense_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Base value of position withholding tax expense"
    )
    pos_inc_reclaim_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Local value of position reclaim receivable"
    )
    pos_inc_reclaim_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Base value of position reclaim receivable"
    )
    pos_inc_deferred_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Local value of position accrued period to date deferred income"
    )
    pos_inc_deferred_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Base value of position accrued period to date deferred income"
    )
    pos_inc_unrealized: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="FX unrealized on position accrued income"
    )
    pos_income_currency: Mapped[Optional[str]] = mapped_column(
        String(3), nullable=True,
        comment="Position currency of accrued income (ISO 4217)"
    )
    pos_prev_coupon_dt: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Previous coupon date of current accrual period"
    )
    pos_next_coupon_dt: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Next coupon date of current accrual period"
    )

    # --- Daily Interest/Amortization Fields ---
    daily_interest_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Daily earned interest local"
    )
    daily_interest_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Daily earned interest base"
    )
    daily_amort_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Daily earned net amortization local"
    )
    daily_amort_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Daily earned net amortization base"
    )

    # --- Variation Margin Fields (Futures) ---
    ltd_variation_margin_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Total life to date local unrealized on futures position"
    )
    ltd_variation_margin_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Total life to date base unrealized on futures position"
    )
    daily_variation_margin_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="One day local unrealized variation margin on futures"
    )
    daily_variation_margin_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="One day base unrealized variation margin on futures"
    )

    __table_args__ = (
        Index("ix_position_account", "account"),
        Index("ix_position_asset", "asset_id"),
        Index("ix_position_valuation", "valuation_dt"),
        Index("ix_position_acct_date", "account", "valuation_dt"),
        Index("ix_position_asset_date", "asset_id", "valuation_dt"),
        {"comment": "Position-level holdings data with market values and income accruals"},
    )
