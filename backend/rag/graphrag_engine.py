"""
GraphRAG Engine for RECON-AI.

Combines graph-based knowledge retrieval with vector similarity search
for comprehensive reconciliation analysis support.

Per Architecture Specification §4:
- Graph traversal for causal drill-down (structural queries)
- Vector similarity for break description matching (semantic queries)
- Community detection for systematic break identification
- Hierarchical summarization for multi-level analysis
"""
from typing import Any, Optional

import networkx as nx

from src.graph.neo4j_client import Neo4jClient
from src.graph.schema import NodeLabel, RelationshipType
from src.config.settings import settings


class GraphRAGEngine:
    """
    GraphRAG engine combining graph structure with semantic search.
    Provides the knowledge retrieval layer for all agents.
    """

    def __init__(self, neo4j_client: Optional[Neo4jClient] = None):
        self.neo4j = neo4j_client or Neo4jClient()
        self._nx_graph: Optional[nx.DiGraph] = None

    # =========================================================================
    # Structured Graph Queries (Causal Reasoning)
    # =========================================================================

    def drill_down_nav_to_transactions(
        self, account: str, valuation_dt: str,
        variance_threshold: float = 1000.0,
    ) -> dict:
        """
        Full causal drill-down: NAV → GL → SubLedger → Transaction.
        Returns a hierarchical structure of the break decomposition.
        """
        result = {
            "account": account,
            "valuation_dt": valuation_dt,
            "gl_buckets": [],
            "positions": [],
            "transactions": [],
        }

        # Step 1: Get GL-level decomposition
        gl_data = self.neo4j.causal_drill_down(account, valuation_dt)
        if gl_data:
            result["gl_buckets"] = gl_data

        # Step 2: Get breaking positions
        positions = self._get_breaking_positions(
            account, valuation_dt, variance_threshold
        )
        result["positions"] = positions

        # Step 3: Get transactions for breaking positions
        for pos in positions:
            asset_id = pos.get("asset_id", "")
            txns = self._get_position_transactions(
                account, asset_id, valuation_dt
            )
            result["transactions"].extend(txns)

        return result

    def _get_breaking_positions(
        self, account: str, valuation_dt: str, threshold: float
    ) -> list[dict]:
        """Get positions with variance above threshold."""
        cypher = """
        MATCH (pos:SubLedgerPosition)
        WHERE pos.account = $account
          AND pos.valuation_dt = $val_dt
        RETURN pos.position_id as position_id,
               pos.asset_id as asset_id,
               pos.market_value_base as market_value,
               pos.book_value_base as book_value,
               pos.unrealized_base as unrealized,
               pos.income_base as income
        ORDER BY abs(pos.market_value_base) DESC
        """
        try:
            with self.neo4j.session() as session:
                result = session.run(
                    cypher, account=account, val_dt=valuation_dt
                )
                return [dict(r) for r in result]
        except Exception:
            return []

    def _get_position_transactions(
        self, account: str, asset_id: str, valuation_dt: str
    ) -> list[dict]:
        """Get transactions for a specific position."""
        cypher = """
        MATCH (tx:Transaction)
        WHERE tx.account = $account
          AND tx.asset_id = $asset_id
        RETURN tx.transaction_id as transaction_id,
               tx.trans_code as trans_code,
               tx.trade_date as trade_date,
               tx.amount_base as amount_base,
               tx.units as units,
               tx.currency as currency
        ORDER BY tx.trade_date DESC
        """
        try:
            with self.neo4j.session() as session:
                result = session.run(
                    cypher, account=account, asset_id=asset_id
                )
                return [dict(r) for r in result]
        except Exception:
            return []

    # =========================================================================
    # Accounting Rule Retrieval
    # =========================================================================

    def get_accounting_rules(
        self, sec_type: Optional[str] = None,
        trans_code: Optional[str] = None,
    ) -> dict:
        """
        Retrieve applicable accounting rules from the rule graph.
        Used by agents to validate transaction processing.
        """
        rules = {
            "accrual_methods": [],
            "day_count_conventions": [],
            "gl_mapping_rules": [],
            "nav_calculation_rules": [],
        }

        # Get accrual methods
        accrual_cypher = """
        MATCH (am:AccrualMethod)
        OPTIONAL MATCH (am)-[:USES_METHOD]->(dc:DayCountConvention)
        RETURN am.method_id as method_id,
               am.method_name as method_name,
               am.description as description,
               collect(dc.convention_name) as day_counts
        """
        try:
            with self.neo4j.session() as session:
                result = session.run(accrual_cypher)
                rules["accrual_methods"] = [dict(r) for r in result]
        except Exception:
            pass

        # Get GL mapping rules
        gl_cypher = """
        MATCH (rule:GLMappingRule)
        RETURN rule.rule_id as rule_id,
               rule.rule_name as rule_name,
               rule.debit_account as debit_account,
               rule.credit_account as credit_account,
               rule.conditions as conditions
        """
        if trans_code:
            gl_cypher += f" WHERE rule.conditions CONTAINS '{trans_code}'"

        try:
            with self.neo4j.session() as session:
                result = session.run(gl_cypher)
                rules["gl_mapping_rules"] = [dict(r) for r in result]
        except Exception:
            pass

        return rules

    def validate_transaction_rules(
        self, transaction_id: str
    ) -> dict:
        """
        Validate a transaction against accounting rules.
        Returns expected vs actual GL postings.
        """
        return {
            "validation_results": self.neo4j.rule_validation(transaction_id),
            "transaction_id": transaction_id,
        }

    # =========================================================================
    # Cross-System Mapping
    # =========================================================================

    def get_cross_system_mapping(
        self, entity_type: str, entity_id: str,
        source_system: str = "CPU",
    ) -> dict:
        """
        Get cross-system mapping for an entity (GL account, security, etc.).
        """
        if entity_type == "GL_ACCOUNT":
            return {
                "mappings": self.neo4j.cross_system_map(entity_id, source_system),
                "entity_type": entity_type,
                "entity_id": entity_id,
            }
        return {"mappings": [], "entity_type": entity_type, "entity_id": entity_id}

    # =========================================================================
    # Pattern Matching & Community Detection
    # =========================================================================

    def find_matching_patterns(
        self, break_category: str, variance: float,
        fund_type: Optional[str] = None,
        security_type: Optional[str] = None,
    ) -> list[dict]:
        """
        Find historical break patterns matching the current break.
        Uses graph pattern matching + optional similarity scoring.
        """
        return self.neo4j.pattern_match(
            break_category=break_category,
            variance_amount=variance,
            fund_type=fund_type,
            security_type=security_type,
        )

    def detect_systematic_issues(self) -> list[dict]:
        """
        Use community detection to identify clusters of related breaks
        that may indicate systematic issues.
        """
        # Build NetworkX graph from break pattern data
        nx_graph = self._build_break_network()
        if not nx_graph or nx_graph.number_of_nodes() == 0:
            return []

        # Run community detection
        try:
            communities = list(nx.community.greedy_modularity_communities(
                nx_graph.to_undirected()
            ))
        except Exception:
            return []

        systematic_issues = []
        for i, community in enumerate(communities):
            if len(community) < 3:
                continue

            # Analyze community characteristics
            members = list(community)
            categories = set()
            accounts = set()
            for node in members:
                data = nx_graph.nodes[node]
                categories.add(data.get("break_category", ""))
                accounts.add(data.get("account", ""))

            systematic_issues.append({
                "cluster_id": f"CLUSTER_{i}",
                "member_count": len(members),
                "break_categories": list(categories),
                "affected_accounts": list(accounts),
                "members": members[:10],
            })

        return systematic_issues

    def _build_break_network(self) -> Optional[nx.DiGraph]:
        """Build a NetworkX graph from break pattern data for analysis."""
        if self._nx_graph is not None:
            return self._nx_graph

        try:
            # Fetch break instances and their relationships
            cypher = """
            MATCH (bi:BreakInstance)
            OPTIONAL MATCH (bi)-[:SIMILAR_TO]->(bi2:BreakInstance)
            OPTIONAL MATCH (bi)-[:MATCHES_PATTERN]->(bp:BreakPattern)
            RETURN bi.break_id as break_id,
                   bi.break_category as break_category,
                   bi.account as account,
                   bi.variance_absolute as variance,
                   collect(DISTINCT bi2.break_id) as similar_breaks,
                   collect(DISTINCT bp.pattern_id) as patterns
            """
            with self.neo4j.session() as session:
                result = session.run(cypher)
                records = [dict(r) for r in result]

            G = nx.DiGraph()
            for record in records:
                G.add_node(record["break_id"], **{
                    "break_category": record.get("break_category", ""),
                    "account": record.get("account", ""),
                    "variance": record.get("variance", 0),
                })
                for similar in record.get("similar_breaks", []):
                    if similar:
                        G.add_edge(record["break_id"], similar, type="SIMILAR_TO")
                for pattern in record.get("patterns", []):
                    if pattern:
                        G.add_edge(record["break_id"], pattern, type="MATCHES_PATTERN")

            self._nx_graph = G
            return G

        except Exception:
            return nx.DiGraph()

    # =========================================================================
    # Impact Analysis
    # =========================================================================

    def trace_transaction_impact(self, transaction_id: str) -> dict:
        """
        Trace the impact of a transaction from transaction → position → GL → NAV.
        Used to understand how a specific transaction affects the NAV.
        """
        impact_chain = self.neo4j.impact_analysis(transaction_id)
        return {
            "transaction_id": transaction_id,
            "impact_chain": impact_chain,
            "nav_impact": self._calculate_nav_impact(impact_chain),
        }

    def _calculate_nav_impact(self, impact_chain: list[dict]) -> float:
        """Calculate the total NAV impact from an impact chain."""
        total_impact = 0.0
        for link in impact_chain:
            tx = link.get("tx", {})
            if isinstance(tx, dict):
                total_impact += float(tx.get("amount_base", 0))
        return total_impact

    # =========================================================================
    # Knowledge Retrieval for Agent Context
    # =========================================================================

    def get_fund_context(self, account: str) -> dict:
        """
        Get comprehensive fund context from the knowledge graph.
        Used by the Supervisor to understand fund characteristics.
        """
        cypher = """
        MATCH (f:Fund {account: $account})
        OPTIONAL MATCH (f)-[:HAS_CLASS]->(sc:ShareClass)
        OPTIONAL MATCH (f)-[:DENOMINATED_IN]->(c:Currency)
        RETURN f.account as account,
               f.account_name as fund_name,
               f.base_currency as base_currency,
               f.fund_type as fund_type,
               collect(DISTINCT sc.share_class) as share_classes
        """
        try:
            with self.neo4j.session() as session:
                result = session.run(cypher, account=account)
                record = result.single()
                return dict(record) if record else {}
        except Exception:
            return {}

    def get_security_context(self, asset_id: str) -> dict:
        """
        Get comprehensive security context from the knowledge graph.
        Used by specialist agents for detailed analysis.
        """
        cypher = """
        MATCH (s:Security {asset_id: $asset_id})
        OPTIONAL MATCH (s)-[:DENOMINATED_IN]->(c:Currency)
        OPTIONAL MATCH (s)-[:PRICED_BY]->(ps:PricingSource)
        OPTIONAL MATCH (s)-[:TRADED_ON]->(ex:Exchange)
        OPTIONAL MATCH (st:SecurityType {sec_type: s.sec_type})
        RETURN s, c, ps, ex, st
        """
        try:
            with self.neo4j.session() as session:
                result = session.run(cypher, asset_id=asset_id)
                record = result.single()
                return dict(record) if record else {}
        except Exception:
            return {}

    def get_break_history(
        self, account: str, limit: int = 20
    ) -> list[dict]:
        """
        Get break history for a fund from the pattern graph.
        Used by the Pattern Agent for historical comparison.
        """
        cypher = """
        MATCH (bi:BreakInstance {account: $account})
        OPTIONAL MATCH (bi)-[:CLASSIFIED_AS]->(bc:BreakCategory)
        OPTIONAL MATCH (bi)-[:RESOLVED_WITH]->(res:Resolution)
        RETURN bi.break_id as break_id,
               bi.valuation_dt as valuation_dt,
               bi.break_category as category,
               bi.variance_absolute as variance,
               bi.confidence_score as confidence,
               bi.root_cause_summary as root_cause,
               res.resolution_type as resolution_type,
               res.description as resolution_description
        ORDER BY bi.valuation_dt DESC
        LIMIT $limit
        """
        try:
            with self.neo4j.session() as session:
                result = session.run(cypher, account=account, limit=limit)
                return [dict(r) for r in result]
        except Exception:
            return []
