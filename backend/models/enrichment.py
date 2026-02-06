"""
Enrichment Tables - §7 of Canonical Model
Tables: convTransClassification, convGleanClassification,
        convSecClassification, eagleSecClassification
"""
from typing import Optional

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, AuditMixin


class ConvTransClassification(Base, AuditMixin):
    """
    convTransClassification - Transaction classification enrichment
    for cross-system conversion.
    Grain: One row per transaction classification mapping
    """
    __tablename__ = "conv_trans_classification"

    trans_code: Mapped[str] = mapped_column(
        String(20), primary_key=True,
        comment="Transaction code"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Source system identifier"
    )

    ishtar_account: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="Ishtar system account mapping"
    )

    __table_args__ = (
        {"comment": "Transaction classification enrichment for cross-system conversion"},
    )


class ConvGleanClassification(Base, AuditMixin):
    """
    convGleanClassification - GL account classification enrichment
    for cross-system conversion.
    Grain: One row per GL classification mapping
    """
    __tablename__ = "conv_glean_classification"

    gl_account_number: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="GL account number"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Source system identifier"
    )

    eagle_fiat: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Eagle fiat currency indicator"
    )
    ishtar_ledger_account: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="Ishtar ledger account mapping"
    )

    __table_args__ = (
        {"comment": "GL account classification enrichment"},
    )


class ConvSecClassification(Base, AuditMixin):
    """
    convSecClassification - Security classification enrichment
    for cross-system conversion.
    Grain: One row per security classification mapping
    """
    __tablename__ = "conv_sec_classification"

    asset_id: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Security identifier"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Source system identifier"
    )

    conv_sec_classification_type: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="Security classification type code"
    )

    __table_args__ = (
        {"comment": "Security classification enrichment"},
    )


class EagleSecClassification(Base, AuditMixin):
    """
    eagleSecClassification - Eagle-specific security classification enrichment.
    Grain: One row per security in Eagle
    """
    __tablename__ = "eagle_sec_classification"

    asset_id: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Security identifier"
    )

    eagle_actual: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="Eagle actual classification value"
    )

    __table_args__ = (
        {"comment": "Eagle-specific security classification enrichment"},
    )
