"""
Auto-Assignment Engine for Break Resolution.

Rule-based break routing with round-robin owner distribution.
Integrates with the validation pipeline to automatically assign
break records to the appropriate team and owner.
"""
from datetime import datetime
from typing import Optional
from db.mongodb import get_sync_db, COLLECTIONS

# ── Rule Table ──────────────────────────────────────────────
# Maps break types to default team assignments

ASSIGNMENT_RULES: list[dict] = [
    {"breakType": "SHARE", "defaultTeam": "TRADE_CAPTURE", "priority": 1},
    {"breakType": "PRICE", "defaultTeam": "PRICING", "priority": 2},
    {"breakType": "INCOME", "defaultTeam": "INCOME", "priority": 3},
    {"breakType": "RECLAIM", "defaultTeam": "INCOME", "priority": 4},
    {"breakType": "DERIVATIVE", "defaultTeam": "DERIVATIVES", "priority": 5},
    {"breakType": "OTHER", "defaultTeam": "NAV_OVERSIGHT", "priority": 99},
]

# Team member rosters (sync with BreakTeamDropdown frontend component)
TEAM_ROSTERS: dict[str, list[str]] = {
    "NAV_OVERSIGHT": ["David Park", "Rachel Torres"],
    "PRICING": ["Mark Chen", "Amy Liu"],
    "TRADE_CAPTURE": ["Sarah Kim", "Tom Zhao"],
    "CORPORATE_ACTIONS": ["Brian Lee", "Nina Patel"],
    "INCOME": ["Karen Wu", "Jason Miller"],
    "DERIVATIVES": ["Alex Johnson", "Maria Garcia"],
}

# Round-robin counters per team/event — in-memory for simplicity
_round_robin_counters: dict[str, int] = {}


def _get_next_owner(team: str, event_id: str) -> str:
    """Get next available team member via round-robin."""
    members = TEAM_ROSTERS.get(team, [])
    if not members:
        return ""

    key = f"{event_id}:{team}"
    idx = _round_robin_counters.get(key, 0)
    owner = members[idx % len(members)]
    _round_robin_counters[key] = idx + 1
    return owner


def _match_rule(break_type: str) -> dict:
    """Find the assignment rule for a given break type."""
    for rule in ASSIGNMENT_RULES:
        if rule["breakType"] == break_type:
            return rule
    # Fallback to OTHER
    return ASSIGNMENT_RULES[-1]


def auto_assign_break(
    event_id: str,
    valuation_date: str,
    entity_reference: str,
    break_type: str,
    reconciliation_level: str = "L2_POSITION",
    break_amount: float = 0.0,
    fund_account: str = "",
    fund_name: str = "",
) -> dict:
    """
    Auto-assign a break to the appropriate team and owner.

    Creates:
    1. A breakAssignment record in MongoDB
    2. A notification record for the assigned owner

    Returns the created assignment dict.
    """
    db = get_sync_db()

    # 1. Look up rule
    rule = _match_rule(break_type)
    team = rule["defaultTeam"]
    owner = _get_next_owner(team, event_id)

    # 2. Check if assignment already exists (skip if so)
    existing = db[COLLECTIONS["breakAssignments"]].find_one({
        "eventId": event_id,
        "entityReference": entity_reference,
        "valuationDate": valuation_date,
    })
    if existing:
        return {k: v for k, v in existing.items() if k != "_id"}

    # 3. Create break assignment
    now = datetime.utcnow().isoformat()
    assignment = {
        "eventId": event_id,
        "valuationDate": valuation_date,
        "entityReference": entity_reference,
        "reconciliationLevel": reconciliation_level,
        "breakType": break_type,
        "breakCategory": "UNDER_INVESTIGATION",
        "breakAmount": break_amount,
        "assignedTeam": team,
        "assignedOwner": owner,
        "reviewStatus": "NOT_STARTED",
        "autoAssigned": True,
        "assignedAt": now,
    }
    db[COLLECTIONS["breakAssignments"]].insert_one(assignment)
    assignment.pop("_id", None)

    # 4. Create notification for assigned owner
    if owner:
        notification = {
            "eventId": event_id,
            "assignedOwner": owner,
            "breakType": break_type,
            "entityReference": entity_reference,
            "fundAccount": fund_account,
            "fundName": fund_name,
            "message": f"New {break_type.lower()} break assigned: {entity_reference} in {fund_name or fund_account}",
            "channel": "IN_APP",
            "isRead": False,
            "createdAt": now,
        }
        db[COLLECTIONS["notifications"]].insert_one(notification)

    # 5. Audit log
    db[COLLECTIONS["auditLogs"]].insert_one({
        "eventId": event_id,
        "action": "AUTO_ASSIGNMENT",
        "entityReference": entity_reference,
        "previousValue": None,
        "newValue": f"{team}/{owner}",
        "changedBy": "auto-assignment-engine",
        "timestamp": now,
    })

    return assignment


def auto_assign_breaks_batch(
    event_id: str,
    valuation_date: str,
    breaks: list[dict],
) -> list[dict]:
    """
    Batch auto-assign multiple breaks.

    Each break dict should contain:
      - entityReference: str
      - breakType: str (SHARE, PRICE, INCOME, RECLAIM, DERIVATIVE, OTHER)
      - reconciliationLevel: str (optional, defaults to L2_POSITION)
      - breakAmount: float (optional)
      - fundAccount: str (optional)
      - fundName: str (optional)
    """
    results = []
    for b in breaks:
        result = auto_assign_break(
            event_id=event_id,
            valuation_date=valuation_date,
            entity_reference=b["entityReference"],
            break_type=b.get("breakType", "OTHER"),
            reconciliation_level=b.get("reconciliationLevel", "L2_POSITION"),
            break_amount=b.get("breakAmount", 0.0),
            fund_account=b.get("fundAccount", ""),
            fund_name=b.get("fundName", ""),
        )
        results.append(result)
    return results
