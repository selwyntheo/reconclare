"""
Subledger Tables - §4 of Canonical Model
Table: dataSubLedgerTrans
Grain: One row per lot per valuation date
"""
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, AuditMixin


class SubLedgerTransaction(Base, AuditMixin):
    """
    dataSubLedgerTrans - Lot-level transaction and position details
    including tax lot accounting information.
    """
    __tablename__ = "data_sub_ledger_trans"

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
    transaction_id: Mapped[str] = mapped_column(
        String(100), primary_key=True,
        comment="Unique transaction or lot identifier"
    )

    # --- Lot Quantity Fields ---
    shares: Mapped[Decimal] = mapped_column(
        Numeric(18, 6), nullable=False,
        comment="Number of shares held, current face"
    )
    original_face: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True,
        comment="For factor based securities, the original face of the lot"
    )

    # --- Lot Cost Fields ---
    orig_cost_local: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Original cost of the lot (local)"
    )
    orig_cost_base: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Original cost of the lot (base)"
    )
    book_value_local: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Current amortized cost of the lot (local)"
    )
    book_value_base: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Current amortized cost of the lot (base)"
    )

    # --- Lot Trade Information ---
    lot_trade_date: Mapped[date] = mapped_column(
        Date, nullable=False,
        comment="Original acquisition trade date of the lot"
    )
    lot_settle_date: Mapped[date] = mapped_column(
        Date, nullable=False,
        comment="Original settled settle date of the lot"
    )
    orig_trade_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True,
        comment="Original trade price of the lot"
    )
    orig_trade_commission: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Commission on original trade of the lot"
    )
    orig_trade_x_rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 10), nullable=True,
        comment="Fx rate on original trade of the lot"
    )
    broker_code: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Lot broker code"
    )

    # --- Lot Market Value Fields ---
    market_value_local: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Current market value of the lot (local)"
    )
    market_value_base: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Current market value of the lot (base)"
    )

    # --- Forward Lot Specific Fields ---
    fwd_long_currency: Mapped[Optional[str]] = mapped_column(
        String(3), nullable=True,
        comment="For forward lots, the receivable currency"
    )
    fwd_short_currency: Mapped[Optional[str]] = mapped_column(
        String(3), nullable=True,
        comment="For forward lots, the payable currency"
    )
    fwd_long_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="For forward lots, the receivable amount"
    )
    fwd_short_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="For forward lots, the payable amount"
    )
    fwd_book_value: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="For forward lots, the book cost"
    )
    fwd_unrealized: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="For forward lots, the total unrealized"
    )

    # --- Lot Income Fields ---
    lot_basis_uid: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="Unique identifier tying lots of different accounting basis"
    )
    income_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Current accrued income on the lot (local)"
    )
    income_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Current accrued income on the lot (base)"
    )
    income_currency: Mapped[Optional[str]] = mapped_column(
        String(3), nullable=True,
        comment="Currency of the lot accrued income (ISO 4217)"
    )

    # --- Transaction RecPay Fields (Unsettled Transactions) ---
    trans_code: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Code designating the type of unsettled transaction"
    )
    trans_units: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True,
        comment="Units of the unsettled transaction"
    )
    trans_currency: Mapped[Optional[str]] = mapped_column(
        String(3), nullable=True,
        comment="Currency of the unsettled transaction"
    )
    trans_amount_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Net local amount of the unsettled transaction"
    )
    trans_amount_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Net traded base amount of the unsettled transaction"
    )
    trans_trade_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Trade date of the unsettled transaction"
    )
    trans_settle_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Settle date of the unsettled transaction"
    )
    trans_market_value: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Net current base amount of the unsettled transaction"
    )
    trans_traded_int_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Traded interest of the unsettled transaction (local)"
    )
    trans_traded_int_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Traded interest of the unsettled transaction (base)"
    )
    trans_traded_int_market: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Base market value of traded interest"
    )

    __table_args__ = (
        Index("ix_subledger_trans_account", "account"),
        Index("ix_subledger_trans_asset", "asset_id"),
        Index("ix_subledger_trans_valuation", "valuation_dt"),
        Index("ix_subledger_trans_lot_date", "lot_trade_date"),
        Index("ix_subledger_trans_acct_date", "account", "valuation_dt"),
        {"comment": "Lot-level transaction and position details"},
    )
