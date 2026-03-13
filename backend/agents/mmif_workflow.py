"""
LangGraph Workflow Orchestration for the MMIF 6-Agent Analysis Pipeline.

Implements the MMIF state machine:
  supervisor_init
    → l0_total_assets → [material?]
    → l1_section → [breaking sections?]
    → l2_security → [security issues?]
    → l3_movement
    → specialists: schema_mapper + break_analyst (parallel via router)
    → attestation
    → supervisor_finalize
    → END

Follows workflow.py patterns exactly, adapted for MmifAgentState and MMIF agents.
"""
from typing import Any, Literal

from langgraph.graph import StateGraph, END

from agents.mmif_state import MmifAgentState, MmifAnalysisPhase, MmifBreakInput
from agents.mmif_supervisor import MmifSupervisorAgent
from agents.mmif_level_agents import (
    MmifL0TotalAssetsAgent,
    MmifL1SectionAgent,
    MmifL2SecurityAgent,
    MmifL3MovementAgent,
)
from agents.mmif_specialist_agents import (
    MmifSchemaMapperAgent,
    MmifBalanceExtractorAgent,
    MmifBreakAnalystAgent,
    MmifAttestationAgent,
)


# =============================================================================
# Module-Level Agent Instances
# =============================================================================

supervisor = MmifSupervisorAgent()
l0_agent = MmifL0TotalAssetsAgent()
l1_agent = MmifL1SectionAgent()
l2_agent = MmifL2SecurityAgent()
l3_agent = MmifL3MovementAgent()
schema_mapper = MmifSchemaMapperAgent()
balance_extractor = MmifBalanceExtractorAgent()
break_analyst = MmifBreakAnalystAgent()
attestation_agent = MmifAttestationAgent()


# =============================================================================
# Node Functions (wrap agents for LangGraph — dict ↔ MmifAgentState)
# =============================================================================

def supervisor_init_node(state: dict) -> dict:
    """Supervisor initializes the MMIF analysis and loads context."""
    agent_state = _dict_to_state(state)
    agent_state.phase = MmifAnalysisPhase.INITIATED
    result = supervisor(agent_state)
    return _state_to_dict(result)


def l0_total_assets_node(state: dict) -> dict:
    """L0 Total Assets Agent validates VR-001 and classifies the primary driver."""
    agent_state = _dict_to_state(state)
    result = l0_agent(agent_state)
    return _state_to_dict(result)


def l1_section_node(state: dict) -> dict:
    """L1 Section Agent decomposes break into MMIF section subtotals."""
    agent_state = _dict_to_state(state)
    result = l1_agent(agent_state)
    return _state_to_dict(result)


def l2_security_node(state: dict) -> dict:
    """L2 Security Agent matches Eagle positions to MMIF line items by ISIN."""
    agent_state = _dict_to_state(state)
    result = l2_agent(agent_state)
    return _state_to_dict(result)


def l3_movement_node(state: dict) -> dict:
    """L3 Movement Agent validates balance identity, opening/closing, FX, P&L, investor decomp."""
    agent_state = _dict_to_state(state)
    result = l3_agent(agent_state)
    return _state_to_dict(result)


def specialist_router_node(state: dict) -> dict:
    """Routes to specialist agents based on findings from L0-L3."""
    agent_state = _dict_to_state(state)
    agent_state.phase = MmifAnalysisPhase.SPECIALIST_ANALYSIS

    # Always run schema mapper and break analyst
    agent_state = schema_mapper(agent_state)
    agent_state = break_analyst(agent_state)

    # Conditionally run balance extractor if extraction issues detected
    if (
        agent_state.fx_inconsistencies
        or agent_state.sign_convention_issues
        or agent_state.balance_identity_breaks
    ):
        agent_state = balance_extractor(agent_state)

    return _state_to_dict(agent_state)


def attestation_node(state: dict) -> dict:
    """Attestation Agent generates filing readiness report and clearance decision."""
    agent_state = _dict_to_state(state)
    result = attestation_agent(agent_state)
    return _state_to_dict(result)


def supervisor_finalize_node(state: dict) -> dict:
    """Supervisor aggregates all findings and produces the final MMIF analysis report."""
    agent_state = _dict_to_state(state)
    # Phase is set to anything but INITIATED so supervisor goes to finalize path
    if agent_state.phase == MmifAnalysisPhase.INITIATED:
        agent_state.phase = MmifAnalysisPhase.SPECIALIST_ANALYSIS
    result = supervisor(agent_state)
    return _state_to_dict(result)


# =============================================================================
# Conditional Routing Functions
# =============================================================================

def should_continue_to_l1(
    state: dict,
) -> Literal["l1_section", "specialist_router"]:
    """After L0: if break is material, continue to L1; else skip to specialists."""
    agent_state = _dict_to_state(state)
    tv = agent_state.total_assets_variance
    if tv and tv.is_material:
        return "l1_section"
    # Immaterial break — skip straight to specialist summary
    return "specialist_router"


def should_continue_to_l2(
    state: dict,
) -> Literal["l2_security", "specialist_router"]:
    """After L1: if sections are breaking, continue to L2; else go to specialists."""
    agent_state = _dict_to_state(state)
    if agent_state.breaking_sections:
        return "l2_security"
    return "specialist_router"


def should_continue_to_l3(
    state: dict,
) -> Literal["l3_movement", "specialist_router"]:
    """After L2: if security-level issues found, continue to L3; else go to specialists."""
    agent_state = _dict_to_state(state)
    has_security_issues = (
        agent_state.breaking_securities
        or agent_state.isin_coverage_pct < 0.95
    )
    if has_security_issues:
        return "l3_movement"
    return "specialist_router"


# =============================================================================
# State Conversion Helpers
# =============================================================================

def _dict_to_state(state_dict: dict) -> MmifAgentState:
    """Convert LangGraph dict state to MmifAgentState dataclass."""
    if isinstance(state_dict, MmifAgentState):
        return state_dict

    agent_state = MmifAgentState()
    for key, value in state_dict.items():
        if hasattr(agent_state, key):
            setattr(agent_state, key, value)
    return agent_state


def _state_to_dict(state: MmifAgentState) -> dict:
    """Convert MmifAgentState dataclass to dict for LangGraph."""
    result = {}
    for key in state.__dataclass_fields__:
        value = getattr(state, key)
        result[key] = value
    return result


# =============================================================================
# Build the MMIF LangGraph Workflow
# =============================================================================

def build_mmif_workflow() -> StateGraph:
    """
    Build the complete MMIF LangGraph analysis workflow.

    Flow:
    supervisor_init → l0_total_assets → [material?]
      → l1_section → [breaking sections?]
      → l2_security → [security issues?]
      → l3_movement
      → specialist_router (schema_mapper + break_analyst + optional balance_extractor)
      → attestation
      → supervisor_finalize → END
    """
    workflow = StateGraph(dict)

    # Add nodes
    workflow.add_node("supervisor_init", supervisor_init_node)
    workflow.add_node("l0_total_assets", l0_total_assets_node)
    workflow.add_node("l1_section", l1_section_node)
    workflow.add_node("l2_security", l2_security_node)
    workflow.add_node("l3_movement", l3_movement_node)
    workflow.add_node("specialist_router", specialist_router_node)
    workflow.add_node("attestation", attestation_node)
    workflow.add_node("supervisor_finalize", supervisor_finalize_node)

    # Entry point
    workflow.set_entry_point("supervisor_init")

    # supervisor_init → l0_total_assets (always)
    workflow.add_edge("supervisor_init", "l0_total_assets")

    # Conditional: L0 → L1 or skip to specialists (immaterial break)
    workflow.add_conditional_edges(
        "l0_total_assets",
        should_continue_to_l1,
        {
            "l1_section": "l1_section",
            "specialist_router": "specialist_router",
        },
    )

    # Conditional: L1 → L2 or skip to specialists (no breaking sections)
    workflow.add_conditional_edges(
        "l1_section",
        should_continue_to_l2,
        {
            "l2_security": "l2_security",
            "specialist_router": "specialist_router",
        },
    )

    # Conditional: L2 → L3 or skip to specialists
    workflow.add_conditional_edges(
        "l2_security",
        should_continue_to_l3,
        {
            "l3_movement": "l3_movement",
            "specialist_router": "specialist_router",
        },
    )

    # L3 → specialist router (always)
    workflow.add_edge("l3_movement", "specialist_router")

    # Specialist router → attestation
    workflow.add_edge("specialist_router", "attestation")

    # Attestation → supervisor finalize
    workflow.add_edge("attestation", "supervisor_finalize")

    # Supervisor finalize → END
    workflow.add_edge("supervisor_finalize", END)

    return workflow


def compile_mmif_workflow():
    """Compile the MMIF workflow into a runnable LangGraph app."""
    workflow = build_mmif_workflow()
    return workflow.compile()


# =============================================================================
# Convenience Runner
# =============================================================================

def run_mmif_analysis(mmif_break_input: MmifBreakInput) -> MmifAgentState:
    """
    Run the full MMIF 6-agent analysis workflow for a break input.
    Returns the final MmifAgentState with all findings, root causes, and attestation report.

    Args:
        mmif_break_input: The MMIF break to analyze (from validation engine)

    Returns:
        Final MmifAgentState with complete analysis results
    """
    # Initialize state with the break input
    initial_state = MmifAgentState(mmif_break=mmif_break_input)
    state_dict = _state_to_dict(initial_state)

    # Compile and run the workflow
    app = compile_mmif_workflow()
    final_state_dict = app.invoke(state_dict)

    return _dict_to_state(final_state_dict)
