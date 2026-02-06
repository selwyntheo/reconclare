"""
Cross-Reference (xref) Tables - §6 of Canonical Model
Tables: xrefAccount, xrefSleeve, xrefClass, xrefBrokerCode, xrefTransaction
"""
from typing import Optional

from sqlalchemy import Index, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, AuditMixin


class XrefAccount(Base, AuditMixin):
    """
    xrefAccount - Cross-reference mapping for account-level attributes across systems.
    Grain: One row per account per system
    """
    __tablename__ = "xref_account"

    account: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Portfolio account identifier"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Source system identifier"
    )

    eagle_act_basis: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Eagle system accounting basis code"
    )
    eagle_source: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Eagle source system identifier"
    )
    chart_of_accounts: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="Chart of accounts identifier"
    )
    account_base_currency: Mapped[Optional[str]] = mapped_column(
        String(3), nullable=True,
        comment="Base currency for the account (ISO 4217)"
    )
    eagle_region: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Eagle region classification"
    )
    ishtar_class: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Ishtar system class code"
    )
    eagle_class: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Eagle class code"
    )
    eagle_class_level_override: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Override for Eagle class level"
    )

    __table_args__ = (
        Index("ix_xref_account_acct", "account"),
        {"comment": "Cross-reference mapping for account-level attributes"},
    )


class XrefSleeve(Base, AuditMixin):
    """
    xrefSleeve - Cross-reference for sleeve and composite account structures.
    Grain: One row per account
    """
    __tablename__ = "xref_sleeve"

    account: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Portfolio account identifier"
    )

    is_sleeve: Mapped[Optional[str]] = mapped_column(
        String(1), nullable=True,
        comment="Indicator if account is a sleeve (Y/N)"
    )
    is_composite: Mapped[Optional[str]] = mapped_column(
        String(1), nullable=True,
        comment="Indicator if account is a composite (Y/N)"
    )

    __table_args__ = (
        {"comment": "Cross-reference for sleeve and composite account structures"},
    )


class XrefClass(Base, AuditMixin):
    """
    xrefClass - Cross-reference for share class mappings.
    Grain: One row per share class
    """
    __tablename__ = "xref_class"

    share_class: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Class code/identifier"
    )

    eagle_class_level_override: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Override for Eagle class level"
    )
    parent_account: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Parent account identifier"
    )
    is_sleeve: Mapped[Optional[str]] = mapped_column(
        String(1), nullable=True,
        comment="Indicator if class is a sleeve (Y/N)"
    )
    is_composite: Mapped[Optional[str]] = mapped_column(
        String(1), nullable=True,
        comment="Indicator if class is a composite (Y/N)"
    )

    __table_args__ = (
        {"comment": "Cross-reference for share class mappings"},
    )


class XrefBrokerCode(Base, AuditMixin):
    """
    xrefBrokerCode - Cross-reference for broker code mappings across systems.
    Grain: One row per broker
    """
    __tablename__ = "xref_broker_code"

    broker_code: Mapped[str] = mapped_column(
        String(20), primary_key=True,
        comment="Broker identifier"
    )

    eagle_broker_code: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Eagle system broker code"
    )

    __table_args__ = (
        {"comment": "Cross-reference for broker code mappings"},
    )


class XrefTransaction(Base, AuditMixin):
    """
    xrefTransaction - Cross-reference for transaction code mappings.
    Grain: One row per transaction code per system
    """
    __tablename__ = "xref_transaction"

    trans_code: Mapped[str] = mapped_column(
        String(20), primary_key=True,
        comment="Transaction code"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Source system identifier"
    )

    eagle_log: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Eagle log transaction type"
    )

    __table_args__ = (
        {"comment": "Cross-reference for transaction code mappings"},
    )
