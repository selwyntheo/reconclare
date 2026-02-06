"""
LangGraph Workflow Orchestration for RECON-AI.

Implements the full state machine:
break_alert → supervisor_init → L0_NAV → L1_GL → L2_SubLedger → L3_Transaction
→ specialist_routing → pattern_match → supervisor_finalize → report

Per Architecture Specification §3.2 and §7.1.
"""
from typing import Any, Literal

from langgraph.graph import StateGraph, END

from src.agents.state import AgentState, AnalysisPhase, BreakAlert
from src.agents.supervisor import SupervisorAgent
from src.agents.level_agents import (
    L0NAVAgent, L1GLAgent, L2SubLedgerAgent, L3TransactionAgent,
)
from src.agents.specialist_agents import (
    PricingAgent, CorporateActionAgent, AccrualAgent, FXAgent, PatternAgent,
)


# =============================================================================
# Agent Instances
# =============================================================================

supervisor = SupervisorAgent()
l0_nav_agent = L0NAVAgent()
l1_gl_agent = L1GLAgent()
l2_subledger_agent = L2SubLedgerAgent()
l3_transaction_agent = L3TransactionAgent()
pricing_agent = PricingAgent()
ca_agent = CorporateActionAgent()
accrual_agent = AccrualAgent()
fx_agent = FXAgent()
pattern_agent = PatternAgent()


# =============================================================================
# Node Functions (wrap agents for LangGraph)
# =============================================================================

def supervisor_init_node(state: dict) -> dict:
    """Supervisor initializes the analysis."""
    agent_state = _dict_to_state(state)
    agent_state.phase = AnalysisPhase.INITIATED
    result = supervisor(agent_state)
    return _state_to_dict(result)


def l0_nav_node(state: dict) -> dict:
    """L0 NAV Agent performs initial comparison and triage."""
    agent_state = _dict_to_state(state)
    result = l0_nav_agent(agent_state)
    return _state_to_dict(result)


def l1_gl_node(state: dict) -> dict:
    """L1 GL Agent decomposes NAV break into GL variances."""
    agent_state = _dict_to_state(state)
    result = l1_gl_agent(agent_state)
    return _state_to_dict(result)


def l2_subledger_node(state: dict) -> dict:
    """L2 Sub-Ledger Agent drills into position-level detail."""
    agent_state = _dict_to_state(state)
    result = l2_subledger_agent(agent_state)
    return _state_to_dict(result)


def l3_transaction_node(state: dict) -> dict:
    """L3 Transaction Agent performs transaction forensics."""
    agent_state = _dict_to_state(state)
    result = l3_transaction_agent(agent_state)
    return _state_to_dict(result)


def specialist_router_node(state: dict) -> dict:
    """Routes to appropriate specialist agents based on findings."""
    agent_state = _dict_to_state(state)
    agent_state.phase = AnalysisPhase.SPECIALIST_ANALYSIS

    for specialist_name in agent_state.specialists_invoked:
        if specialist_name == "PricingAgent":
            agent_state = pricing_agent(agent_state)
        elif specialist_name == "CorporateActionAgent":
            agent_state = ca_agent(agent_state)
        elif specialist_name == "AccrualAgent":
            agent_state = accrual_agent(agent_state)
        elif specialist_name == "FXAgent":
            agent_state = fx_agent(agent_state)

    return _state_to_dict(agent_state)


def pattern_match_node(state: dict) -> dict:
    """Pattern Agent matches against historical break patterns."""
    agent_state = _dict_to_state(state)
    result = pattern_agent(agent_state)
    return _state_to_dict(result)


def supervisor_finalize_node(state: dict) -> dict:
    """Supervisor aggregates findings and produces final report."""
    agent_state = _dict_to_state(state)
    agent_state.phase = AnalysisPhase.REPORT_GENERATION
    result = supervisor(agent_state)
    return _state_to_dict(result)


# =============================================================================
# Conditional Routing Functions
# =============================================================================

def should_continue_to_l1(state: dict) -> Literal["l1_gl", "supervisor_finalize"]:
    """Decide whether to continue to L1 GL analysis."""
    agent_state = _dict_to_state(state)
    if not agent_state.nav_variance or not agent_state.nav_variance.is_material:
        return "supervisor_finalize"
    return "l1_gl"


def should_continue_to_l2(state: dict) -> Literal["l2_subledger", "pattern_match"]:
    """Decide whether to continue to L2 Sub-Ledger analysis."""
    agent_state = _dict_to_state(state)
    if not agent_state.breaking_gl_buckets:
        return "pattern_match"
    return "l2_subledger"


def should_continue_to_l3(state: dict) -> Literal["l3_transaction", "specialist_router", "pattern_match"]:
    """Decide whether to continue to L3 Transaction analysis."""
    agent_state = _dict_to_state(state)
    if not agent_state.breaking_positions:
        if agent_state.specialists_invoked:
            return "specialist_router"
        return "pattern_match"
    return "l3_transaction"


def should_invoke_specialists(state: dict) -> Literal["specialist_router", "pattern_match"]:
    """Decide whether specialist agents are needed."""
    agent_state = _dict_to_state(state)
    if agent_state.specialists_invoked:
        return "specialist_router"
    return "pattern_match"


def should_end_or_escalate(state: dict) -> Literal["__end__"]:
    """Final routing - always ends after supervisor finalization."""
    return "__end__"


# =============================================================================
# State Conversion Helpers
# =============================================================================

def _dict_to_state(state_dict: dict) -> AgentState:
    """Convert LangGraph dict state to AgentState dataclass."""
    if isinstance(state_dict, AgentState):
        return state_dict

    agent_state = AgentState()
    for key, value in state_dict.items():
        if hasattr(agent_state, key):
            setattr(agent_state, key, value)
    return agent_state


def _state_to_dict(state: AgentState) -> dict:
    """Convert AgentState dataclass to dict for LangGraph."""
    result = {}
    for key in state.__dataclass_fields__:
        value = getattr(state, key)
        result[key] = value
    return result


# =============================================================================
# Build the LangGraph Workflow
# =============================================================================

def build_reconciliation_workflow() -> StateGraph:
    """
    Build the complete LangGraph reconciliation workflow.

    Flow:
    supervisor_init → l0_nav → [material?] → l1_gl → [breaking buckets?]
    → l2_subledger → [breaking positions?] → l3_transaction
    → [specialists needed?] → specialist_router → pattern_match
    → supervisor_finalize → END
    """
    workflow = StateGraph(dict)

    # Add nodes
    workflow.add_node("supervisor_init", supervisor_init_node)
    workflow.add_node("l0_nav", l0_nav_node)
    workflow.add_node("l1_gl", l1_gl_node)
    workflow.add_node("l2_subledger", l2_subledger_node)
    workflow.add_node("l3_transaction", l3_transaction_node)
    workflow.add_node("specialist_router", specialist_router_node)
    workflow.add_node("pattern_match", pattern_match_node)
    workflow.add_node("supervisor_finalize", supervisor_finalize_node)

    # Set entry point
    workflow.set_entry_point("supervisor_init")

    # Add edges
    workflow.add_edge("supervisor_init", "l0_nav")

    # Conditional: L0 → L1 or skip to finalize (immaterial break)
    workflow.add_conditional_edges(
        "l0_nav",
        should_continue_to_l1,
        {
            "l1_gl": "l1_gl",
            "supervisor_finalize": "supervisor_finalize",
        },
    )

    # Conditional: L1 → L2 or skip to pattern match
    workflow.add_conditional_edges(
        "l1_gl",
        should_continue_to_l2,
        {
            "l2_subledger": "l2_subledger",
            "pattern_match": "pattern_match",
        },
    )

    # Conditional: L2 → L3 or specialists or pattern match
    workflow.add_conditional_edges(
        "l2_subledger",
        should_continue_to_l3,
        {
            "l3_transaction": "l3_transaction",
            "specialist_router": "specialist_router",
            "pattern_match": "pattern_match",
        },
    )

    # Conditional: L3 → specialists or pattern match
    workflow.add_conditional_edges(
        "l3_transaction",
        should_invoke_specialists,
        {
            "specialist_router": "specialist_router",
            "pattern_match": "pattern_match",
        },
    )

    # Specialist → Pattern Match
    workflow.add_edge("specialist_router", "pattern_match")

    # Pattern Match → Supervisor Finalize
    workflow.add_edge("pattern_match", "supervisor_finalize")

    # Supervisor Finalize → END
    workflow.add_edge("supervisor_finalize", END)

    return workflow


def compile_workflow():
    """Compile the workflow into a runnable graph."""
    workflow = build_reconciliation_workflow()
    return workflow.compile()


# =============================================================================
# Convenience Runner
# =============================================================================

def run_reconciliation_analysis(break_alert: BreakAlert) -> AgentState:
    """
    Run the full reconciliation analysis workflow for a break alert.
    Returns the final AgentState with all findings and root cause analysis.
    """
    # Initialize state
    initial_state = AgentState(break_alert=break_alert)
    state_dict = _state_to_dict(initial_state)

    # Compile and run the workflow
    app = compile_workflow()
    final_state_dict = app.invoke(state_dict)

    return _dict_to_state(final_state_dict)
