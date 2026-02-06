"""
Tests for RECON-AI Graph Data Model (Neo4j schema definitions).
Validates graph schema covers all four layers per Architecture Spec §4.2.
"""
import pytest

from src.graph.schema import (
    NodeLabel, RelationshipType, GRAPH_SCHEMA_REGISTRY,
    FUND_SCHEMA, SHARE_CLASS_SCHEMA, GL_ACCOUNT_SCHEMA,
    SECURITY_SCHEMA, NAV_COMPONENT_SCHEMA, TRANSACTION_SCHEMA,
    ACCRUAL_METHOD_SCHEMA, DAY_COUNT_CONVENTION_SCHEMA,
    GL_MAPPING_RULE_SCHEMA, NAV_CALCULATION_RULE_SCHEMA,
    BREAK_INSTANCE_SCHEMA, BREAK_PATTERN_SCHEMA,
    ROOT_CAUSE_SCHEMA, RESOLUTION_SCHEMA, BREAK_CLUSTER_SCHEMA,
)


# =============================================================================
# Node Label Coverage Tests
# =============================================================================

class TestNodeLabels:
    """Verify all required node labels are defined."""

    def test_domain_entity_labels(self):
        """Domain Entity Graph (Static) - §4.2.1"""
        domain_labels = [
            NodeLabel.FUND, NodeLabel.SHARE_CLASS, NodeLabel.NAV_COMPONENT,
            NodeLabel.GL_ACCOUNT, NodeLabel.SUB_LEDGER_POSITION,
            NodeLabel.TRANSACTION, NodeLabel.SECURITY,
            NodeLabel.PRICING_SOURCE, NodeLabel.EXCHANGE, NodeLabel.CURRENCY,
            NodeLabel.COUNTERPARTY, NodeLabel.CORPORATE_ACTION,
            NodeLabel.EVENT_TYPE, NodeLabel.PROCESSING_RULE,
        ]
        for label in domain_labels:
            assert label.value, f"Domain label {label} has no value"

    def test_accounting_rule_labels(self):
        """Accounting Rule Graph (Semi-Static) - §4.2.2"""
        rule_labels = [
            NodeLabel.ACCRUAL_METHOD, NodeLabel.DAY_COUNT_CONVENTION,
            NodeLabel.CALCULATION_FORMULA, NodeLabel.GL_MAPPING_RULE,
            NodeLabel.TRANSACTION_TYPE, NodeLabel.AMORTIZATION_SCHEDULE,
            NodeLabel.SECURITY_TYPE, NodeLabel.NAV_CALCULATION_RULE,
        ]
        for label in rule_labels:
            assert label.value, f"Rule label {label} has no value"

    def test_transaction_lineage_labels(self):
        """Transaction Lineage Graph (Dynamic) - §4.2.3"""
        lineage_labels = [
            NodeLabel.NAV_PUBLICATION, NodeLabel.GL_SNAPSHOT,
            NodeLabel.NAV_CYCLE, NodeLabel.TRADE, NodeLabel.ALLOCATION,
            NodeLabel.SETTLEMENT, NodeLabel.CASH_MOVEMENT,
            NodeLabel.GL_POSTING, NodeLabel.CA_EVENT,
        ]
        for label in lineage_labels:
            assert label.value, f"Lineage label {label} has no value"

    def test_break_pattern_labels(self):
        """Break Pattern Graph (Accumulated) - §4.2.4"""
        pattern_labels = [
            NodeLabel.BREAK_INSTANCE, NodeLabel.BREAK_CATEGORY,
            NodeLabel.ROOT_CAUSE, NodeLabel.RESOLUTION,
            NodeLabel.PREVENTION_RULE, NodeLabel.BREAK_PATTERN,
            NodeLabel.BREAK_CLUSTER, NodeLabel.SYSTEMATIC_ISSUE,
        ]
        for label in pattern_labels:
            assert label.value, f"Pattern label {label} has no value"


# =============================================================================
# Relationship Type Coverage Tests
# =============================================================================

class TestRelationshipTypes:
    """Verify all required relationship types are defined."""

    def test_domain_entity_relationships(self):
        """Domain Entity Graph relationships."""
        rels = [
            RelationshipType.HAS_CLASS,
            RelationshipType.HAS_NAV_COMPONENT,
            RelationshipType.MAPS_TO_GL,
            RelationshipType.HAS_POSITION,
            RelationshipType.HAS_TRANSACTION,
            RelationshipType.INVOLVES_SECURITY,
            RelationshipType.PRICED_BY,
            RelationshipType.DENOMINATED_IN,
            RelationshipType.AFFECTS_SECURITY,
        ]
        for rel in rels:
            assert rel.value, f"Relationship {rel} has no value"

    def test_drill_down_chain(self):
        """Verify the causal drill-down chain exists: Fund→Class→NAV→GL→Pos→Tx."""
        chain = [
            RelationshipType.HAS_CLASS,          # Fund → ShareClass
            RelationshipType.HAS_NAV_COMPONENT,  # ShareClass → NAVComponent
            RelationshipType.MAPS_TO_GL,         # NAVComponent → GLAccount
            RelationshipType.HAS_POSITION,       # GLAccount → Position
            RelationshipType.HAS_TRANSACTION,    # Position → Transaction
        ]
        assert len(chain) == 5, "Drill-down chain must have 5 hops (L0→L3)"

    def test_break_pattern_relationships(self):
        """Break Pattern Graph relationships."""
        rels = [
            RelationshipType.CLASSIFIED_AS,
            RelationshipType.CAUSED_BY,
            RelationshipType.RESOLVED_WITH,
            RelationshipType.MATCHES_PATTERN,
            RelationshipType.SIMILAR_TO,
            RelationshipType.BELONGS_TO_CLUSTER,
        ]
        for rel in rels:
            assert rel.value

    def test_cross_system_mapping_relationships(self):
        """Cross-system mapping relationships."""
        assert RelationshipType.CPU_MAPS_TO.value == "CPU_MAPS_TO"
        assert RelationshipType.INCUMBENT_MAPS_TO.value == "INCUMBENT_MAPS_TO"

    def test_impact_analysis_relationships(self):
        """Impact analysis chain: Tx → Position → GL → NAV."""
        chain = [
            RelationshipType.IMPACTS_POSITION,
            RelationshipType.IMPACTS_GL,
            RelationshipType.IMPACTS_NAV,
        ]
        assert len(chain) == 3


# =============================================================================
# Schema Registry Tests
# =============================================================================

class TestSchemaRegistry:
    """Verify the schema registry is complete and well-formed."""

    def test_registry_has_key_schemas(self):
        assert NodeLabel.FUND in GRAPH_SCHEMA_REGISTRY
        assert NodeLabel.SECURITY in GRAPH_SCHEMA_REGISTRY
        assert NodeLabel.GL_ACCOUNT in GRAPH_SCHEMA_REGISTRY
        assert NodeLabel.TRANSACTION in GRAPH_SCHEMA_REGISTRY
        assert NodeLabel.BREAK_INSTANCE in GRAPH_SCHEMA_REGISTRY
        assert NodeLabel.BREAK_PATTERN in GRAPH_SCHEMA_REGISTRY

    def test_fund_schema_properties(self):
        assert "account" in FUND_SCHEMA.properties
        assert "account_name" in FUND_SCHEMA.properties
        assert "base_currency" in FUND_SCHEMA.properties
        assert "account" in FUND_SCHEMA.indexes
        assert len(FUND_SCHEMA.constraints) > 0

    def test_security_schema_properties(self):
        assert "asset_id" in SECURITY_SCHEMA.properties
        assert "cusip" in SECURITY_SCHEMA.properties
        assert "isin" in SECURITY_SCHEMA.properties
        assert "sec_type" in SECURITY_SCHEMA.properties
        assert "coupon_rate" in SECURITY_SCHEMA.properties
        assert "day_count" in SECURITY_SCHEMA.properties

    def test_break_instance_schema(self):
        assert "break_id" in BREAK_INSTANCE_SCHEMA.properties
        assert "break_category" in BREAK_INSTANCE_SCHEMA.properties
        assert "variance_absolute" in BREAK_INSTANCE_SCHEMA.properties
        assert "confidence_score" in BREAK_INSTANCE_SCHEMA.properties

    def test_break_pattern_schema(self):
        assert "pattern_id" in BREAK_PATTERN_SCHEMA.properties
        assert "occurrence_count" in BREAK_PATTERN_SCHEMA.properties
        assert "is_systematic" in BREAK_PATTERN_SCHEMA.properties
        assert "matching_criteria" in BREAK_PATTERN_SCHEMA.properties


# =============================================================================
# Graph Query Pattern Tests (§4.3)
# =============================================================================

class TestQueryPatterns:
    """Verify the five query patterns from Architecture Spec §4.3 are supported."""

    def test_causal_drill_down_pattern(self):
        """NAV → GL → SubLedger → Transaction (filtered by variance)."""
        # Verify the relationship chain exists
        assert RelationshipType.HAS_NAV_COMPONENT.value
        assert RelationshipType.MAPS_TO_GL.value
        assert RelationshipType.HAS_POSITION.value
        assert RelationshipType.HAS_TRANSACTION.value

    def test_pattern_match_pattern(self):
        """CurrentBreak → [similarity] → HistoricalBreak → Resolution."""
        assert RelationshipType.SIMILAR_TO.value
        assert RelationshipType.MATCHES_PATTERN.value
        assert RelationshipType.RESOLVED_WITH.value

    def test_rule_validation_pattern(self):
        """Transaction → AccountingRule → ExpectedGLPosting vs ActualGLPosting."""
        assert RelationshipType.FOR_TRANSACTION_TYPE.value
        assert RelationshipType.MAPS_DEBIT.value
        assert RelationshipType.MAPS_CREDIT.value
        assert RelationshipType.POSTED_TO.value

    def test_cross_system_map_pattern(self):
        """CPU_GLAccount → [mapping] → Incumbent_GLAccount."""
        assert RelationshipType.CPU_MAPS_TO.value

    def test_impact_analysis_pattern(self):
        """Transaction → [affects] → Position → GLAccount → NAVComponent."""
        assert RelationshipType.IMPACTS_POSITION.value
        assert RelationshipType.IMPACTS_GL.value
        assert RelationshipType.IMPACTS_NAV.value
