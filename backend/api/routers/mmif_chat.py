"""
MMIF Chat API — Conversational AI interface for MMIF break analysis.

Endpoints:
  POST /api/mmif-chat/session           — Create chat session (body: eventId)
  POST /api/mmif-chat/session/{id}/message — Send message, get AI response
  GET  /api/mmif-chat/session/{id}/history — Get chat history

The chat endpoint loads MMIF event context (event, breaks, latest agent analysis,
mapping configs) and uses the LLM to provide contextual answers about the MMIF
reconciliation. Messages are stored in MongoDB `mmifChatSessions` collection.

Follows ai_analysis.py patterns for LLM access.
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.mongodb import get_async_db, COLLECTIONS
from config.settings import settings

router = APIRouter(prefix="/api/mmif-chat", tags=["mmif-chat"])


# =============================================================================
# Request / Response Models
# =============================================================================

class CreateSessionRequest(BaseModel):
    eventId: str
    userId: Optional[str] = "u1"
    userName: Optional[str] = "MMIF Analyst"


class SendMessageRequest(BaseModel):
    message: str
    userId: Optional[str] = "u1"


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str
    timestamp: str


class ChatSessionResponse(BaseModel):
    sessionId: str
    eventId: str
    createdAt: str
    userId: str
    userName: str


class MessageResponse(BaseModel):
    sessionId: str
    userMessage: ChatMessage
    assistantMessage: ChatMessage


# =============================================================================
# LLM Access (follows ai_analysis.py pattern)
# =============================================================================

def _get_llm():
    """Get LLM instance following the ai_analysis.py pattern."""
    try:
        if settings.LLM_PROVIDER == "anthropic" and settings.ANTHROPIC_API_KEY:
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(
                model=settings.LLM_MODEL,
                temperature=settings.LLM_TEMPERATURE,
                anthropic_api_key=settings.ANTHROPIC_API_KEY,
            )
        elif settings.OPENAI_API_KEY:
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model=settings.LLM_MODEL,
                temperature=settings.LLM_TEMPERATURE,
                api_key=settings.OPENAI_API_KEY,
            )
    except Exception as e:
        print(f"[mmif_chat] Failed to initialize LLM: {e}")
    return None


# =============================================================================
# Context Builder
# =============================================================================

async def _build_event_context(event_id: str, db) -> dict:
    """
    Load MMIF event context: event doc, breaks, latest agent analysis,
    mapping configs. Returns a structured context dict.
    """
    # Event document
    event = await db[COLLECTIONS["mmifEvents"]].find_one(
        {"eventId": event_id}, {"_id": 0}
    )
    if not event:
        return {}

    # Latest validation run
    latest_run = await db[COLLECTIONS["mmifValidationRuns"]].find_one(
        {"eventId": event_id},
        {"_id": 0},
        sort=[("executionTime", -1)],
    )

    # All breaks for this event
    breaks = await db[COLLECTIONS["mmifBreakRecords"]].find(
        {"eventId": event_id}, {"_id": 0}
    ).to_list(500)

    # Latest agent analyses
    agent_analyses = await db[COLLECTIONS["mmifAgentAnalysis"]].find(
        {"eventId": event_id}, {"_id": 0}
    ).sort("createdAt", -1).to_list(20)

    # Mapping configs
    mapping_configs = await db[COLLECTIONS["mmifMappingConfigs"]].find(
        {"eventId": event_id}, {"_id": 0}
    ).to_list(50)

    # Break statistics
    break_by_rule: dict = {}
    break_by_severity: dict = {}
    for b in breaks:
        rid = b.get("ruleId", "UNKNOWN")
        sev = b.get("severity", "UNKNOWN")
        break_by_rule[rid] = break_by_rule.get(rid, 0) + 1
        break_by_severity[sev] = break_by_severity.get(sev, 0) + 1

    return {
        "event": event,
        "latest_run": latest_run,
        "breaks": breaks,
        "agent_analyses": agent_analyses,
        "mapping_configs": mapping_configs,
        "break_by_rule": break_by_rule,
        "break_by_severity": break_by_severity,
        "total_breaks": len(breaks),
        "total_funds": len(event.get("funds", [])),
    }


def _build_system_prompt(context: dict) -> str:
    """Build a rich system prompt with MMIF event context for the LLM."""
    if not context:
        return (
            "You are an expert MMIF regulatory filing analyst. "
            "Help the user understand MMIF reconciliation breaks and filing requirements."
        )

    event = context.get("event", {})
    event_name = event.get("eventName", "Unknown event")
    filing_period = event.get("filingPeriod", "Unknown period")
    filing_deadline = event.get("filingDeadline", "Unknown deadline")
    event_status = event.get("status", "Unknown status")

    total_breaks = context.get("total_breaks", 0)
    total_funds = context.get("total_funds", 0)
    break_by_rule = context.get("break_by_rule", {})
    break_by_severity = context.get("break_by_severity", {})

    # Format break summary
    rule_summary = "\n".join(
        f"  - {rid}: {cnt} break(s)"
        for rid, cnt in sorted(break_by_rule.items())
    ) or "  No breaks detected"

    severity_summary = "\n".join(
        f"  - {sev}: {cnt}"
        for sev, cnt in sorted(break_by_severity.items())
    ) or "  No breaks"

    # Format agent analyses (top 3)
    analyses = context.get("agent_analyses", [])
    analysis_summaries = []
    for a in analyses[:3]:
        analysis_summaries.append(
            f"  Fund: {a.get('fundAccount', '?')} | "
            f"Rule: {a.get('ruleId', '?')} | "
            f"Classification: {a.get('rootCauseClassification', '?')} | "
            f"Confidence: {a.get('overallConfidence', 0):.0%} | "
            f"Clearance: {'YES' if a.get('filingClearance') else 'NO'}"
        )
    analysis_str = "\n".join(analysis_summaries) or "  No agent analyses yet"

    # Format fund list
    funds = event.get("funds", [])
    fund_list = "\n".join(
        f"  - {f.get('account', '?')} ({f.get('fundName', '?')}): "
        f"breaks={f.get('breakCount', 0)}"
        for f in funds[:10]
    ) or "  No funds"

    system_prompt = f"""You are an expert MMIF regulatory filing analyst assistant for ReconClareAI.

You have full context about the current MMIF filing event. Help analysts understand:
- What the MMIF validation breaks mean and their root causes
- Which sections and rules are failing and why
- How to remediate breaks before the filing deadline
- The attestation readiness and filing clearance status
- MMIF regulatory requirements (CBI, UCITS, AIF rules)

Be precise, reference specific rule IDs (VR-001 through VR-015), section numbers,
and use the actual data from the context. Always be helpful and actionable.

═══════════════════════════════════════════
CURRENT MMIF EVENT CONTEXT
═══════════════════════════════════════════

Event: {event_name}
Filing Period: {filing_period}
Filing Deadline: {filing_deadline}
Status: {event_status}
Total Funds: {total_funds}
Total Breaks: {total_breaks}

BREAKS BY RULE:
{rule_summary}

BREAKS BY SEVERITY:
{severity_summary}

FUNDS:
{fund_list}

LATEST AGENT ANALYSES:
{analysis_str}

═══════════════════════════════════════════
MMIF RULE REFERENCE
═══════════════════════════════════════════
VR-001: Total Assets Tie-Out (HARD, tolerance=0) — Section 4.3 must equal Eagle TB total assets
VR-002: Equity Subtotal (HARD, tol=0.01) — Section 3.1 = TB equity accounts
VR-003: Debt Subtotal (HARD, tol=0.01) — Section 3.2 = TB fixed income (clean price)
VR-004: Cash Subtotal (HARD, tol=0) — Section 3.5 = TB cash/deposit accounts
VR-005: Derivative Net (SOFT, tol=0.05) — Section 4.2 = TB derivative asset minus liability
VR-006: Opening = Prior Closing (HARD, tol=0) — Per-security opening must match Q-1 closing
VR-007: Balance Identity (DERIVED, tol=0) — Opening + Purchases - Sales + Valuation = Closing
VR-008: Accrued Income (SOFT, tol=0.02) — Section 3.6/line-level accrued income = TB
VR-009: Fund Shares/Units (HARD, tol=0.01) — Section 5.1 closing shares * NAV = TB
VR-010: P&L Quarter-Only (HARD, tol=0.01) — Section 2 P&L must be QTD not YTD
VR-011: FX Consistency (SOFT, tol=0.10) — Quarter-end FX rates consistent across all sections
VR-012: ISIN Coverage (ADVISORY) — >95% of positions must have valid ISIN codes
VR-013: Securities Lending Off-BS (HARD, tol=0) — Sec lending must NOT be in total assets
VR-014: Short Position Sign (HARD, tol=0) — Short positions must be negative asset values
VR-015: Investor Decomposition (DERIVED, tol=0.05) — ΔNAV = valuation + FX + flows + income
═══════════════════════════════════════════"""

    return system_prompt


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/session", response_model=ChatSessionResponse)
async def create_chat_session(request: CreateSessionRequest):
    """
    Create a new MMIF chat session for a given event.
    Loads event context and initializes the session in MongoDB.
    """
    db = get_async_db()

    # Verify event exists
    event = await db[COLLECTIONS["mmifEvents"]].find_one(
        {"eventId": request.eventId}, {"_id": 0, "eventId": 1, "eventName": 1}
    )
    if not event:
        raise HTTPException(404, f"MMIF Event {request.eventId} not found")

    session_id = f"MMIF-CHAT-{uuid.uuid4().hex[:12].upper()}"
    created_at = datetime.utcnow().isoformat()

    session_doc = {
        "sessionId": session_id,
        "eventId": request.eventId,
        "userId": request.userId,
        "userName": request.userName,
        "messages": [],
        "createdAt": created_at,
        "updatedAt": created_at,
    }

    await db[COLLECTIONS["mmifChatSessions"]].insert_one(session_doc)

    return ChatSessionResponse(
        sessionId=session_id,
        eventId=request.eventId,
        createdAt=created_at,
        userId=request.userId or "u1",
        userName=request.userName or "MMIF Analyst",
    )


@router.post("/session/{session_id}/message", response_model=MessageResponse)
async def send_message(session_id: str, request: SendMessageRequest):
    """
    Send a message to the MMIF chat assistant and receive an AI response.

    Loads full MMIF event context (event, breaks, agent analyses, mapping configs)
    and uses the LLM to provide a contextual response about the MMIF filing.
    Stores both user and assistant messages in MongoDB.
    """
    db = get_async_db()

    # Load session
    session = await db[COLLECTIONS["mmifChatSessions"]].find_one(
        {"sessionId": session_id}, {"_id": 0}
    )
    if not session:
        raise HTTPException(404, f"Chat session {session_id} not found")

    event_id = session["eventId"]
    now = datetime.utcnow().isoformat()

    # Build user message
    user_message = {
        "role": "user",
        "content": request.message,
        "timestamp": now,
        "userId": request.userId,
    }

    # Load full event context
    context = await _build_event_context(event_id, db)

    # Build system prompt with context
    system_prompt = _build_system_prompt(context)

    # Build conversation history for LLM (last 10 messages)
    history = session.get("messages", [])[-10:]

    # Call LLM
    assistant_content = await _call_llm(
        system_prompt=system_prompt,
        history=history,
        user_message=request.message,
    )

    # Build assistant message
    assistant_message = {
        "role": "assistant",
        "content": assistant_content,
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Persist both messages to session
    await db[COLLECTIONS["mmifChatSessions"]].update_one(
        {"sessionId": session_id},
        {
            "$push": {"messages": {"$each": [user_message, assistant_message]}},
            "$set": {"updatedAt": assistant_message["timestamp"]},
        },
    )

    return MessageResponse(
        sessionId=session_id,
        userMessage=ChatMessage(
            role="user",
            content=request.message,
            timestamp=now,
        ),
        assistantMessage=ChatMessage(
            role="assistant",
            content=assistant_content,
            timestamp=assistant_message["timestamp"],
        ),
    )


@router.get("/session/{session_id}/history")
async def get_chat_history(session_id: str):
    """
    Get the full message history for a chat session.
    Returns the session metadata and all messages.
    """
    db = get_async_db()

    session = await db[COLLECTIONS["mmifChatSessions"]].find_one(
        {"sessionId": session_id}, {"_id": 0}
    )
    if not session:
        raise HTTPException(404, f"Chat session {session_id} not found")

    return {
        "sessionId": session_id,
        "eventId": session.get("eventId"),
        "userId": session.get("userId"),
        "userName": session.get("userName"),
        "createdAt": session.get("createdAt"),
        "updatedAt": session.get("updatedAt"),
        "messages": session.get("messages", []),
        "messageCount": len(session.get("messages", [])),
    }


@router.get("/sessions")
async def list_chat_sessions(event_id: Optional[str] = None):
    """List all MMIF chat sessions, optionally filtered by event."""
    from fastapi import Query as FQuery
    db = get_async_db()
    query: dict = {}
    if event_id:
        query["eventId"] = event_id
    sessions = await db[COLLECTIONS["mmifChatSessions"]].find(
        query,
        {"_id": 0, "sessionId": 1, "eventId": 1, "userId": 1,
         "userName": 1, "createdAt": 1, "updatedAt": 1, "messages": {"$slice": -1}},
    ).sort("updatedAt", -1).to_list(100)
    return sessions


# =============================================================================
# LLM Call Helper
# =============================================================================

async def _call_llm(
    system_prompt: str, history: list[dict], user_message: str
) -> str:
    """
    Call the LLM with the system prompt, conversation history, and new user message.
    Follows ai_analysis.py patterns for LLM initialization.
    """
    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

    llm = _get_llm()
    if llm is None:
        return (
            "AI assistant is currently unavailable. "
            "Please check the LLM configuration (ANTHROPIC_API_KEY or OPENAI_API_KEY). "
            "In the meantime, please review the validation run results and agent analyses "
            "directly in the MMIF dashboard."
        )

    messages = [SystemMessage(content=system_prompt)]

    # Add conversation history
    for msg in history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))

    # Add current user message
    messages.append(HumanMessage(content=user_message))

    try:
        response = llm.invoke(messages)
        return response.content
    except Exception as e:
        return (
            f"I encountered an error generating a response: {str(e)}. "
            "Please try again or check the agent analysis results directly."
        )
