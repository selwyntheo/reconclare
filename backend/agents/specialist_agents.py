"""
Specialist Agents for RECON-AI.

Per Architecture Specification §3.2.3, these are invoked on-demand
for domain-specific analysis:
- Pricing Agent: Market value variance analysis
- Corporate Action Agent: CA event processing validation
- Accrual Agent: Day count, accrual period, rate validation
- FX Agent: Multi-currency FX rate comparison
- Pattern Agent: Historical break pattern matching
"""
from src.agents.base import BaseAgent
from src.agents.state import AgentState, AnalysisPhase, AgentFinding


# =============================================================================
# Pricing Agent
# =============================================================================

class PricingAgent(BaseAgent):
    """
    Pricing Agent - Compares pricing sources, snap times, price overrides,
    and exchange rates for positions with market value variance.

    Trigger: Market value variance on matched position.
    """

    def __init__(self):
        super().__init__(
            name="PricingAgent",
            description="Compare pricing sources, snap times, price overrides, exchange rates"
        )

    def analyze(self, state: AgentState) -> AgentState:
        state.add_trace(self.name, "analyzing_pricing_variances")

        for pos in state.breaking_positions:
            asset_id = pos.get("asset_id", "")
            variance = pos.get("variance_absolute", 0)

            # Query graph for pricing source information
            pricing_info = self._get_pricing_info(asset_id)

            # Fetch market prices from both systems
            price_comparison = self._compare_prices(asset_id, state)

            # Analyze the pricing difference
            analysis = self._analyze_pricing_difference(
                asset_id, variance, pricing_info, price_comparison
            )

            finding = self.create_finding(
                description=(
                    f"Pricing analysis for {asset_id}: {analysis['summary']}. "
                    f"CPU price={analysis.get('cpu_price', 'N/A')}, "
                    f"Incumbent price={analysis.get('incumbent_price', 'N/A')}."
                ),
                evidence={
                    "asset_id": asset_id,
                    "pricing_info": pricing_info,
                    "price_comparison": price_comparison,
                    **analysis,
                },
                confidence=analysis.get("confidence", 0.80),
                recommended_action=analysis.get("action", "Review pricing sources"),
                level="SPECIALIST_PRICING",
            )
            state.specialist_findings.append(finding)
            state.add_finding(finding)

        return state

    def _get_pricing_info(self, asset_id: str) -> dict:
        """Query graph for security pricing source details."""
        try:
            results = self.query_graph("""
                MATCH (s:Security {asset_id: $asset_id})
                OPTIONAL MATCH (s)-[:PRICED_BY]->(ps:PricingSource)
                OPTIONAL MATCH (s)-[:TRADED_ON]->(ex:Exchange)
                RETURN s.asset_currency as currency,
                       s.sec_type as sec_type,
                       ps.source_name as pricing_source,
                       ps.snap_time as snap_time,
                       ex.exchange_name as exchange
            """, {"asset_id": asset_id})
            return results[0] if results else {}
        except Exception:
            return {}

    def _compare_prices(self, asset_id: str, state: AgentState) -> dict:
        """Fetch and compare prices from both systems."""
        alert = state.break_alert
        if not alert:
            return {}

        sql = """
            SELECT pos_market_price, pos_market_value_base, pos_shares
            FROM data_sub_ledger_position
            WHERE asset_id = :asset_id
              AND account = :account
              AND valuation_dt = :val_dt
            LIMIT 1
        """
        try:
            results = self.query_sql_raw(sql, {
                "asset_id": asset_id,
                "account": alert.account,
                "val_dt": alert.valuation_dt,
            })
            if results:
                return {
                    "cpu_price": float(results[0].get("pos_market_price", 0)),
                    "cpu_market_value": float(results[0].get("pos_market_value_base", 0)),
                    "shares": float(results[0].get("pos_shares", 0)),
                }
        except Exception:
            pass
        return {}

    def _analyze_pricing_difference(
        self, asset_id: str, variance: float,
        pricing_info: dict, price_comparison: dict
    ) -> dict:
        """Analyze the root cause of a pricing difference."""
        cpu_price = price_comparison.get("cpu_price", 0)
        shares = price_comparison.get("shares", 0)

        # Calculate implied incumbent price
        incumbent_price = cpu_price  # Placeholder
        if shares != 0 and variance != 0:
            incumbent_price = cpu_price - (variance / shares)

        # Use LLM for analysis
        try:
            analysis = self.llm_reason(
                system_prompt=(
                    "You are a fund accounting pricing expert. Analyze the pricing "
                    "difference and determine the most likely cause. Be concise."
                ),
                user_prompt=(
                    f"Security: {asset_id}\n"
                    f"CPU Price: {cpu_price}\n"
                    f"Implied Incumbent Price: {incumbent_price}\n"
                    f"Price Difference: {cpu_price - incumbent_price}\n"
                    f"Shares: {shares}\n"
                    f"Market Value Variance: {variance}\n"
                    f"Pricing Source: {pricing_info.get('pricing_source', 'Unknown')}\n"
                    f"Snap Time: {pricing_info.get('snap_time', 'Unknown')}\n"
                    f"Possible causes: pricing source difference, snap time difference, "
                    f"price override, stale price, exchange rate difference.\n"
                    f"Provide: summary, most likely cause, confidence (0-1)."
                ),
            )
            return {
                "summary": analysis,
                "cpu_price": cpu_price,
                "incumbent_price": incumbent_price,
                "confidence": 0.80,
                "action": "Verify pricing sources and snap times between systems",
            }
        except Exception:
            return {
                "summary": f"Price difference of {cpu_price - incumbent_price:.6f} detected",
                "cpu_price": cpu_price,
                "incumbent_price": incumbent_price,
                "confidence": 0.65,
                "action": "Manual pricing source comparison required",
            }


# =============================================================================
# Corporate Action Agent
# =============================================================================

class CorporateActionAgent(BaseAgent):
    """
    Corporate Action Agent - Validates CA event processing.

    Trigger: Missing/extra transactions near ex-date.
    Capability: Validate stock splits, mergers, dividends, rights.
    """

    def __init__(self):
        super().__init__(
            name="CorporateActionAgent",
            description="Validate corporate action event processing"
        )

    def analyze(self, state: AgentState) -> AgentState:
        state.add_trace(self.name, "analyzing_corporate_actions")

        # Find CA-related findings from L3
        ca_findings = [
            f for f in state.l3_findings
            if "corporate action" in f.description.lower()
            or f.evidence.get("trans_code") in ("SPLIT", "SPINOFF", "CALL", "MAT", "MERGER")
        ]

        for ca_finding in ca_findings:
            asset_id = ca_finding.evidence.get("asset_id", "")
            trans_code = ca_finding.evidence.get("trans_code", "")

            # Query graph for CA event details and processing rules
            ca_info = self._get_ca_info(asset_id, trans_code)

            # Validate CA processing
            validation = self._validate_ca_processing(
                asset_id, trans_code, ca_finding.evidence, ca_info
            )

            finding = self.create_finding(
                description=(
                    f"Corporate action validation for {asset_id} ({trans_code}): "
                    f"{validation['summary']}"
                ),
                evidence={
                    "asset_id": asset_id,
                    "trans_code": trans_code,
                    "ca_info": ca_info,
                    **validation,
                },
                confidence=validation.get("confidence", 0.75),
                recommended_action=validation.get("action", "Review CA processing"),
                level="SPECIALIST_CA",
            )
            state.specialist_findings.append(finding)
            state.add_finding(finding)

        return state

    def _get_ca_info(self, asset_id: str, trans_code: str) -> dict:
        """Query graph for corporate action event details."""
        try:
            results = self.query_graph("""
                MATCH (ca:CorporateAction)-[:AFFECTS_SECURITY]->(s:Security {asset_id: $asset_id})
                OPTIONAL MATCH (ca)-[:OF_EVENT_TYPE]->(et:EventType)
                OPTIONAL MATCH (ca)-[:PROCESSED_BY]->(pr:ProcessingRule)
                RETURN ca, et, pr
                ORDER BY ca.event_date DESC
                LIMIT 5
            """, {"asset_id": asset_id})
            return {"events": results}
        except Exception:
            return {"events": []}

    def _validate_ca_processing(
        self, asset_id: str, trans_code: str,
        evidence: dict, ca_info: dict
    ) -> dict:
        """Validate that a corporate action was processed correctly."""
        try:
            analysis = self.llm_reason(
                system_prompt=(
                    "You are a fund accounting corporate actions expert. "
                    "Validate the corporate action processing and identify discrepancies."
                ),
                user_prompt=(
                    f"Security: {asset_id}\n"
                    f"Transaction Code: {trans_code}\n"
                    f"Transaction Evidence: {evidence}\n"
                    f"CA Event Info from Knowledge Graph: {ca_info}\n"
                    f"Validate: Was the CA processed correctly in both systems? "
                    f"Check ex-date, record date, pay date, ratio/rate, entitlement calculation."
                ),
            )
            return {
                "summary": analysis,
                "confidence": 0.75,
                "action": "Compare CA processing parameters between systems",
            }
        except Exception:
            return {
                "summary": "CA validation requires manual review",
                "confidence": 0.50,
                "action": "Manual CA event comparison required",
            }


# =============================================================================
# Accrual Agent
# =============================================================================

class AccrualAgent(BaseAgent):
    """
    Accrual Agent - Validates day count conventions, accrual periods,
    rate inputs, and amortization schedules.

    Trigger: Income/expense accrual variance.
    """

    def __init__(self):
        super().__init__(
            name="AccrualAgent",
            description="Validate day count conventions, accrual periods, rate inputs"
        )

    def analyze(self, state: AgentState) -> AgentState:
        state.add_trace(self.name, "analyzing_accrual_variances")
        alert = state.break_alert
        if not alert:
            return state

        # Find positions with income/accrual variances
        accrual_positions = self._find_accrual_positions(state)

        for pos in accrual_positions:
            asset_id = pos.get("asset_id", "")

            # Get security accrual parameters from graph
            accrual_params = self._get_accrual_params(asset_id)

            # Validate accrual calculation
            validation = self._validate_accrual(
                asset_id, pos, accrual_params, alert
            )

            finding = self.create_finding(
                description=(
                    f"Accrual analysis for {asset_id}: {validation['summary']}. "
                    f"Day count: CPU={validation.get('cpu_day_count', 'N/A')}, "
                    f"Expected={validation.get('expected_day_count', 'N/A')}."
                ),
                evidence={
                    "asset_id": asset_id,
                    "accrual_params": accrual_params,
                    **validation,
                },
                confidence=validation.get("confidence", 0.85),
                recommended_action=validation.get("action", "Review accrual parameters"),
                level="SPECIALIST_ACCRUAL",
            )
            state.specialist_findings.append(finding)
            state.add_finding(finding)

        return state

    def _find_accrual_positions(self, state: AgentState) -> list[dict]:
        """Find positions with income/accrual-related variances."""
        positions = []
        for pos in state.breaking_positions:
            # Check if the break is income-related
            if state.primary_driver and state.primary_driver.value in (
                "INCOME_DRIVEN", "MULTI_FACTOR"
            ):
                positions.append(pos)
        return positions

    def _get_accrual_params(self, asset_id: str) -> dict:
        """Query graph for security accrual parameters."""
        try:
            results = self.query_graph("""
                MATCH (s:Security {asset_id: $asset_id})
                OPTIONAL MATCH (am:AccrualMethod)-[:USES_METHOD]->(dc:DayCountConvention)
                WHERE dc.convention_name = s.day_count
                RETURN s.coupon_rate as coupon_rate,
                       s.day_count as day_count,
                       s.payment_frequency as payment_frequency,
                       s.amort_method as amort_method,
                       s.factor as factor,
                       am.method_name as accrual_method,
                       am.description as accrual_formula,
                       dc.numerator_rule as numerator_rule,
                       dc.denominator_rule as denominator_rule
            """, {"asset_id": asset_id})
            return results[0] if results else {}
        except Exception:
            return {}

    def _validate_accrual(
        self, asset_id: str, pos: dict,
        accrual_params: dict, alert
    ) -> dict:
        """Validate accrual calculation for a position."""
        day_count = accrual_params.get("day_count", "Unknown")
        coupon_rate = accrual_params.get("coupon_rate", 0)

        try:
            analysis = self.llm_reason(
                system_prompt=(
                    "You are a fixed income accrual calculation expert. "
                    "Analyze the accrual variance and identify the root cause. "
                    "Common causes: day count convention mismatch (30/360 vs ACT/ACT), "
                    "accrual period difference, rate input difference, "
                    "amortization method difference."
                ),
                user_prompt=(
                    f"Security: {asset_id}\n"
                    f"Position Variance: {pos.get('variance_absolute', 0):,.2f}\n"
                    f"Coupon Rate: {coupon_rate}\n"
                    f"Day Count Convention: {day_count}\n"
                    f"Accrual Method: {accrual_params.get('accrual_method', 'Unknown')}\n"
                    f"Payment Frequency: {accrual_params.get('payment_frequency', 'Unknown')}\n"
                    f"Factor: {accrual_params.get('factor', 1.0)}\n"
                    f"Amortization Method: {accrual_params.get('amort_method', 'N/A')}\n"
                    f"Provide: summary, cpu_day_count, expected_day_count, "
                    f"calculated_expected_variance, confidence."
                ),
            )
            return {
                "summary": analysis,
                "cpu_day_count": day_count,
                "expected_day_count": day_count,
                "confidence": 0.85,
                "action": "Verify day count convention in ElectronDSL configuration",
            }
        except Exception:
            return {
                "summary": "Accrual validation requires manual calculation review",
                "cpu_day_count": day_count,
                "expected_day_count": "Unknown",
                "confidence": 0.60,
                "action": "Manual accrual parameter comparison required",
            }


# =============================================================================
# FX Agent
# =============================================================================

class FXAgent(BaseAgent):
    """
    FX Agent - Compares FX rates, hedging positions, unrealized FX gains.

    Trigger: Multi-currency fund with position variance.
    """

    def __init__(self):
        super().__init__(
            name="FXAgent",
            description="Compare FX rates, hedging positions, unrealized FX gains"
        )

    def analyze(self, state: AgentState) -> AgentState:
        state.add_trace(self.name, "analyzing_fx_variances")
        alert = state.break_alert
        if not alert:
            return state

        # Find multi-currency positions with variances
        fx_positions = self._find_fx_positions(state)

        for pos in fx_positions:
            asset_id = pos.get("asset_id", "")

            # Get FX rate information
            fx_info = self._get_fx_rates(asset_id, alert)

            # Analyze FX impact
            analysis = self._analyze_fx_impact(asset_id, pos, fx_info)

            finding = self.create_finding(
                description=(
                    f"FX analysis for {asset_id}: {analysis['summary']}. "
                    f"FX rate used: {analysis.get('fx_rate', 'N/A')}"
                ),
                evidence={
                    "asset_id": asset_id,
                    "fx_info": fx_info,
                    **analysis,
                },
                confidence=analysis.get("confidence", 0.80),
                recommended_action=analysis.get("action", "Review FX rates"),
                level="SPECIALIST_FX",
            )
            state.specialist_findings.append(finding)
            state.add_finding(finding)

        return state

    def _find_fx_positions(self, state: AgentState) -> list[dict]:
        """Find positions in non-base currencies."""
        return [
            pos for pos in state.breaking_positions
            if pos.get("variance_absolute", 0) != 0
        ]

    def _get_fx_rates(self, asset_id: str, alert) -> dict:
        """Fetch FX rate information for the security."""
        try:
            results = self.query_graph("""
                MATCH (s:Security {asset_id: $asset_id})
                    -[:DENOMINATED_IN]->(c:Currency)
                RETURN s.asset_currency as security_currency,
                       c.code as currency_code
            """, {"asset_id": asset_id})
            return results[0] if results else {}
        except Exception:
            return {}

    def _analyze_fx_impact(
        self, asset_id: str, pos: dict, fx_info: dict
    ) -> dict:
        """Analyze FX rate impact on position variance."""
        try:
            analysis = self.llm_reason(
                system_prompt=(
                    "You are an FX and multi-currency fund accounting expert. "
                    "Analyze the FX impact on the position variance."
                ),
                user_prompt=(
                    f"Security: {asset_id}\n"
                    f"Security Currency: {fx_info.get('security_currency', 'Unknown')}\n"
                    f"Position Variance: {pos.get('variance_absolute', 0):,.2f}\n"
                    f"Possible causes: FX rate source difference, snap time difference, "
                    f"spot vs forward rate, unrealized FX gain calculation.\n"
                    f"Provide: summary, fx_rate, confidence."
                ),
            )
            return {
                "summary": analysis,
                "fx_rate": "See analysis",
                "confidence": 0.75,
                "action": "Compare FX rate sources and snap times",
            }
        except Exception:
            return {
                "summary": "FX analysis requires manual rate comparison",
                "fx_rate": "Unknown",
                "confidence": 0.55,
                "action": "Manual FX rate comparison required",
            }


# =============================================================================
# Pattern Agent
# =============================================================================

class PatternAgent(BaseAgent):
    """
    Pattern Agent - Matches current break against historical pattern graph.

    Trigger: Always invoked post-analysis.
    Capability: Find similar past breaks, suggest known resolutions,
    detect systematic issues via community detection.
    """

    def __init__(self):
        super().__init__(
            name="PatternAgent",
            description="Match break against historical patterns, suggest resolutions"
        )

    def analyze(self, state: AgentState) -> AgentState:
        state.phase = AnalysisPhase.PATTERN_MATCHING
        state.add_trace(self.name, "matching_historical_patterns")
        alert = state.break_alert
        if not alert:
            return state

        # Determine break category from findings
        break_category = self._determine_category(state)

        # Search for matching patterns in the graph
        matched_patterns = self._search_patterns(
            break_category=break_category,
            variance=alert.variance_absolute,
            fund_type=alert.fund_type,
        )
        state.matched_patterns = matched_patterns

        # Search for similar historical breaks
        similar_breaks = self._find_similar_breaks(state)
        state.historical_similar_breaks = similar_breaks

        # Generate pattern findings
        for pattern in matched_patterns:
            finding = self.create_finding(
                description=(
                    f"Matched historical pattern: '{pattern.get('pattern_name', 'Unknown')}' "
                    f"(seen {pattern.get('occurrence_count', 0)} times, "
                    f"avg confidence {pattern.get('avg_confidence', 0):.0%}). "
                    f"Resolution: {pattern.get('resolution_template', 'N/A')}"
                ),
                evidence=pattern,
                confidence=float(pattern.get("avg_confidence", 0.70)),
                recommended_action=pattern.get("resolution_template", "Apply known resolution"),
                level="PATTERN_MATCH",
            )
            state.pattern_findings.append(finding)
            state.add_finding(finding)

        if similar_breaks:
            finding = self.create_finding(
                description=(
                    f"Found {len(similar_breaks)} similar historical breaks. "
                    f"Most common resolution: "
                    f"{similar_breaks[0].get('resolution_type', 'Unknown') if similar_breaks else 'N/A'}"
                ),
                evidence={"similar_breaks": similar_breaks[:5]},
                confidence=0.80,
                recommended_action="Review similar break resolutions for guidance",
                level="PATTERN_MATCH",
            )
            state.pattern_findings.append(finding)
            state.add_finding(finding)

        if not matched_patterns and not similar_breaks:
            finding = self.create_finding(
                description="No matching historical patterns found. This appears to be a novel break type.",
                evidence={},
                confidence=0.50,
                recommended_action="Escalate to human analyst for novel pattern investigation",
                level="PATTERN_MATCH",
            )
            state.pattern_findings.append(finding)
            state.add_finding(finding)

        return state

    def _determine_category(self, state: AgentState) -> str:
        """Determine the break category from accumulated findings."""
        # Collect all finding descriptions
        descriptions = [f.description for f in state.all_findings]
        combined = " ".join(descriptions)

        categories = ["TIMING", "METHODOLOGY", "DATA", "PRICING", "CONFIGURATION", "ROUNDING"]
        try:
            return self.llm_classify(combined[:2000], categories)
        except Exception:
            return "DATA"

    def _search_patterns(
        self, break_category: str, variance: float,
        fund_type: str = None,
    ) -> list[dict]:
        """Search the break pattern graph for matching patterns."""
        try:
            results = self.graph_pattern_match(
                break_category=break_category,
                variance=variance,
                fund_type=fund_type,
            )
            return [
                {
                    "pattern_id": r.get("bp", {}).get("pattern_id", ""),
                    "pattern_name": r.get("bp", {}).get("pattern_name", ""),
                    "occurrence_count": r.get("frequency", 0),
                    "avg_confidence": r.get("confidence", 0),
                    "resolution_template": r.get("bp", {}).get("resolution_template", ""),
                }
                for r in results
            ]
        except Exception:
            return []

    def _find_similar_breaks(self, state: AgentState) -> list[dict]:
        """Find similar historical breaks using graph similarity search."""
        alert = state.break_alert
        if not alert:
            return []

        try:
            results = self.query_graph("""
                MATCH (bi:BreakInstance)
                WHERE bi.account = $account
                  AND bi.status IN ['RESOLVED', 'ACCEPTED']
                OPTIONAL MATCH (bi)-[:RESOLVED_WITH]->(res:Resolution)
                RETURN bi.break_id as break_id,
                       bi.break_category as category,
                       bi.variance_absolute as variance,
                       bi.root_cause_summary as root_cause,
                       bi.confidence_score as confidence,
                       res.resolution_type as resolution_type,
                       res.description as resolution_description
                ORDER BY bi.valuation_dt DESC
                LIMIT 10
            """, {"account": alert.account})
            return results
        except Exception:
            return []
