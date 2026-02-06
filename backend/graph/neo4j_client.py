"""
Neo4j client for RECON-AI GraphRAG knowledge graph.
Handles connection management, schema initialization, and CRUD operations.
"""
from typing import Any, Optional

from neo4j import GraphDatabase, Driver, Session

from src.config.settings import settings
from src.graph.schema import (
    GRAPH_SCHEMA_REGISTRY, NodeLabel, RelationshipType, NodeSchema
)


class Neo4jClient:
    """Neo4j database client with connection pooling and schema management."""

    def __init__(
        self,
        uri: Optional[str] = None,
        user: Optional[str] = None,
        password: Optional[str] = None,
        database: Optional[str] = None,
    ):
        self._uri = uri or settings.NEO4J_URI
        self._user = user or settings.NEO4J_USER
        self._password = password or settings.NEO4J_PASSWORD
        self._database = database or settings.NEO4J_DATABASE
        self._driver: Optional[Driver] = None

    @property
    def driver(self) -> Driver:
        if self._driver is None:
            self._driver = GraphDatabase.driver(
                self._uri, auth=(self._user, self._password)
            )
        return self._driver

    def close(self):
        if self._driver:
            self._driver.close()
            self._driver = None

    def session(self) -> Session:
        return self.driver.session(database=self._database)

    # =========================================================================
    # Schema Initialization
    # =========================================================================

    def initialize_schema(self):
        """Create all constraints and indexes defined in the graph schema."""
        with self.session() as session:
            for label, schema in GRAPH_SCHEMA_REGISTRY.items():
                self._create_constraints(session, schema)
                self._create_indexes(session, schema)

    def _create_constraints(self, session: Session, schema: NodeSchema):
        for constraint in schema.constraints:
            prop = constraint.split(" ")[0]
            cypher = (
                f"CREATE CONSTRAINT IF NOT EXISTS "
                f"FOR (n:{schema.label.value}) "
                f"REQUIRE n.{prop} IS UNIQUE"
            )
            session.run(cypher)

    def _create_indexes(self, session: Session, schema: NodeSchema):
        for prop in schema.indexes:
            cypher = (
                f"CREATE INDEX IF NOT EXISTS "
                f"FOR (n:{schema.label.value}) ON (n.{prop})"
            )
            session.run(cypher)

    # =========================================================================
    # Node CRUD Operations
    # =========================================================================

    def create_node(
        self, label: NodeLabel, properties: dict[str, Any]
    ) -> dict:
        """Create or merge a node with the given label and properties."""
        props_str = ", ".join(f"{k}: ${k}" for k in properties)
        cypher = f"MERGE (n:{label.value} {{{props_str}}}) RETURN n"
        with self.session() as session:
            result = session.run(cypher, **properties)
            record = result.single()
            return dict(record["n"]) if record else {}

    def get_node(
        self, label: NodeLabel, key_prop: str, key_value: Any
    ) -> Optional[dict]:
        """Retrieve a node by its key property."""
        cypher = (
            f"MATCH (n:{label.value} {{{key_prop}: $val}}) "
            f"RETURN n"
        )
        with self.session() as session:
            result = session.run(cypher, val=key_value)
            record = result.single()
            return dict(record["n"]) if record else None

    def update_node(
        self, label: NodeLabel, key_prop: str, key_value: Any,
        updates: dict[str, Any]
    ) -> Optional[dict]:
        """Update properties on an existing node."""
        set_str = ", ".join(f"n.{k} = ${k}" for k in updates)
        cypher = (
            f"MATCH (n:{label.value} {{{key_prop}: $key_val}}) "
            f"SET {set_str} RETURN n"
        )
        with self.session() as session:
            result = session.run(cypher, key_val=key_value, **updates)
            record = result.single()
            return dict(record["n"]) if record else None

    # =========================================================================
    # Relationship CRUD Operations
    # =========================================================================

    def create_relationship(
        self,
        from_label: NodeLabel, from_key: str, from_value: Any,
        to_label: NodeLabel, to_key: str, to_value: Any,
        rel_type: RelationshipType,
        properties: Optional[dict[str, Any]] = None,
    ) -> bool:
        """Create a relationship between two nodes."""
        props_str = ""
        params = {"from_val": from_value, "to_val": to_value}
        if properties:
            props_str = " {" + ", ".join(
                f"{k}: ${k}" for k in properties
            ) + "}"
            params.update(properties)

        cypher = (
            f"MATCH (a:{from_label.value} {{{from_key}: $from_val}}) "
            f"MATCH (b:{to_label.value} {{{to_key}: $to_val}}) "
            f"MERGE (a)-[r:{rel_type.value}{props_str}]->(b) "
            f"RETURN r"
        )
        with self.session() as session:
            result = session.run(cypher, **params)
            return result.single() is not None

    # =========================================================================
    # Graph Traversal Queries (Architecture §4.3)
    # =========================================================================

    def causal_drill_down(
        self, account: str, valuation_dt: str
    ) -> list[dict]:
        """
        Causal Drill-Down: NAV → GL → SubLedger → Transaction
        Primary analysis path from break to root cause.
        """
        cypher = """
        MATCH path = (f:Fund {account: $account})
            -[:HAS_CLASS]->(sc:ShareClass)
            -[:HAS_NAV_COMPONENT]->(nc:NAVComponent)
            -[:MAPS_TO_GL]->(gl:GLAccount)
            -[:HAS_POSITION]->(pos:SubLedgerPosition)
            -[:HAS_TRANSACTION]->(tx:Transaction)
        WHERE tx.trade_date >= date($valuation_dt)
        RETURN f, sc, nc, gl, pos, tx,
               length(path) as depth
        ORDER BY abs(tx.amount_base) DESC
        """
        with self.session() as session:
            result = session.run(
                cypher, account=account, valuation_dt=valuation_dt
            )
            return [dict(record) for record in result]

    def pattern_match(
        self, break_category: str, variance_amount: float,
        fund_type: Optional[str] = None,
        security_type: Optional[str] = None,
    ) -> list[dict]:
        """
        Pattern Match: CurrentBreak → [similarity] → HistoricalBreak → Resolution
        Find similar past breaks and their resolutions.
        """
        filters = ["bp.break_category = $category"]
        params: dict[str, Any] = {
            "category": break_category,
            "variance": variance_amount,
        }

        if fund_type:
            filters.append(
                "(bp.fund_type_filter IS NULL OR bp.fund_type_filter = $fund_type)"
            )
            params["fund_type"] = fund_type
        if security_type:
            filters.append(
                "(bp.security_type_filter IS NULL OR bp.security_type_filter = $sec_type)"
            )
            params["sec_type"] = security_type

        where_clause = " AND ".join(filters)

        cypher = f"""
        MATCH (bp:BreakPattern)
        WHERE {where_clause}
        OPTIONAL MATCH (bp)<-[:MATCHES_PATTERN]-(bi:BreakInstance)
            -[:RESOLVED_WITH]->(res:Resolution)
        RETURN bp, collect(DISTINCT bi) as instances,
               collect(DISTINCT res) as resolutions,
               bp.occurrence_count as frequency,
               bp.avg_confidence as confidence
        ORDER BY bp.occurrence_count DESC
        LIMIT 10
        """
        with self.session() as session:
            result = session.run(cypher, **params)
            return [dict(record) for record in result]

    def rule_validation(
        self, transaction_id: str
    ) -> list[dict]:
        """
        Rule Validation: Transaction → AccountingRule → ExpectedGLPosting vs ActualGLPosting
        Verify transaction was processed per accounting rules.
        """
        cypher = """
        MATCH (tx:Transaction {transaction_id: $tx_id})
        OPTIONAL MATCH (tx)-[:OF_EVENT_TYPE]->(et:EventType)
            <-[:FOR_TRANSACTION_TYPE]-(rule:GLMappingRule)
        OPTIONAL MATCH (rule)-[:MAPS_DEBIT]->(debit:GLAccount)
        OPTIONAL MATCH (rule)-[:MAPS_CREDIT]->(credit:GLAccount)
        OPTIONAL MATCH (tx)-[:POSTED_TO]->(actual:GLPosting)
        RETURN tx, rule, debit, credit, actual
        """
        with self.session() as session:
            result = session.run(cypher, tx_id=transaction_id)
            return [dict(record) for record in result]

    def cross_system_map(
        self, gl_account: str, source_system: str = "CPU"
    ) -> list[dict]:
        """
        Cross-System Map: CPU_GLAccount → [mapping] → Incumbent_GLAccount
        Reconcile different chart-of-accounts structures.
        """
        rel = (
            RelationshipType.CPU_MAPS_TO.value
            if source_system == "CPU"
            else RelationshipType.INCUMBENT_MAPS_TO.value
        )
        cypher = f"""
        MATCH (src:GLAccount {{gl_account_number: $gl_acct, system: $system}})
            -[:{rel}]->(tgt:GLAccount)
        RETURN src, tgt
        """
        with self.session() as session:
            result = session.run(
                cypher, gl_acct=gl_account, system=source_system
            )
            return [dict(record) for record in result]

    def impact_analysis(
        self, transaction_id: str
    ) -> list[dict]:
        """
        Impact Analysis: Transaction → [affects] → Position → GLAccount → NAVComponent
        Trace forward from transaction to NAV impact.
        """
        cypher = """
        MATCH path = (tx:Transaction {transaction_id: $tx_id})
            -[:IMPACTS_POSITION]->(pos:SubLedgerPosition)
            -[:IMPACTS_GL]->(gl:GLAccount)
            -[:IMPACTS_NAV]->(nc:NAVComponent)
        RETURN tx, pos, gl, nc, length(path) as depth
        """
        with self.session() as session:
            result = session.run(cypher, tx_id=transaction_id)
            return [dict(record) for record in result]

    # =========================================================================
    # Graph Population Helpers
    # =========================================================================

    def bulk_create_nodes(
        self, label: NodeLabel, nodes: list[dict[str, Any]]
    ) -> int:
        """Bulk create/merge nodes using UNWIND for performance."""
        if not nodes:
            return 0

        props_str = ", ".join(f"{k}: item.{k}" for k in nodes[0].keys())
        cypher = (
            f"UNWIND $items AS item "
            f"MERGE (n:{label.value} {{{props_str}}}) "
            f"RETURN count(n) as cnt"
        )
        with self.session() as session:
            result = session.run(cypher, items=nodes)
            record = result.single()
            return record["cnt"] if record else 0

    def bulk_create_relationships(
        self,
        from_label: NodeLabel, from_key: str,
        to_label: NodeLabel, to_key: str,
        rel_type: RelationshipType,
        pairs: list[dict[str, Any]],
    ) -> int:
        """
        Bulk create relationships.
        Each pair dict must have 'from_value' and 'to_value' keys.
        """
        if not pairs:
            return 0

        cypher = (
            f"UNWIND $pairs AS pair "
            f"MATCH (a:{from_label.value} {{{from_key}: pair.from_value}}) "
            f"MATCH (b:{to_label.value} {{{to_key}: pair.to_value}}) "
            f"MERGE (a)-[r:{rel_type.value}]->(b) "
            f"RETURN count(r) as cnt"
        )
        with self.session() as session:
            result = session.run(cypher, pairs=pairs)
            record = result.single()
            return record["cnt"] if record else 0

    def clear_database(self):
        """Delete all nodes and relationships. USE WITH CAUTION."""
        with self.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
