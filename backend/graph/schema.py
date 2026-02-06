"""
Neo4j Graph Schema Definitions for RECON-AI GraphRAG.

Four graph layers per Architecture Specification §4.2:
1. Domain Entity Graph (Static) - Fund accounting structural relationships
2. Accounting Rule Graph (Semi-Static) - Calculation rules and conventions
3. Transaction Lineage Graph (Dynamic) - Operational data per NAV cycle
4. Break Pattern Graph (Accumulated) - Learned patterns from resolved breaks
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# =============================================================================
# Node Label Definitions
# =============================================================================

class NodeLabel(str, Enum):
    """All node labels in the RECON-AI knowledge graph."""

    # --- Domain Entity Graph (Static) ---
    FUND = "Fund"
    SHARE_CLASS = "ShareClass"
    NAV_COMPONENT = "NAVComponent"
    GL_ACCOUNT = "GLAccount"
    SUB_LEDGER_POSITION = "SubLedgerPosition"
    TRANSACTION = "Transaction"
    SECURITY = "Security"
    PRICING_SOURCE = "PricingSource"
    EXCHANGE = "Exchange"
    CURRENCY = "Currency"
    COUNTERPARTY = "Counterparty"
    SETTLEMENT_INSTRUCTION = "SettlementInstruction"
    CUSTODIAN_ACCOUNT = "CustodianAccount"
    CORPORATE_ACTION = "CorporateAction"
    EVENT_TYPE = "EventType"
    PROCESSING_RULE = "ProcessingRule"

    # --- Accounting Rule Graph (Semi-Static) ---
    ACCRUAL_METHOD = "AccrualMethod"
    DAY_COUNT_CONVENTION = "DayCountConvention"
    CALCULATION_FORMULA = "CalculationFormula"
    GL_MAPPING_RULE = "GLMappingRule"
    TRANSACTION_TYPE = "TransactionType"
    AMORTIZATION_SCHEDULE = "AmortizationSchedule"
    SECURITY_TYPE = "SecurityType"
    NAV_CALCULATION_RULE = "NAVCalculationRule"
    COMPONENT_INCLUSION = "ComponentInclusion"
    TIMING_CUTOFF = "TimingCutoff"

    # --- Transaction Lineage Graph (Dynamic) ---
    NAV_PUBLICATION = "NAVPublication"
    GL_SNAPSHOT = "GLSnapshot"
    NAV_CYCLE = "NAVCycle"
    TRADE = "Trade"
    ALLOCATION = "Allocation"
    SETTLEMENT = "Settlement"
    CASH_MOVEMENT = "CashMovement"
    GL_POSTING = "GLPosting"
    CA_EVENT = "CorporateActionEvent"
    ENTITLEMENT = "Entitlement"
    CASH_FLOW = "CashFlow"
    POSITION_ADJUSTMENT = "PositionAdjustment"

    # --- Break Pattern Graph (Accumulated) ---
    BREAK_INSTANCE = "BreakInstance"
    BREAK_CATEGORY = "BreakCategory"
    ROOT_CAUSE = "RootCause"
    RESOLUTION = "Resolution"
    PREVENTION_RULE = "PreventionRule"
    BREAK_PATTERN = "BreakPattern"
    FUND_CHARACTERISTIC = "FundCharacteristic"
    BREAK_CLUSTER = "BreakCluster"
    SYSTEMATIC_ISSUE = "SystematicIssue"
    CONFIGURATION_FIX = "ConfigurationFix"


# =============================================================================
# Relationship Type Definitions
# =============================================================================

class RelationshipType(str, Enum):
    """All relationship types in the RECON-AI knowledge graph."""

    # --- Domain Entity Graph ---
    HAS_CLASS = "HAS_CLASS"                    # Fund → ShareClass
    HAS_NAV_COMPONENT = "HAS_NAV_COMPONENT"    # ShareClass → NAVComponent
    MAPS_TO_GL = "MAPS_TO_GL"                  # NAVComponent → GLAccount
    HAS_POSITION = "HAS_POSITION"              # GLAccount → SubLedgerPosition
    HAS_TRANSACTION = "HAS_TRANSACTION"        # SubLedgerPosition → Transaction
    INVOLVES_SECURITY = "INVOLVES_SECURITY"    # Transaction/Position → Security
    PRICED_BY = "PRICED_BY"                    # Security → PricingSource
    TRADED_ON = "TRADED_ON"                    # Security → Exchange
    DENOMINATED_IN = "DENOMINATED_IN"          # Security/Fund → Currency
    SETTLED_WITH = "SETTLED_WITH"              # Transaction → Counterparty
    HAS_SETTLEMENT = "HAS_SETTLEMENT"          # Counterparty → SettlementInstruction
    CUSTODIED_AT = "CUSTODIED_AT"              # SettlementInstruction → CustodianAccount
    AFFECTS_SECURITY = "AFFECTS_SECURITY"      # CorporateAction → Security
    OF_EVENT_TYPE = "OF_EVENT_TYPE"            # CorporateAction → EventType
    PROCESSED_BY = "PROCESSED_BY"              # CorporateAction → ProcessingRule

    # --- Accounting Rule Graph ---
    USES_METHOD = "USES_METHOD"                # AccrualMethod → DayCountConvention
    APPLIES_FORMULA = "APPLIES_FORMULA"        # DayCountConvention → CalculationFormula
    MAPS_DEBIT = "MAPS_DEBIT"                 # GLMappingRule → GLAccount (debit)
    MAPS_CREDIT = "MAPS_CREDIT"               # GLMappingRule → GLAccount (credit)
    FOR_TRANSACTION_TYPE = "FOR_TRANSACTION_TYPE"  # GLMappingRule → TransactionType
    AMORTIZES_BY = "AMORTIZES_BY"             # AmortizationSchedule → SecurityType
    USES_AMORT_METHOD = "USES_AMORT_METHOD"   # AmortizationSchedule → method
    INCLUDES_COMPONENT = "INCLUDES_COMPONENT"  # NAVCalculationRule → ComponentInclusion
    HAS_CUTOFF = "HAS_CUTOFF"                 # NAVCalculationRule → TimingCutoff

    # --- Transaction Lineage Graph ---
    PUBLISHED_IN = "PUBLISHED_IN"              # NAVPublication → NAVCycle
    SNAPSHOT_OF = "SNAPSHOT_OF"                # GLSnapshot → NAVCycle
    CONTAINS_POSITION = "CONTAINS_POSITION"    # GLSnapshot → SubLedgerPosition
    GENERATED_BY = "GENERATED_BY"              # SubLedgerPosition → Transaction
    ALLOCATED_TO = "ALLOCATED_TO"              # Trade → Allocation
    SETTLED_AS = "SETTLED_AS"                  # Allocation → Settlement
    PRODUCES_CASH = "PRODUCES_CASH"            # Settlement → CashMovement
    POSTED_TO = "POSTED_TO"                    # CashMovement → GLPosting
    TRIGGERS_ENTITLEMENT = "TRIGGERS_ENTITLEMENT"  # CAEvent → Entitlement
    GENERATES_CASHFLOW = "GENERATES_CASHFLOW"  # Entitlement → CashFlow
    ADJUSTS_POSITION = "ADJUSTS_POSITION"      # CashFlow → PositionAdjustment

    # --- Break Pattern Graph ---
    CLASSIFIED_AS = "CLASSIFIED_AS"            # BreakInstance → BreakCategory
    CAUSED_BY = "CAUSED_BY"                    # BreakInstance → RootCause
    RESOLVED_WITH = "RESOLVED_WITH"            # BreakInstance → Resolution
    PREVENTED_BY = "PREVENTED_BY"              # BreakInstance → PreventionRule
    MATCHES_PATTERN = "MATCHES_PATTERN"        # BreakInstance → BreakPattern
    ASSOCIATED_WITH_FUND = "ASSOCIATED_WITH_FUND"  # BreakPattern → FundCharacteristic
    ASSOCIATED_WITH_SEC = "ASSOCIATED_WITH_SEC"    # BreakPattern → SecurityType
    ASSOCIATED_WITH_TRANS = "ASSOCIATED_WITH_TRANS"  # BreakPattern → TransactionType
    BELONGS_TO_CLUSTER = "BELONGS_TO_CLUSTER"  # BreakPattern → BreakCluster
    INDICATES_ISSUE = "INDICATES_ISSUE"        # BreakCluster → SystematicIssue
    FIXED_BY = "FIXED_BY"                      # SystematicIssue → ConfigurationFix
    SIMILAR_TO = "SIMILAR_TO"                  # BreakInstance → BreakInstance (similarity)

    # --- Cross-System Mapping ---
    CPU_MAPS_TO = "CPU_MAPS_TO"                # CPU entity → Incumbent entity
    INCUMBENT_MAPS_TO = "INCUMBENT_MAPS_TO"    # Incumbent entity → CPU entity

    # --- Impact Analysis ---
    IMPACTS_POSITION = "IMPACTS_POSITION"      # Transaction → SubLedgerPosition
    IMPACTS_GL = "IMPACTS_GL"                  # SubLedgerPosition → GLAccount
    IMPACTS_NAV = "IMPACTS_NAV"                # GLAccount → NAVComponent


# =============================================================================
# Node Property Schemas
# =============================================================================

@dataclass
class NodeSchema:
    """Schema definition for a graph node type."""
    label: NodeLabel
    properties: dict = field(default_factory=dict)
    indexes: list = field(default_factory=list)
    constraints: list = field(default_factory=list)


# --- Domain Entity Graph Node Schemas ---

FUND_SCHEMA = NodeSchema(
    label=NodeLabel.FUND,
    properties={
        "account": "STRING",
        "account_name": "STRING",
        "base_currency": "STRING",
        "fund_type": "STRING",
        "is_composite": "BOOLEAN",
        "is_sleeve": "BOOLEAN",
        "source_system": "STRING",
    },
    indexes=["account"],
    constraints=["account IS UNIQUE"],
)

SHARE_CLASS_SCHEMA = NodeSchema(
    label=NodeLabel.SHARE_CLASS,
    properties={
        "share_class": "STRING",
        "parent_account": "STRING",
        "is_sleeve": "BOOLEAN",
        "is_composite": "BOOLEAN",
    },
    indexes=["share_class"],
    constraints=["share_class IS UNIQUE"],
)

GL_ACCOUNT_SCHEMA = NodeSchema(
    label=NodeLabel.GL_ACCOUNT,
    properties={
        "gl_account_number": "STRING",
        "gl_description": "STRING",
        "gl_category": "STRING",
        "system": "STRING",  # CPU or INCUMBENT
    },
    indexes=["gl_account_number", "gl_category"],
    constraints=["gl_account_number IS UNIQUE"],
)

SECURITY_SCHEMA = NodeSchema(
    label=NodeLabel.SECURITY,
    properties={
        "asset_id": "STRING",
        "cusip": "STRING",
        "sedol": "STRING",
        "isin": "STRING",
        "ticker": "STRING",
        "sec_type": "STRING",
        "issue_description": "STRING",
        "asset_currency": "STRING",
        "country_code": "STRING",
        "coupon_rate": "FLOAT",
        "day_count": "STRING",
        "maturity_dt": "DATE",
        "amort_method": "STRING",
        "factor": "FLOAT",
        "payment_frequency": "STRING",
    },
    indexes=["asset_id", "cusip", "isin", "sedol", "sec_type"],
    constraints=["asset_id IS UNIQUE"],
)

NAV_COMPONENT_SCHEMA = NodeSchema(
    label=NodeLabel.NAV_COMPONENT,
    properties={
        "component_id": "STRING",
        "component_name": "STRING",
        "component_type": "STRING",  # INVESTMENT_AT_MARKET, ACCRUED_INCOME, RECEIVABLES, PAYABLES, CAPITAL
        "sign": "INTEGER",  # +1 or -1 for NAV contribution
    },
    indexes=["component_id", "component_type"],
)

TRANSACTION_SCHEMA = NodeSchema(
    label=NodeLabel.TRANSACTION,
    properties={
        "transaction_id": "STRING",
        "trans_code": "STRING",
        "trade_date": "DATE",
        "settle_date": "DATE",
        "units": "FLOAT",
        "amount_local": "FLOAT",
        "amount_base": "FLOAT",
        "currency": "STRING",
        "asset_id": "STRING",
        "account": "STRING",
        "system": "STRING",  # CPU or INCUMBENT
    },
    indexes=["transaction_id", "trade_date", "asset_id", "account"],
)

# --- Accounting Rule Graph Node Schemas ---

ACCRUAL_METHOD_SCHEMA = NodeSchema(
    label=NodeLabel.ACCRUAL_METHOD,
    properties={
        "method_id": "STRING",
        "method_name": "STRING",
        "description": "STRING",
        "applicable_sec_types": "LIST<STRING>",
    },
    indexes=["method_id"],
)

DAY_COUNT_CONVENTION_SCHEMA = NodeSchema(
    label=NodeLabel.DAY_COUNT_CONVENTION,
    properties={
        "convention_id": "STRING",
        "convention_name": "STRING",  # 30/360, ACT/ACT, ACT/360
        "numerator_rule": "STRING",
        "denominator_rule": "STRING",
    },
    indexes=["convention_id"],
)

GL_MAPPING_RULE_SCHEMA = NodeSchema(
    label=NodeLabel.GL_MAPPING_RULE,
    properties={
        "rule_id": "STRING",
        "rule_name": "STRING",
        "source_system": "STRING",
        "debit_account": "STRING",
        "credit_account": "STRING",
        "conditions": "STRING",
    },
    indexes=["rule_id"],
)

NAV_CALCULATION_RULE_SCHEMA = NodeSchema(
    label=NodeLabel.NAV_CALCULATION_RULE,
    properties={
        "rule_id": "STRING",
        "rule_name": "STRING",
        "formula": "STRING",
        "timing_cutoff": "STRING",
        "rounding_rule": "STRING",
    },
    indexes=["rule_id"],
)

# --- Break Pattern Graph Node Schemas ---

BREAK_INSTANCE_SCHEMA = NodeSchema(
    label=NodeLabel.BREAK_INSTANCE,
    properties={
        "break_id": "STRING",
        "valuation_dt": "DATE",
        "account": "STRING",
        "share_class": "STRING",
        "break_level": "STRING",
        "break_category": "STRING",
        "variance_absolute": "FLOAT",
        "variance_relative": "FLOAT",
        "confidence_score": "FLOAT",
        "root_cause_summary": "STRING",
        "status": "STRING",
    },
    indexes=["break_id", "valuation_dt", "account", "break_category"],
    constraints=["break_id IS UNIQUE"],
)

BREAK_PATTERN_SCHEMA = NodeSchema(
    label=NodeLabel.BREAK_PATTERN,
    properties={
        "pattern_id": "STRING",
        "pattern_name": "STRING",
        "description": "STRING",
        "break_category": "STRING",
        "occurrence_count": "INTEGER",
        "avg_confidence": "FLOAT",
        "is_systematic": "BOOLEAN",
        "matching_criteria": "STRING",
        "resolution_template": "STRING",
    },
    indexes=["pattern_id", "break_category", "is_systematic"],
    constraints=["pattern_id IS UNIQUE"],
)

ROOT_CAUSE_SCHEMA = NodeSchema(
    label=NodeLabel.ROOT_CAUSE,
    properties={
        "cause_id": "STRING",
        "cause_type": "STRING",
        "description": "STRING",
        "typical_resolution": "STRING",
    },
    indexes=["cause_id", "cause_type"],
)

RESOLUTION_SCHEMA = NodeSchema(
    label=NodeLabel.RESOLUTION,
    properties={
        "resolution_id": "STRING",
        "resolution_type": "STRING",
        "description": "STRING",
        "steps": "STRING",
        "automated": "BOOLEAN",
    },
    indexes=["resolution_id", "resolution_type"],
)

BREAK_CLUSTER_SCHEMA = NodeSchema(
    label=NodeLabel.BREAK_CLUSTER,
    properties={
        "cluster_id": "STRING",
        "cluster_name": "STRING",
        "description": "STRING",
        "member_count": "INTEGER",
        "is_systematic": "BOOLEAN",
    },
    indexes=["cluster_id"],
)


# =============================================================================
# Complete Schema Registry
# =============================================================================

GRAPH_SCHEMA_REGISTRY = {
    # Domain Entity Graph
    NodeLabel.FUND: FUND_SCHEMA,
    NodeLabel.SHARE_CLASS: SHARE_CLASS_SCHEMA,
    NodeLabel.NAV_COMPONENT: NAV_COMPONENT_SCHEMA,
    NodeLabel.GL_ACCOUNT: GL_ACCOUNT_SCHEMA,
    NodeLabel.SECURITY: SECURITY_SCHEMA,
    NodeLabel.TRANSACTION: TRANSACTION_SCHEMA,
    # Accounting Rule Graph
    NodeLabel.ACCRUAL_METHOD: ACCRUAL_METHOD_SCHEMA,
    NodeLabel.DAY_COUNT_CONVENTION: DAY_COUNT_CONVENTION_SCHEMA,
    NodeLabel.GL_MAPPING_RULE: GL_MAPPING_RULE_SCHEMA,
    NodeLabel.NAV_CALCULATION_RULE: NAV_CALCULATION_RULE_SCHEMA,
    # Break Pattern Graph
    NodeLabel.BREAK_INSTANCE: BREAK_INSTANCE_SCHEMA,
    NodeLabel.BREAK_PATTERN: BREAK_PATTERN_SCHEMA,
    NodeLabel.ROOT_CAUSE: ROOT_CAUSE_SCHEMA,
    NodeLabel.RESOLUTION: RESOLUTION_SCHEMA,
    NodeLabel.BREAK_CLUSTER: BREAK_CLUSTER_SCHEMA,
}
