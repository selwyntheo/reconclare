"""
Reference Data Tables - §2 of Canonical Model
Tables: refSecurity, refSecType, refTransCode, refLedger, refFund
"""
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, AuditMixin


class RefSecurity(Base, AuditMixin):
    """
    refSecurity - Master security reference data containing all security
    identifiers and characteristics.
    Grain: One row per security per valuation date per source
    """
    __tablename__ = "ref_security"

    # --- Key Fields ---
    asset_id: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Primary security identifier"
    )
    valuation_dt: Mapped[date] = mapped_column(
        Date, primary_key=True,
        comment="Valuation or reporting date"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Source of reporting data"
    )

    # --- Security Identifier Fields ---
    cusip: Mapped[Optional[str]] = mapped_column(
        String(9), nullable=True,
        comment="CUSIP market identifier (9 chars, North American)"
    )
    sedol: Mapped[Optional[str]] = mapped_column(
        String(7), nullable=True,
        comment="SEDOL market identifier (7 chars, primarily UK)"
    )
    isin: Mapped[Optional[str]] = mapped_column(
        String(12), nullable=True,
        comment="ISIN market identifier (12 chars, international)"
    )
    ticker: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Ticker market identifier"
    )
    sec_type: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="Security type indicator/code"
    )

    # --- Security Descriptive Fields ---
    issue_description: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Security issue description/name"
    )
    asset_currency: Mapped[str] = mapped_column(
        String(3), nullable=False,
        comment="Currency of security issue (ISO 4217)"
    )
    country_code: Mapped[str] = mapped_column(
        String(2), nullable=False,
        comment="Country code of security issue (ISO 3166-1 alpha-2)"
    )

    # --- Fixed Income Specific Fields ---
    issue_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="Issue date of security"
    )
    maturity_dt: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="Maturity date of security"
    )
    coupon_rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 6), nullable=True,
        comment="Coupon rate (decimal: 0.05 = 5%)"
    )
    day_count: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Day count code (30/360, ACT/ACT, ACT/360, etc.)"
    )
    next_call_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="Next call date"
    )
    call_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True, comment="Next call price"
    )
    amort_method: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True,
        comment="Amortization method code (SL=Straight Line, EFF=Effective)"
    )
    factor: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 10), nullable=True,
        comment="Current factor of security (for MBS/ABS)"
    )
    first_coupon_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="First coupon date"
    )
    last_coupon_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="Last coupon date"
    )
    payment_frequency: Mapped[Optional[str]] = mapped_column(
        String(1), nullable=True,
        comment="Coupon payment frequency (M/Q/S/A)"
    )

    # --- Equity Specific Fields ---
    div_frequency: Mapped[Optional[str]] = mapped_column(
        String(1), nullable=True,
        comment="Dividend frequency (M/Q/S/A)"
    )

    __table_args__ = (
        Index("ix_ref_security_cusip", "cusip"),
        Index("ix_ref_security_sedol", "sedol"),
        Index("ix_ref_security_isin", "isin"),
        Index("ix_ref_security_ticker", "ticker"),
        Index("ix_ref_security_sec_type", "sec_type"),
        Index("ix_ref_security_valuation", "valuation_dt"),
        {"comment": "Master security reference data"},
    )


class RefSecType(Base, AuditMixin):
    """
    refSecType - Security type classification reference table.
    Grain: One row per security type
    """
    __tablename__ = "ref_sec_type"

    sec_type: Mapped[str] = mapped_column(
        String(20), primary_key=True,
        comment="Security type indicator/code"
    )
    sec_type_description: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Description of security type"
    )

    __table_args__ = (
        {"comment": "Security type classification reference"},
    )


class RefTransCode(Base, AuditMixin):
    """
    refTransCode - Transaction code reference for all transaction types.
    Grain: One row per transaction code
    """
    __tablename__ = "ref_trans_code"

    trans_code: Mapped[str] = mapped_column(
        String(20), primary_key=True,
        comment="Code designating the type of transaction"
    )
    trans_code_description: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Description of the trans code"
    )

    __table_args__ = (
        {"comment": "Transaction code reference"},
    )


class RefLedger(Base, AuditMixin):
    """
    refLedger - General ledger account chart of accounts.
    Grain: One row per GL account
    """
    __tablename__ = "ref_ledger"

    gl_account_number: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Ledger account identifier"
    )
    gl_description: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Ledger account description"
    )
    gl_category: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="Ledger account category (ASSET/LIABILITY/EQUITY/INCOME/EXPENSE)"
    )

    __table_args__ = (
        Index("ix_ref_ledger_category", "gl_category"),
        {"comment": "General ledger account chart of accounts"},
    )


class RefFund(Base, AuditMixin):
    """
    refFund - Fund/Portfolio master reference data.
    Grain: One row per fund/portfolio
    """
    __tablename__ = "ref_fund"

    account: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Portfolio account identifier"
    )
    account_name: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Portfolio name/description"
    )

    __table_args__ = (
        {"comment": "Fund/Portfolio master reference data"},
    )
